## Free infrastructure & credits available (checked live 28.08.2026)

Owner rule: **no pay-as-you-go anywhere.** Everything below is $0 or a pre-paid credit.
Full table with catches in `wiki/sources/Free infrastructure & credits (28.08.2026).md`.

- **OCI Always Free** (permanent, no PAYG upgrade needed; billed only if you explicitly
  upgrade): 2× E2.1.Micro AMD (1/8 OCPU, 1 GB) — **one already runs the production
  Postgres 16 + PgBouncer at `db.affiliate-registry.com`** (Frankfurt, since 28.08.2026);
  ARM A1.Flex **2 OCPU + 12 GB total** (shrunk from 4/24; "out of host capacity" is
  common — retry/quiet region); 200 GB block storage; 10 TB egress/mo; MySQL HeatWave 50 GB;
  2× Oracle Autonomous DB 20 GB; NoSQL; Email Delivery 3,000/mo; 1 flexible load balancer.
  **No managed Postgres** — self-host on a VM. Idle VMs get reclaimed (7 days) → keep the
  crawler/DB busy and `pg_dump` off-box.
- **GitHub Student Developer Pack** (only while student status is real — GitHub re-verifies;
  misuse = pack revoked + account suspension risk, which would take the repos and Vercel
  login with it). **DigitalOcean left the pack; all credits expired 01.08.2026.** Still
  useful: **Heroku $13/mo × 24 mo** → Heroku Postgres Essential-1 (10 GB, $9) as a managed
  fallback DB; **Azure $100** (≈6 mo of a B1ms Postgres — short runway, not a foundation);
  SendGrid/Mailgun (transactional email, plan alerts); Sentry; Datadog / New Relic (uptime,
  adapter-returns-0-rows alerts); Icons8 / Iconscout; Polypane (design-loop viewports);
  Termius, 1Password, Copilot Pro, Codespaces. MongoDB $50 / Appwrite / LocalStack — not
  Postgres, not needed. JetBrains student licence is **non-commercial only**; all other
  credits may be used on the commercial site.
- **Free tiers that no longer fit:** Supabase (500 MB storage / 5 GB egress — hit 397%
  egress and throttled the site; never point production back), Neon 0.5 GB, Vercel
  Postgres 256 MB. Hosted DB is ~780 MB; local crawler DB is 9.3 GB (`mr_program` 5.3 GB).
- **Promotion:** nothing in either program promotes a site. Traffic = SEO on the program
  pages, `reddit-leads`, directories/forums — all free, none in the pack.
