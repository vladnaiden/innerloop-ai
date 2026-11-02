#!/usr/bin/env python3
"""Prove a split of an always-loaded instruction file lost nothing and actually shrank it.

    python3 scripts/preservation-check.py --before OLD.md --after NEW.md [--routed a.md b.md ...]

PASS needs all three:
  1. every non-empty line of OLD (whitespace-normalised) exists as a line in NEW or a routed file —
     content is moved, never dropped or reworded;
  2. every line matching --pin (default: OWNER RULE|PINNED) is still in NEW itself — safety-critical
     rules are never buried in a routed doc;
  3. NEW is smaller than OLD (the always-loaded cost went down).
Exit 0 = PASS, 1 = FAIL. Read-only: it never writes anything.
"""
import argparse, re, sys

SKIP = re.compile(r"^(-{3,}|\|?[\s:|-]+\|?)$")  # rules, table separator rows

def norm(line):
    return re.sub(r"\s+", " ", line.strip())

def lines(path):
    with open(path, encoding="utf-8") as f:
        return [norm(l) for l in f]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--before", required=True)
    ap.add_argument("--after", required=True)
    ap.add_argument("--routed", nargs="*", default=[])
    ap.add_argument("--pin", default=r"OWNER RULE|PINNED")
    a = ap.parse_args()

    old = lines(a.before)
    new = lines(a.after)
    have = set(new)
    for r in a.routed:
        have.update(lines(r))
    pin = re.compile(a.pin)

    missing = [(i, l) for i, l in enumerate(old, 1) if l and not SKIP.match(l) and l not in have]
    buried = [(i, l) for i, l in enumerate(old, 1) if l and pin.search(l) and l not in set(new)]
    b_old = sum(len(l.encode()) for l in open(a.before, encoding="utf-8"))
    b_new = sum(len(l.encode()) for l in open(a.after, encoding="utf-8"))

    for i, l in missing[:40]:
        print(f"MISSING  {a.before}:{i}  {l[:110]}")
    if len(missing) > 40:
        print(f"... and {len(missing) - 40} more missing lines")
    for i, l in buried[:20]:
        print(f"BURIED   {a.before}:{i}  pinned line is no longer in {a.after}: {l[:90]}")
    print(f"always-loaded: {b_old:,} → {b_new:,} bytes (≈{b_old // 4:,} → ≈{b_new // 4:,} tokens, rough /4 estimate)")
    print(f"lines checked: {sum(1 for l in old if l and not SKIP.match(l))} · missing: {len(missing)} · "
          f"pinned buried: {len(buried)} · routed files: {len(a.routed)}")
    ok = not missing and not buried and b_new < b_old
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
