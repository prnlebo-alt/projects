# ChartRelay — Independent Security Review

**Scope:** authentication and sessions, password reset, API-key storage and verification, the
unauthenticated `/chart` URL endpoint, the admin surface, secrets handling, injection and output.
**Reviewer:** independent; did not build this system. No code was changed.
**Method:** source review, then reproduction — a scratch Vitest suite outside the repo resolving `@/`
against `src/`, and `curl` against a local production build (`npm run build`, standalone server on
:3200, throwaway SQLite file, throwaway secrets). Production (`https://chartrelay.dev`) received only
light read-only requests: three GETs, one unauthenticated POST to the admin route, one `/api/health`.
**Date:** 2026-09-24. Reviewed at commit `2da4158`.

---

## Verdict

This codebase is in better security shape than most pre-revenue SaaS I have read, and materially
better than its own risk profile requires. The primitives are right: sessions are signed JWTs in
`HttpOnly; Secure; SameSite=lax` cookies that reject `alg=none`, a wrong secret, and expiry; reset
tokens are 32 random bytes stored only as a SHA-256 hash, single-use inside a transaction, with a
one-hour window and no distinguishable "used" response; API keys are hashed, never stored or logged
in the clear, and revocation is enforced through the single lookup helper that every consumer calls;
the admin token is compared over SHA-256 digests with `timingSafeEqual`; every SQL statement is
parameterized; there is no SSRF, path-traversal or prototype-pollution surface; and I could not break
the SVG escaping in either renderer. Secrets do not escape through error paths — I looked specifically
there, and the error paths are the most carefully written code in the repository.

**I found no critical and no high-severity issue.** What I did find is three medium-severity items
and a tail of low and informational ones. Two of the three mediums are gaps in otherwise-consistent
defenses — one route missing the cross-site guard its siblings have, one anti-brute-force control that
does not survive concurrency. The third is not a bug at all but a design decision: the product's
headline feature puts a long-lived bearer credential in a URL that it then asks customers to paste
into READMEs and emails. That is the one to settle before strangers start paying, because every day
it ships makes it more expensive to change.

Taking payments from strangers is a reasonable thing to do with this code once the `/api/keys`
cross-site guard is added. The URL-key design deserves a decision, not necessarily an immediate fix.

---

## Findings

| # | Severity | Location | Attack | What it gets the attacker | Direction |
|---|---|---|---|---|---|
| 1 | Medium | `src/app/chart/route.ts:95-137`, `src/lib/charts/url.ts:123`, `src/app/docs/page.tsx:94` | The `?key=` parameter is a full API key. `/docs` shows `…/chart?…&key=cr_live_…` as the way to drop the watermark, and the whole point of the endpoint is that the URL is pasted into READMEs, email templates and Slack. Verified: the same key works as `Authorization: Bearer` on `POST /api/v1/charts`. | A key harvested from a public README, a browser history, a corporate proxy log or a CDN access log is a full workspace credential — unwatermarked renders plus write access to `/api/v1/charts` on the victim's quota. It does not reach billing, other workspaces or PII. | Sign the URL instead of bearing a credential in it: HMAC the canonical query with a per-workspace secret and carry `&sig=`. A leaked signature authorizes one chart, not the account. See "On URL signing" below. |
| 2 | Medium | `src/app/api/auth/login/route.ts:30-33` | The account-wide backoff is `await sleep(...)` per request, which does not serialize. Measured on the local build with the backoff at its 3 s maximum: **10 sequential guesses took 33.1 s; 30 concurrent guesses took 11.5 s** (3.3 s/guess → 0.38 s/guess, ~9× faster). The per-(account, IP) hard block is 10 failures, so an attacker with many source IPs multiplies that ceiling directly. | Against one targeted account: ~10 guesses per source IP per 15 minutes with the documented brake effectively removed. A credential-stuffer with a 1,000-IP pool gets ~10,000 guesses per window against a single account. bcrypt cost 12 remains the only real limiter. | Make the delay a queue rather than a sleep: serialize per account so concurrent attempts wait behind each other, or convert the backoff into a counted block once failures pass a second, higher threshold. |
| 3 | Medium | `src/app/api/keys/route.ts:8-26` | `POST /api/keys` and `DELETE /api/keys` call neither `rejectCrossSite` nor `rejectCrossSiteJson`. Verified: a request carrying `Origin: https://evil.example` and `Sec-Fetch-Site: cross-site` with a valid session cookie returned `201` and a live plaintext key, while the identical header set against `/api/account/export` returned `403`. | Only `SameSite=lax` stands between an attacker and minting API keys in a victim's session. Lax holds for true cross-site POSTs, so this is not exploitable from `evil.example` today — but SameSite is site-scoped, so an XSS or takeover on **any** `chartrelay.dev` subdomain sends the cookie, and the origin check that would have caught it is the one that is missing. This is the highest-value action in the product (it returns a live credential) and the least defended. | Add `rejectCrossSiteJson` to `POST` and `rejectCrossSite` to `DELETE`. Same fix for `/api/billing/checkout`, `/api/billing/portal`, `/api/auth/verify/resend` and the cookie path of `POST /api/v1/charts`, which are unguarded for the same reason. |
| 4 | Low | `src/app/chart/route.ts:86-93` vs `next.config.ts:36-42` | `/chart?format=svg` returns attacker-influenced SVG under the **site** CSP (`script-src 'self' 'unsafe-inline'`). The sandboxed asset CSP (`default-src 'none'; …; sandbox`) is applied only to `/api/v1/charts/:id`. Confirmed on production: `/chart` carries the permissive policy, `/api/v1/charts/:id` the strict one. | Nothing today — I could not defeat the escaping (see "Examined and sound"). But the two SVG surfaces have different blast radii for the same class of bug: an escaping regression on `/chart` is same-origin script execution on `chartrelay.dev`; on `/api/v1/charts/:id` it is nothing. | Extend the `assetContentSecurityPolicy` rule in `next.config.ts` to `/chart`, or set it in `send()` alongside the content type. |
| 5 | Low | `src/app/chart/route.ts:106,111,121` | A chart parameter containing CRLF lands in the `x-chartrelay-error` response header, which the runtime refuses. Reproduced: `GET /chart?format=svg&data=1,abc%0d%0aX-Injected:%20yes` returns **500** with `TypeError: Headers.append: … is an invalid header value` in the server log. The plain case returns the intended 400 plus a drawn refusal. | Not response splitting — the runtime blocks that, which is why it 500s. It is an availability and honesty defect on the endpoint whose whole design promise is "a refusal you can read as an image": the caller gets an empty 500 instead of the card explaining what was wrong. Trivially triggered by any unauthenticated client. | Sanitize the way `x-chartrelay-alt` already does (`.replace(/[\r\n]+/g, " ")`) before setting `x-chartrelay-error`, in all three call sites. |
| 6 | Low | `src/lib/auth/session.ts:62-65`, `src/lib/auth/account.ts:40-48` | Session revocation on password reset compares JWT `iat` (one-second resolution) against `password_changed_at`. Reproduced both directions: a reset **1.1 s** after sign-in correctly kills the old cookie (`currentAccount()` → `null`); a reset **inside the same wall-clock second** leaves it valid (`currentAccount()` → `u1`). `resetPassword` does not bump `session_epoch`, so nothing else catches it. | An attacker session created in the same second the victim completes a reset survives the reset. Winning a sub-second race that you do not control the timing of is not a practical attack; recording it because the reset path's entire purpose is to end other sessions. | Have `resetPassword` bump `session_epoch` as `clearSession` does. The epoch check in `currentAccount` is exact and already wired up; it just is not used here. |
| 7 | Low | `src/app/chart/route.ts:47,124-137` | A keyed `/chart` response is returned `public, max-age=31536000, s-maxage=31536000, immutable`. Revoking the key correctly refuses new requests (verified: `/api/v1/charts` → 401, `/chart` → watermark returns) but does not evict anything already in a CDN or mail-proxy cache. | A revoked key's unwatermarked charts keep being served by shared caches for up to a year. Revenue leakage, not a security boundary. | Accept it and say so in the docs, or shorten `s-maxage` on responses that consumed a key while leaving unkeyed ones immutable. |
| 8 | Informational | `src/lib/auth/session.ts:58-60` | `sessionUserId()` checks the JWT signature and nothing else. Reproduced: after a password reset that `currentAccount()` correctly rejects, `sessionUserId()` still returns `u1`. | Nothing — **it has no callers.** Every route uses `currentAccount()`/`requireAccount()`, which check both `session_epoch` and `password_changed_at`. This is a loaded footgun sitting in the auth module, not a live vulnerability. | Delete it, or fold the epoch and password-change checks into it so the unsafe version cannot be reached. |
| 9 | Informational | `src/app/api/admin/backup/route.ts:24,33`, `src/lib/admin/auth.ts:22-25` | The 404-vs-401 concealment is inverted: the route answers 404 only when `ADMIN_TOKEN` is **unset** — i.e. when it does nothing — and 401 once it is set, i.e. when it hands over the whole database. Confirmed on production: both admin routes answer `401` unauthenticated, which tells a prober the admin surface is live. | Confirms to an unauthenticated prober that admin backups are enabled on this deployment. Marginal; the token is 256-bit-class and compared in constant time. | If the concealment is worth having, return the same 404 for a wrong or absent token too. As written it advertises exactly the case worth hiding. |
| 10 | Informational | `src/app/api/admin/backup/route.ts:27-30` | Rate limiting runs **before** authorization: 5 attempts per 10 minutes per `clientIp`. Reproduced: three wrong tokens then the correct token → `429`. | Per-IP, so an attacker locks only their own bucket and `scripts/backup.mjs` fails loudly on 429 rather than silently skipping a backup. It becomes a real denial of the operator's only backup path if `TRUSTED_PROXY_HOPS=0`, or if `X-Forwarded-For` is absent, because `clientIp` then collapses every client into one `"local"` bucket. | Keep the pre-auth limit but give successful authorization a way past it, or key it so a shared `"local"` bucket cannot lock out the operator. |
| 11 | Informational | `src/lib/security/rate-limit.ts:55-75` | `TRUSTED_PROXY_HOPS` defaults to `1`, and the failure mode is open. Demonstrated on the local build with no proxy in front: rotating `X-Forwarded-For: 10.0.0.$i` walked past the per-(account, IP) lockout for twelve attempts and then signed in correctly with `200`, where the un-rotated run was blocked at `429`. | Nothing on the real deployment — Railway is a single appending proxy, which is what `1` describes, and `docs/PITFALLS.md` and `docs/DEPLOY.md` both state the rule correctly. It matters if a second edge (e.g. Cloudflare) is ever added without incrementing the value, which silently either collapses all clients into one bucket or reopens spoofing. | Leave the code; add `TRUSTED_PROXY_HOPS` to the deployment checklist that is re-read whenever anything is put in front of the app. |
| 12 | Informational | `src/app/api/auth/password/forgot/route.ts:31-34` | A timing side channel exists but is below the noise floor. Measured over 300 paired samples with the provider call stubbed to never resolve: median synchronous cost **0.148 ms** for a registered address vs **0.048 ms** for an unknown one — a 0.100 ms delta from `issueToken`'s two SQLite writes, which run before the first `await`. Response bodies and statuses are byte-identical; over HTTP the means were indistinguishable (1.7 ms both). | Not a practical enumeration oracle: the delta is ~100 µs against millisecond network jitter, and sampling is capped at 10/hour per IP and 3/hour per address. Recording it because the file's comment claims the un-awaited send removes the timing difference, and the token minting in front of it is what actually remains. | No change warranted. If it ever matters, mint the token for a fixed dummy user on the unknown path. |
| 13 | Informational | `src/app/api/auth/register/route.ts:62` | `POST /api/auth/register` returns `409 {"error":"An account already exists for that email."}`. Reproduced. | Email enumeration. Already documented as a deliberate usability trade-off in `docs/PITFALLS.md:5`, and login and password reset correctly do not leak. Noting it so it is not rediscovered as a finding. | None. The trade-off is defensible and written down. |
| 14 | Informational | `backups/`, `.env.local.bak` | Ten unencrypted SQLite snapshots of production sit in the working tree, each containing every user's email, bcrypt hash, API-key hashes and chart data. A plaintext copy of the secrets file sits beside them. Both are correctly covered by `.gitignore` (`.env.*` matches `.env.local.bak`); `git log --all --name-only` confirms no `.env` file other than `.env.example` was ever committed, and `git grep` finds no live-key-shaped string in tracked files. | Nothing remote. The production database now lives in a laptop directory with no encryption at rest beyond FileVault, which is an operational exposure rather than an application one. | Encrypt at rest or move the retention off the working machine. `scripts/backup.mjs` already prunes to 14 days and verifies the SQLite header, which is the hard part. |

---

## On URL signing (finding 1)

The brief asked for an honest assessment, so: **yes, URL signing would be the better design, and I would
change it before customers have URLs in the wild rather than after.**

What the current design gets right is real and should not be lost. `/chart` is unauthenticated and
unmetered; the key is *only* consulted to decide whether to draw the watermark (`entitledToUnmarked`,
`src/app/chart/route.ts:78-84`). A chart URL with no key still renders. That is a much smaller
credential surface than the obvious wrong version of this feature, and the key is genuinely never
logged, never reflected into the SVG body, and never echoed in a refusal — I checked all three against
the running build and got zero hits, including on the error path.

What is still wrong is the credential *class*. `cr_live_…` is a long-lived bearer token for the whole
workspace, and the product asks customers to put it somewhere durable and public by construction:
a README on GitHub, an email template stored in a marketing tool, a Slack message, a no-code
automation step. It will also sit in browser history, in any corporate forward proxy's access log, and
in the CDN's. `/docs` says "Never expose a production key in browser code" eleven lines above an
example that puts one in an `<img src>`. Those two sentences cannot both be followed.

The shape of the fix: keep the endpoint unauthenticated and unmetered; give each workspace a signing
secret that never leaves the server; have the studio emit `…&kid=<workspace>&sig=<HMAC of the
canonical query>`. A leaked URL then authorizes exactly the chart it draws — an attacker who scrapes
it can re-fetch that one image and nothing else. Revocation becomes rotating one secret rather than
hunting every README. The cost is that URLs can no longer be hand-edited without re-signing, which is
why this is a decision rather than a defect: hand-editable URLs are a stated product value in
`src/lib/charts/url.ts`. If that value wins, the mitigation is a *separate*, render-only key class for
the URL surface, so a scraped chart URL never grants `POST /api/v1/charts`.

---

## Examined and found sound

Recorded so the next reviewer does not re-tread it. Everything here was read and, where marked
(verified), executed.

**Sessions.** `Set-Cookie` carries `Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=lax` (verified
against the production build). `alg=none` is rejected — a `jose` `UnsecuredJWT` forged for `u1` gives
`currentAccount() === null` (verified). A token signed with a different secret is rejected (verified).
An expired token is rejected (verified). `secret()` throws on a missing or sub-32-character
`SESSION_SECRET` in production, and `instrumentation-node.ts` refuses to start the container at all
(verified). HS512 is accepted alongside HS256 because no `algorithms` allow-list is passed, which is
harmless: both use the same symmetric key, so there is no downgrade. No session fixation — the token
is server-minted on every `createSession` and is not client-settable. `session_epoch` **is**
incremented, by `clearSession()` (`session.ts:42`) and only there; `currentAccount` enforces it, so a
copied cookie dies at sign-out on every device. That is deliberate global sign-out, not a bug.

**Password reset.** 32 bytes from `randomBytes`, base64url, 43 characters (verified). Stored only as a
64-hex SHA-256 digest — the plaintext token is not recoverable from `auth_tokens` (verified). One-hour
lifetime. `consumeToken` marks used and reads inside one better-sqlite3 transaction, so the
double-submit race is closed. Issuing a second reset revokes the first unused one (verified: the first
token `peekToken`s to `null`, the second does not). A used token, an expired token and a nonsense
token are indistinguishable — all three return `null` and the route returns the same `400` string
(verified). The endpoint does not leak account existence by body or status (verified byte-identical
for a registered and an unregistered address); for timing see finding 12. A reset **does** end existing
sessions via `password_changed_at` (verified) — the "reset leaves sessions valid" hypothesis in the
brief is false except for the sub-second window in finding 6.

**API keys.** `cr_live_` + 24 random bytes base64url. Stored as SHA-256; the lookup is a hash-to-hash
index match, so no constant-time comparison is required — timing cannot reveal anything about a
preimage the attacker would still have to find. The `prefix` column is display-only; it is **not** used
for lookup (`api-keys.ts:24-27`). `findApiKey` is the single lookup and filters `isNull(revokedAt)`, so
revocation is total: after revoking, `POST /api/v1/charts` → `401` and `/chart?key=` → watermark
restored (both verified). `DELETE /api/keys` checks workspace ownership before revoking. The key is
returned exactly once, at registration and at creation, with an explicit one-time notice.

**Login.** Unknown emails cost the same as wrong passwords — `authenticate` compares against a real
cost-12 dummy hash. Only failures are counted; the hard block is per (account, IP) so a remote attacker
cannot lock the real owner out. `rejectCrossSiteJson` is applied. bcrypt cost 12. (The backoff weakness
is finding 2; the per-(account, IP) lockout itself works — verified: ten failures then `429` on the
correct password.)

**Admin surface.** `authorizeAdmin` compares SHA-256 digests with `timingSafeEqual`, so length and
prefix do not leak through exit time, and the digests are always 32 bytes so it cannot throw. Fails
closed on an unset, short or non-string token. The scheme is parsed case-insensitively per RFC 7235.
`VACUUM INTO ?` uses a bound parameter against a server-generated `mkdtemp` path — no interpolation,
no user input, and the temp directory is unlinked before streaming so it cannot outlive the request.
Errors return a generic body; the SQLite message never reaches the client. The log line is
`backup served <n> bytes` and nothing else. **I could not make the backup endpoint leak.**

**Secrets in error paths.** This is where I expected to find something and did not. `logStripeError`
emits only type/code/requestId. `billingConfigProblems` and `emailConfigProblem` describe the problem
without the value. `productionConfigReport` never includes values. `scripts/check-env.mjs` prints only
a recognized non-secret prefix and a length. The registration, session, chart-render and PNG failure
paths log `error.message` only. A keyed `/chart` request appears nowhere in the server log (verified:
zero matches for the key across the whole log after a successful keyed render, a refusal, and a 500).

**Injection and output.** `escapeXml` (`render.ts:36`) escapes `< > & " '` and runs `stripInvalidXml`
first; `stripInvalidXml` (`render.ts:24-34`) drops C0 controls except tab/LF/CR, U+FFFE/U+FFFF and lone
surrogates, iterating by code point so surrogate pairs are handled correctly. `editorial.ts`'s `esc`
escapes only `& < >` — I checked every call site and it is used in exactly one place (`editorial.ts:152`),
as element *content*, where unescaped quotes are inert. Attribute values are theme constants, numbers
formatted through `toFixed`, or `series.color`, which is regex-constrained to `#RRGGBB`. Verified by
attack: `<script>`, `"><script>`, `<img src=x onerror=…>`, `</text><script>` and an HTML-entity-encoded
payload injected through `title`, `labels`, `names`, `source` and `note`, against both the editorial and
classic renderers — zero `<script` or `<img` elements in any output; payloads appear only as escaped
text. Prototype pollution: `__proto__` and `constructor.prototype` keys via the base64 `spec=`
parameter, via query keys and via the JSON body of `POST /api/v1/charts` all returned normally and
polluted nothing observable in a subsequent response (verified). No SSRF — the only outbound `fetch` in
`src/` is the hard-coded Resend endpoint. No path traversal — `/api/v1/charts/..%2f..%2f..%2fetc%2fpasswd`
returns `404`, and the id is a bound SQL parameter. Every statement in the codebase is parameterized,
including the one raw `LIKE` in the delete path, which escapes its pattern.

**Elsewhere.** The Stripe webhook verifies the signature against the raw body before any parse, and
`stripe_events` gives replay idempotency. `rasterize` caps input at 2400×1600 pixels and serializes to
two concurrent rasters, so the unauthenticated PNG path cannot starve the server. `readJsonBody` caps
at 256 KB by `Content-Length` and again while streaming. `parseChartQuery` caps the query at 8 KB.
`/api/health` reports only `ok`/`error`. `/api/account/export` explicitly excludes the SVG text and PNG
blob columns and is byte-budgeted. Account deletion requires the email *and* the password, refuses
while Stripe shows anything non-terminal, and fails closed when Stripe cannot be reached. `/api/v1/charts/:id`
is unauthenticated by design but keyed by a 14-character nanoid (~84 bits), which is not enumerable.

---

## What I would fix first

**Finding 3 — add the cross-site guard to `/api/keys`.** It is a two-line change, it costs nothing, and
it closes the one route that hands out a live credential and currently has a single layer of defense
where every comparable route has two. Do findings 2 and 5 in the same pass; both are small.

Then settle finding 1 deliberately, before customers have chart URLs embedded in places you cannot
reach. It is the only item here that gets more expensive the longer it ships.

---

## Reproduction notes

- Local build: `npm run build`, then the standalone server on `:3200` with a throwaway
  `DATABASE_PATH`, a throwaway `SESSION_SECRET` and a throwaway `ADMIN_TOKEN`. No real secrets, no real
  database, no real Stripe or Resend call was made at any point.
- Scratch Vitest suite lived outside the repo, with `resolve.alias` pointing `@` at `src/` and
  `DATABASE_PATH=:memory:`. No file under `src/` or `tests/` was modified, and nothing was committed.
- Production received five read-only requests total. Nothing intrusive, no writes, no brute forcing.

**Nothing in this report is unverified.** Every finding was reproduced against running code except the
subnet-scale versions of findings 2 and 11, where the mechanism — not the full-scale attack — was
demonstrated: the concurrency measurement in finding 2 is real (33.1 s vs 11.5 s), and the
`X-Forwarded-For` rotation in finding 11 is real against a build with no proxy in front, which is the
misconfiguration it describes rather than the production topology.
