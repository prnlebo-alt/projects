# Vercel Integration Status — Investigation

Second independent-review round, defect #5 ("Investigate the current Vercel
status pointing at cosmic-unwind-live... document whether the GitHub
integration is stale and what should be disconnected").

**Scope of this investigation:** repository-side evidence only. This session
has no Vercel API access or dashboard credentials, so nothing on the Vercel
side (project settings, deployment history, GitHub App installation) was
read or changed. Nothing external was modified or deleted, per instruction.

## What the repository shows

- No `vercel.json`, `.vercel/`, or Vercel-specific config exists anywhere in
  the current tree (verified: `find . -iname ".vercel"` and a repo-wide
  grep for `vercel`/`cosmic-unwind` outside `node_modules` and
  `package-lock.json` both return nothing relevant — the one lockfile hit is
  `@vercel/postgres` listed as an **optional peer dependency of
  `drizzle-orm`**, never installed, unrelated to any live integration).
- Commit history confirms this repository previously hosted an unrelated
  app named "Cosmic Unwind" at the repo root (`app/`, `components/`,
  `public/`, `supabase/`, `middleware.ts`, `agents/vercel-deploy-agent.md`).
  Commit `af766f1` ("Add Vercel deployment agent workflow") added an
  internal deploy-agent prompt file for it — not a GitHub Actions workflow;
  no `.github/workflows/*` of any kind existed in this repository before
  the Phase 1 CI workflow added in this same change (defect #4).
- Commit `85d5d85` ("Remove Cosmic Unwind app; scaffold Market Intelligence
  v1.0 repo shape") deleted every file belonging to that app, including
  `agents/vercel-deploy-agent.md`, and replaced the repo with the current
  Market Intelligence monorepo shape (`/apps/{web,worker}`,
  `/packages/*`). The one thing that survived is the *name*: `apps/web` is
  a fresh Next.js App Router project at a different path (`apps/web/app`,
  not the old root-level `app/`).

## What this means for a Vercel project named "cosmic-unwind-live"

If a Vercel project by that name is still connected to this GitHub
repository (via Vercel's GitHub App, configured outside this repo and not
inspectable from here), it was almost certainly configured against the old
root-level `app/` structure. That structure no longer exists at all — the
repository's entire shape changed in `85d5d85`. Consequences, best judged
from the repo side:

- **If push-triggered auto-deploy is still enabled**, every push to `main`
  now triggers a build against a tree with no root-level Next.js app,
  which either fails outright or (if Vercel falls back to some cached/
  stale configuration) produces a meaningless build — neither outcome is
  useful, and either wastes build minutes and/or leaves a misleading
  "cosmic-unwind-live" URL serving content that has nothing to do with
  what this repository now is (a Phase 1 evidence-engine backend with no
  public web deployment target at all — `apps/web` is a minimal
  placeholder, not something intended to ship to that URL).
- **The integration reads as stale**, not intentionally retired: nothing in
  the repository disconnected it when the app was removed — that step, if
  it was ever done, happened on the Vercel side, which this session cannot
  see.

## Recommendation (not executed — requires a human with Vercel dashboard access)

1. A repository admin should open the Vercel dashboard for the
   `cosmic-unwind-live` project and check whether its GitHub integration
   (this repo) is still active.
2. If it is: **disconnect the GitHub integration** for this repository (Git
   tab → Disconnect, or remove the repo from the connected Git provider),
   so pushes to `main` stop triggering builds against a codebase that no
   longer has anything for it to build.
3. Whether to **delete the Vercel project entirely** (vs. just
   disconnecting Git) is a judgment call for whoever owns it — e.g. if the
   URL is bookmarked/shared anywhere, disconnecting first (leaving the last
   successful deployment as a static snapshot) is the reversible option;
   deleting is not.
4. This repository does not currently need any Vercel deployment target —
   `apps/web` is a Phase 1 placeholder (ARCHITECTURE.md: "minimal admin UI
   after intelligence quality passes", Phase 7). No new Vercel project
   should be wired up for it until that phase.

No action beyond this write-up was taken against the external Vercel
project, per instruction not to modify or delete it without explicit
authorization.
