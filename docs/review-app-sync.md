# Hourly app template sync

The workflow retains manual execution and adds `17 * * * *` (UTC). Scheduling
starts after this implementation is merged into the default branch. GitHub may
delay scheduled runs. This extends PR #1; historical commit 9df012d was not recovered.

## Release state

**Automatic merging remains disabled.** `AUTOMERGE_ENABLED` is a literal `false`
in the workflow, not a dispatch input or repository variable. Until a reviewed
follow-up enables it, verified changes produce a tested PR only. This change does
not modify repository settings, Worker code/settings, Secrets or learning data.

## Read, validate and test

- Switch from main to an isolated candidate branch before applying any change.
- Reuse `MEMORY_APP_SYNC_CODE` for a fresh Worker get only. The existing local
  credential-file fallback remains available when the variable is absent. Empty
  or malformed values fail. Credentials are never printed or supplied to tests.
- Check complete snapshots, causal ancestry, entity/card/template IDs, direct
  user evidence matching each changed field, duplicate identities and conflicts
  recomputed from history. Unknown provenance, ID mismatch and deletion requests
  stop before local writes. Historical deletion events also stop automation.
  Independent cards from other categories are not imported into business templates.
- An unchanged plan exits without file writes, commit or PR, skipping browser
  installation/tests. Changed candidates get private template backups and run
  every unit script and all 68 isolated browser tests.
- Re-read the Worker after tests and compute the same plan against the original
  templates in a private receipt. Changed edits abort publication. Changes only
  to SRS/review records do not invalidate the plan and never modify those records.
  SHA-256 hashes also reject any unexpected local template changes after planning
  or testing, immediately before publication.

Snapshots remain immutable. IDs, SRS, due dates, review/error records, statistics,
edit history and app user values are never written by this automation. Private
receipts/backups stay in runner temp and are cleaned even on failure. No snapshot
or credential artifact is uploaded. Logs contain counts, safe error codes and
Git SHAs, never credentials or private card text.

## Idempotence and races

One concurrency group serializes manual/scheduled executions through deployment.
A canonical base/changes fingerprint selects an immutable branch named
`sync/app-templates-<32 hex digits>`. Identical retries reuse its PR only when
its parent and tree match. Closed or altered PRs fail instead of being overwritten.
Only three template files are staged; existing untracked files are preserved.
No forced branch updates are used. Main advancement requires new validation.
Proposals based on an older main are retained for review rather than force-updated.
Token-generated PRs may not trigger another CI run, so the full suite runs directly
before publication. GitHub Actions must be allowed to create PRs; failure never
causes a fallback token or an implicit settings change.

## Gated merge and Pages

The disabled production path verifies PR state, draft/mergeability, repository,
head/base SHAs, the tested tree, one expected parent, and only modified allowlisted
files. Before touching main it requests and verifies a Pages build of current main,
proving build permissions/configuration. It constructs a merge commit containing
exactly the tested tree and both known parents, then requests a non-forced ref
update. A concurrent main edit rejects this fast-forward instead of merging an
untested base. Branch protection is respected. GitHub must recognize the PR as
merged with this exact commit; otherwise the run fails visibly.

Existing branch-based (`legacy`) Pages from main/root is supported. Other modes
fail before merge; the workflow never changes Pages settings. An explicit Pages
build is requested because a GITHUB_TOKEN merge may not start Pages by itself.
Polling verifies build success and the exact merge SHA, followed by SHA-256 checks
of all three public template files. Public requests carry no authentication.

**Git merge and Pages deployment are not one atomic transaction.** Pre-merge
failures leave main unchanged. A Pages outage after merge cannot mean main never
changed. The run fails without force-rewriting history. On a later no-difference
run, the enabled path checks/resumes only a current managed merge with matching
parents and merged PR. It never redeploys an old commit over newer main work.
Already successful builds are reused; public content is still checked.

## Before enabling automatic merging

Keep the gate off while reviewing this PR and its mock/CI results. Confirm the
existing Secret through an authorized read-only canary on reviewed code. Confirm
PR creation, legacy Pages main/root configuration, build permissions, public-file
verification, branch-rule compatibility and exact-tree merge recognition in an
isolated test repository. Review the non-atomic boundary above. Enable the literal
gate only in a separate reviewed change after those checks. No production
merge/deployment canary or Secret configuration is performed in this task.

## Existing notifications

Errors use nonzero exit status, Actions annotations and the run summary, covering
authentication/planning, tests, changed snapshots, PR/head/main races and Pages
errors/timeouts. GitHub Actions' existing email/web failure notifications are the
available notification mechanism; delivery depends on user settings and scheduled
workflow ownership. Review GitHub Settings → Notifications → Actions and repository
notification preferences. No email, Slack message, webhook, Issue or extra Secret
is created. The ordinary Tests workflow remains independent of the Worker Secret.

## Developer checks

`npm test` includes temporary bare-repository fixtures and a mocked GitHub API:
no-op, test gates, untracked preservation, PR reuse/mismatch, Pages permissions,
main races before/during ref update, exact-tree merge, deployment SHA/content and
safe resume. Worker fixtures check edit changes during tests, study-only updates
and post-integration no-op. These do not prove live credentials or production readiness.

Managed cloud: `MEMORY_APP_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test`.
Actions pins Ubuntu 24.04 and installs the pinned Playwright browser. All browser
profiles and Worker responses are fixtures. Validate workflow syntax with actionlint.

## Automatic operational validation

`sync-live-validation.yml` adds an hourly read-only audit at minute 37 and an
automatic audit on relevant main changes. It uses the existing Secret only in
its Worker read step, checks the latest plan without applying it, and verifies
current Pages build SHA and public template hashes. Its evidence artifact contains
only fixed booleans, counts and public Git metadata. A successful metadata read
or reported token scope is not proof of PR/merge write permission, and an audit
alone never sets `automerge_eligible` to true.

For this implementation branch only, a separate automatic job proves the actual
Actions token's PR/ref-merge rights on `sync-permission-probe/*` base/head refs.
The test adds a disposable marker, never edits production main or app templates,
never contacts the Worker and never changes or rebuilds production Pages. Its
merged PR is evidence of the exact-tree merge-recognition mechanism, not an
end-to-end Pages canary. The job is not repeated by normal hourly/main execution.

`sync-canary.yml` and `sync-canary.cjs` provide the real end-to-end proof in exactly
`tsta32/memory-app-sync-canary`. Both reject production; the script also refuses
any Worker Secret. They generate a synthetic direct edit, run the complete suite,
create/merge a real PR with that repository's Actions token, request its Pages
build and compare its public files with the merged tree. No Worker call is made.
The resulting artifact includes the automation source-code hash so proof cannot
be silently substituted from a different implementation.

One-time prerequisite: an isolated repository/site must exist and be connected.
Initialize it on main, configure legacy Pages from main/root, permit Actions PR
creation, and connect it to the GitHub app. This chat's connection can access only
memory-app and cannot create repositories or change Pages settings. No Secret
needs copying to the canary. Once connected, publishing the reviewed code to that
repository starts the canary automatically; recurring Run workflow actions are
not required. Do not enable production until its proof and the production audit
and permission probe have actually succeeded and been reported.

Regression tests now compare isolated patch results against current baselines
instead of freezing every historical phrase or grade count. Authored metadata
may be honestly empty after a user content edit; no new reason or coverage is
invented. Planner/UI tier scenarios use explicit synthetic grades, while source
migration still checks the real template distribution. This changes test fixtures,
not classification criteria, templates, app runtime or user records.

## Recorded operational evidence (2026-11-08)

Run https://github.com/tsta32/memory-app/actions/runs/42441097985 tested code
8d9ded9 against production main 7e1dca9 using the existing Actions Secret:

- Worker get succeeded, strict provenance checks passed, verified change count
  was zero, and the read-only audit finished successfully without local apply.
- Legacy main/root Pages configuration, current successful build SHA and all
  three public template hashes were verified. This is production read-only
  verification, not a separate-repository deployment canary.
- The Actions token created both disposable probe refs, proving ref write access.
  Its subsequent PR creation request was rejected with HTTP 403. Thus actual
  merge recognition could not be exercised with that token. Connector-created
  PRs are not a substitute for an Actions-token permission proof.
- An actual isolated Pages canary has not run: this connection has no separate
  repository and cannot create one. The harness's synthetic candidate passed
  all 10 unit scripts and 68 browser tests locally; this is not live Pages proof.

AUTOMERGE_ENABLED remains false. Before activation, an administrator must check
Settings → Actions → General → Workflow permissions → “Allow GitHub Actions to
create and approve pull requests,” including any overriding organization policy.
Then provide/connect the isolated canary repository/site described above. No
PAT, Secret value, snapshot or additional credential should be supplied in chat.
The agent can retry the failed permission job after that one-time configuration;
normal hourly operation does not require pressing Run workflow or reading logs.
