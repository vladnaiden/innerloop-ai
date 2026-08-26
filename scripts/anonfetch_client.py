#!/usr/bin/env python3
"""anonfetch client — the only socket any scanner in this repo opens.

Extracted from reddit-signals.py so every scanner shares one implementation of
the hard rule: nothing here talks to a target site directly. Every request is
handed to anonfetch, an MCP server on the host that fetches through rotating
proxy exits with a coherent browser fingerprint per identity, detects soft
blocks (Cloudflare / CAPTCHA / access-denied) and retries through a different
exit. There is no direct mode and no fallback channel.

Enroll a container once:  curl -s http://host.docker.internal:8765/enroll | sh

Usage:
    import anonfetch_client as af
    url, token = af.discover_anonfetch()
    af.set_client(af.AnonFetch(url, token, rotation="sticky"))
    data = af.fetch_json("https://api.example.com/thing")
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

ANONFETCH_URL_ENV = "ANONFETCH_URL"
ANONFETCH_TOKEN_ENV = "ANONFETCH_TOKEN"
DEFAULT_ANONFETCH_URL = "http://host.docker.internal:8765/mcp"
CLAUDE_CFG = os.path.expanduser("~/.claude/.claude.json")

# `empty-body` is off on purpose: Reddit's token response is ~150 bytes and the
# detector reads anything that small as a dropped exit. The rest stay on.
BLOCK_RULES = ["http-status", "cloudflare-challenge", "captcha", "access-denied"]

# What a provider-side refusal looks like, as opposed to a site block. NordVPN
# rate-limits how many *distinct* exits one account authenticates against in a
# short window; once tripped every exit answers 407 on CONNECT (older servers
# surfaced that as "stream has been aborted"). Rotating to yet another exit is
# exactly what deepens it, so the response is: stay on the identity, back off.
THROTTLE_RE = re.compile(r"PROXY_AUTH_REJECTED|\b407\b|stream has been aborted|"
                         r"socket hang up|ECONNRESET|Proxy connection ended", re.I)
# Cumulative worst case ~3.5 min — under the "no silent wait over 5 minutes" rule.
THROTTLE_BACKOFF_S = (15, 30, 60, 105)

_client = None


class FetchError(Exception):
    """A fetch that anonfetch could not complete. `code` is the HTTP status if any."""

    def __init__(self, msg, code=None, blocked_by=None):
        super().__init__(msg)
        self.code = code
        self.blocked_by = blocked_by


def discover_anonfetch():
    """URL + token: explicit env first, else whatever `enroll` registered for Claude."""
    url = os.getenv(ANONFETCH_URL_ENV)
    token = os.getenv(ANONFETCH_TOKEN_ENV)
    if url and token:
        return url, token
    try:
        with open(CLAUDE_CFG) as f:
            srv = json.load(f).get("mcpServers", {}).get("anonfetch", {})
        url = url or srv.get("url")
        auth = srv.get("headers", {}).get("Authorization", "")
        token = token or (auth.split()[-1] if auth else None)
    except Exception:
        pass
    return url or DEFAULT_ANONFETCH_URL, token


class AnonFetch:
    """Minimal MCP client — just enough to drive anonfetch's fetch_url."""

    def __init__(self, url, token, rotation="sticky", country=None, retries=3,
                 client_name="innerloop-scanner", throttle_backoff=THROTTLE_BACKOFF_S):
        self.url, self.rotation, self.country, self.retries = url, rotation, country, retries
        self.throttle_backoff = tuple(throttle_backoff)
        self.throttle_events = 0                    # for the run summary
        self.headers = {"Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                        "Accept": "application/json, text/event-stream"}
        self.session = None
        self.identity = None
        self._id = 0
        info = self.rpc("initialize", {
            "protocolVersion": "2025-06-18", "capabilities": {},
            "clientInfo": {"name": client_name, "version": "1.2"}})
        self.rpc("notifications/initialized", notify=True)
        self.server = info.get("result", {}).get("serverInfo", {})

    def rpc(self, method, params=None, notify=False, timeout=180):
        self._id += 1
        body = {"jsonrpc": "2.0", "method": method}
        if not notify:
            body["id"] = self._id
        if params is not None:
            body["params"] = params
        h = dict(self.headers)
        if self.session:
            h["mcp-session-id"] = self.session
        req = urllib.request.Request(self.url, data=json.dumps(body).encode(), headers=h)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                sid = r.headers.get("mcp-session-id")
                if sid:
                    self.session = sid
                raw = r.read().decode()
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:200]
            sys.exit(f"anonfetch refused the call: HTTP {e.code} {detail}\n"
                     f"Re-enroll with: curl -s {self.url.rsplit('/', 1)[0]}/enroll | sh")
        except OSError as e:
            sys.exit(f"anonfetch unreachable at {self.url} ({e}). Start it on the host, "
                     f"or set {ANONFETCH_URL_ENV}. There is no direct mode.")
        for line in raw.splitlines():           # SSE framing when the server streams
            if line.startswith("data:"):
                raw = line[5:].strip()
        out = json.loads(raw) if raw.strip() else {}
        if "error" in out:
            raise FetchError(f"anonfetch: {out['error'].get('message', out['error'])}")
        return out

    def tool(self, name, **args):
        text = self.rpc("tools/call", {"name": name, "arguments": args})["result"]["content"][0]["text"]
        try:
            return json.loads(text)
        except ValueError:
            return text

    def new_identity(self):
        """One exit + fingerprint + cookie jar, reused until it gets blocked."""
        kw = {"country": self.country} if self.country else {}
        d = self.tool("new_identity", **kw)
        ident = (d.get("identities") or [{}])[0]      # {created, identities:[{id, proxy, …}]}
        self.identity = ident.get("id")
        if not self.identity:
            raise FetchError(f"anonfetch returned no identity: {str(d)[:200]}")
        print(f"→ anonfetch identity {self.identity} via {ident.get('proxy', '?')} "
              f"[{ident.get('browser', '?')}]", file=sys.stderr)
        return self.identity

    def fetch(self, url, method="GET", headers=None, body=None, require=None,
              block_rules=None):
        """Return the anonfetch result dict, or raise FetchError. Never hits the net directly."""
        args = {"url": url, "method": method, "returnBody": "html",
                "maxChars": 2_000_000, "retries": self.retries,
                "blockRules": BLOCK_RULES if block_rules is None else block_rules}
        if headers:
            args["headers"] = headers
        if body is not None:
            args["body"] = body
        if require:
            args["requireBodyMatches"] = require
        if self.rotation == "sticky":
            args["identityId"] = self.identity or self.new_identity()
        else:
            args["strategy"] = self.rotation
            if self.country:
                args["country"] = self.country

        r = self.tool("fetch_url", **args)
        # Provider throttle: keep the identity (its exit is fine), wait, retry.
        for wait in self.throttle_backoff:
            if r.get("ok") or not self._throttled(r):
                break
            self.throttle_events += 1
            print(f"⏳ provider auth limit ({str(r.get('error'))[:50]}…) — "
                  f"backing off {wait}s on the same exit", file=sys.stderr)
            time.sleep(wait)
            r = self.tool("fetch_url", **args)
        if not r.get("ok") and self.rotation == "sticky" and not self._throttled(r):
            self.identity = None                # burnt exit: mint a fresh one, once
            args["identityId"] = self.new_identity()
            r = self.tool("fetch_url", **args)
        if not r.get("ok"):
            raise FetchError(r.get("error") or "fetch failed",
                             code=r.get("status"), blocked_by=r.get("blockedBy"))
        return r

    @staticmethod
    def _throttled(r):
        """True when the failure is the proxy provider refusing us, not the site."""
        if r.get("ok") or r.get("blockedBy"):
            return False
        return bool(THROTTLE_RE.search(str(r.get("error") or "")))


def body_of(r):
    """anonfetch puts the payload in `html` (returnBody=html) or `text`."""
    if r.get("truncated"):                      # silent truncation = unparsable JSON
        raise FetchError(f"body truncated at maxChars ({r.get('bodyBytes')} bytes)",
                         code=r.get("status"))
    text = r.get("html") or r.get("text") or ""
    if not text:
        raise FetchError(f"empty body from {r.get('proxy')} ({r.get('bodyBytes')} bytes)",
                         code=r.get("status"))
    return text


def fetch_json(url, **kw):
    if _client is None:
        sys.exit("Refusing to open a connection: anonfetch not initialised.")
    return json.loads(body_of(_client.fetch(url, **kw)))


def set_client(client):
    """Install the process-wide client. Returns it, so callers can keep a handle."""
    global _client
    _client = client
    return client


def get_client():
    return _client
