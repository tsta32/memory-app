# Codex repository workflow

## Cloud review-only sync

For cloud automation of app-to-template sync, use
`npm run sync:app-templates:review`. This is a separate strict review path;
it does not recover or reproduce an unavailable historical commit.
`MEMORY_APP_SYNC_CODE` supplies the GitHub Actions Secret. When the variable is
absent, the existing private local setup file is used. An empty or malformed
environment value fails instead of falling back. Never print credentials,
commit private snapshots/backups, or pass the Secret to test steps.

The command performs only a fresh Worker `get`, checks snapshot completeness,
recomputes causal conflicts, and requires matching direct user edit evidence
for each changed field. It refuses deletion requests, ambiguous identities,
missing/cyclic history and unverified values. It never calls Worker `set`,
commits, pushes, or changes learning records. Do not use the old patch CLI's
`--push` path for this workflow: that path targets main.

`.github/workflows/sync-review.yml` supports manual and hourly execution at minute
17. It isolates changes, skips commits/PRs for no-op plans, runs the full suite,
re-reads the Worker after tests and reuses identical tested PRs. Never clean or
publish existing untracked files. Worker access remains get-only.

`AUTOMERGE_ENABLED` is a literal false in the workflow. Keep it off until live
Secret, Pages permissions, branch-rule behavior and an isolated end-to-end
canary have been reviewed. Do not change repository settings or Secrets to
bypass it. Do not automatically merge this implementation PR.

The gated path verifies the exact tested tree/head/base and permitted files,
checks a Pages build of current main, then uses a non-forced fast-forward ref
update with both known parents. Concurrent main changes reject the merge.
Legacy Pages from main/root is explicitly built and its SHA/public files are
verified. Unsupported Pages configuration fails before merge; never change it
implicitly. Deployment after merge is a separate external operation: record
post-merge failures and retry only a verified managed merge. Never force-rewrite
main to pretend it was unchanged. See docs/review-app-sync.md for release checks,
limitations and native Actions notifications.

For a managed cloud environment with restricted browser downloads, an installed
Chromium may be selected with
`MEMORY_APP_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test`.
Otherwise install the pinned Playwright browser using
`npx playwright install --with-deps chromium`. Browser tests use isolated
fixtures, not an existing user browser profile.

## App-owned business card data

Before inspecting, editing, or regenerating `general_business_english_literal_ko.json`, `business-contexts.js`, or `business-priorities.js` for a task involving templates, contexts, or priority grades, run this first from the repository root:

```sh
npm run sync:app-templates
```

This command fetches a new, complete snapshot from the existing authenticated Worker `get` API and safely applies template-linked user edits locally. App edits to English, Korean, context, and priority take precedence over repository defaults. It checks card IDs and edit-history template keys before content; English-string equality by itself is never an identity link. If template IDs are absent, a stable ID-to-template mapping is accepted only when at least 199 of 200 template-linked cards prove one unique sequence offset. Unlinked-card details and a per-field comparison of all 200 templates are saved outside Git at `~/.config/memory-app/latest-app-card-analysis.json` with mode `0600`. The report separates independently categorized cards from stable-ID candidates and marks import-only content differences unverified; those differences stop export instead of being overwritten. It creates a private pre-change backup outside Git. It does not call Worker `set`, push to GitHub, or change SRS/review statistics.

If the Codex runtime cannot reach the Worker, do not reuse a saved snapshot or continue with repository defaults. Ask the user to run the same fetch/apply process from a normal Linux terminal in this checkout:

```sh
npm run sync:app-templates:local
npm run sync:app-templates:verify-local
```

The local command uses the same private sync-code file and existing Worker `get` endpoint; it writes the merged templates and a private receipt HMAC-signed with that local secret, bound to the fetched snapshot hash and starting Git commit. Before resuming, run the receipt verifier, inspect the local template diff, and confirm its timestamp is from this task. A failed or interrupted run leaves no valid completed receipt. If the terminal cannot access this same checkout, do not treat a snapshot file alone as proof of current data; arrange a safe checkout transfer instead.

Use `npm run sync:app-templates -- --dry-run` when comparison only is needed. Dry-run still performs a fresh authenticated read; it never uses the last saved snapshot as a fallback.

If the command exits nonzero, reports a conflict, cannot fetch a complete current snapshot, or reports unreviewed context, stop template/priority work. Do not use a previous snapshot or repository defaults as a substitute for current app data. Report the exact failure and request only the minimum user action needed to restore authenticated read access or resolve the conflict. Do not alter Cloudflare Worker code or settings.

After syncing, inspect the detailed card-analysis report when there are unlinked cards or template mismatches. Resolve stable-ID candidates only when edit provenance establishes the app value; otherwise report the card ID, mapped template key, differing fields, and evidence as an unresolved conflict. Do not merge independent cards from another category into a template. Continue the requested edit, run relevant tests, inspect the resulting template diff, then commit and publish only when authorized by the task. Never include the private sync secret, snapshot, analysis report, or backup files in Git.

## Priority classification data

If essential-priority criteria or classification schema changes, update `docs/business-priorities.md`, `business-priorities.js`, and their tests together. Do not invent a reason or coverage purpose for a newly essential or content-edited card; leave it marked for review until an explicit assessment is saved.

## Live release validation

Keep AUTOMERGE_ENABLED false unless actual read-only audit, Actions permission
probe and separate-repository Pages canary have succeeded and their results have
been reported. The read-only audit writes only sanitized booleans/counts/public
Git metadata as evidence, never snapshots. The one-time permission probe may use
only its own sync-permission-probe refs; never production main or Pages. The
canary is hard-bound to tsta32/memory-app-sync-canary, uses synthetic data, and
must never receive a Worker Secret. If that repository or administrative setup
is unavailable, complete safe work and report the precise missing prerequisite;
do not substitute mocked tests or connector credentials for Actions-token proof.
