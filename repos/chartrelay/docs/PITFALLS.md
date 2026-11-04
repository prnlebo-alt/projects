# Pitfalls

SQLite is deliberately used to make this MVP runnable without external services. A single persistent container is fine. Ephemeral or horizontally scaled serverless instances are not. Migrate to managed Postgres before scaling out.

Per-IP rate limits (login, sign-up, reset, demo) take the client address from `X-Forwarded-For`, counting `TRUSTED_PROXY_HOPS` entries from the right (default 1). Proxies such as Railway, Fly, and nginx with `proxy_add_x_forwarded_for` append the address they saw to whatever the client sent, so only the rightmost entries are trustworthy; the leftmost one is attacker-chosen. Set `TRUSTED_PROXY_HOPS` to the number of proxies in front of the app. If the app is reached directly, set it to `0`: the header is ignored and every client shares one bucket. Expired rate-limit rows are pruned automatically. Sign-up still reveals whether an email is registered ("An account already exists"), a deliberate usability trade-off; login and password reset do not.

Login blocks 10 failures per account from one IP, and slows (rather than blocks) an account that sees many failures from many IPs, so nobody can lock a real user out by guessing wrong on purpose.

All rate limits, including the demo playground's, live in the SQLite `rate_limits` table. They hold on one server, not across instances. Move them to shared storage before scaling out.

Rendered asset URLs are public and immutable. This is convenient for email and reports, but wrong for sensitive customer data. Add signed, expiring URLs or authenticated delivery before accepting private datasets.

The chart QA engine catches structural mistakes. It cannot know whether the source data is true, whether the metric definition changed, or whether the selected time window is manipulative. Never market it as factual verification.

The current renderer intentionally supports a narrow schema. Do not recreate the entire Chart.js option tree. Complexity would destroy the clean agent-facing contract.

Billing state is only as current as the last processed webhook. Checkout double-checks Stripe before creating a session, but the dashboard reads local state. If webhook delivery is broken, plans will not change; watch failed deliveries in the Stripe Dashboard. The local `stripe listen` signing secret and a deployed endpoint's secret are different values.

Stripe Tax is intentionally off. Do not enable `automatic_tax` until the business confirms its tax registrations and collection obligations.

Do not keep this project in an iCloud Drive-synced folder (such as `~/Documents` with "Desktop & Documents" enabled) on a nearly full disk. macOS evicts synced files to reclaim space, leaving dataless placeholders. Every read then waits on a download: Vitest took about 80 seconds to import three test files, and oxlint hung indefinitely on blocked `read()` calls. `node_modules`, `.next`, and `.data` carry the `com.apple.fileprovider.ignore#P` extended attribute so they are never synced. Do not set that attribute on a folder whose files are already evicted, because it makes their content unreachable. The durable fix is to keep the repository outside iCloud Drive (for example `~/Projects`), or to free disk space and disable "Optimize Mac Storage". Excluding the project also keeps `.env.local` from being uploaded to iCloud.
