# Private sentence library

The PWA keeps the existing Worker as the shared device store. Open the PWA with
the same sync code on both devices. Before switching, check **설정 → 동기화 진단**
for the last successful sync and wait for pending changes to save. The PWA
refreshes on launch, when returning to the foreground, and periodically while
idle. An active study session or open editor postpones refresh. Offline edits
are saved locally and retried with backoff.

The application repository is public. Keep the sentence catalog and proposals
in a separate **private** GitHub repository. Give access only to the people and
connectors that need the sentences. Keep its visibility private as old Git
commits can contain earlier sentences and corrections. Check text and category
names for personal details before enabling export. The exporter omits learner
profile metadata and rejects known credentials, but cannot identify personal
details typed into arbitrary sentence text.

## One-time GitHub setup

1. Create a private repository with a default branch. Copy
   [private-sentence-library.yml](examples/private-sentence-library.yml) into its
   `.github/workflows/private-sentence-library.yml`.
2. Set the Actions variable `MEMORY_APP_EXPORTER_REF` to the full, reviewed
   exporter commit SHA from the application repository. Set the Actions secret
   `MEMORY_APP_SYNC_CODE` privately. Give that workflow permission to write
   contents of the private repository. If branch rules require a PR, run the
   local command below in a private branch and open a private PR.
3. Keep the workflow dispatch-only. It reads Worker data and verifies the
   private destination before publishing the filtered catalog.
4. Connect the private repository to ChatGPT's GitHub connection and give Codex
   authorized read access. Confirm that both can read the two files below.

## Before every sentence task

Run `node scripts/refresh-sentence-task.cjs` from the application checkout
using GitHub credentials with Actions write and private contents read access.
The workflow reuses the existing Worker secret. The helper waits for the
exact run and verifies the published receipt and catalog hash at one private
commit. Stop the sentence task on failure. Earlier catalogs cannot be used.

The standard GitHub app in ChatGPT offers read access. For dispatch from chat,
use Codex, or configure the GitHub Enterprise app template where available.
A private GPT Action can also call the GitHub API directly with scoped
credentials. These options require setup and may ask for user approval.

## Files to reference

- `memory-library/status.json` records the last successful Worker fetch as
  `checkedAt`, the catalog SHA-256, the count, and the workflow run identity.
  Use the receipt from the current sentence task's run.
- `memory-library/catalog.json` lists active linked and independent cards.
  Each contains a stable `id`, English `en`, Korean `ko`, `context`,
  `priority`, `category`, and optionally a public `templateKey`.
  Use the entire list for duplicate checks. In `history`, use
  `userEdited: true` and `beforeKnown: true` for before/after preference
  analysis. Keep older unknown baselines and automated changes out of that
  analysis. Conflicting variants can appear in history and do not prove a
  preference. The current card value is the app's current projection.
  Device IDs, full card snapshots, review timing, answer history, statistics,
  settings, and credentials are outside the export schema.

## Proposals from ChatGPT or Codex

Keep proposed sentences in the private repository, for example
`memory-library/proposals.json`. Use the current catalog as the proposal
baseline. In the PWA choose **설정 → 비공개 문장 변경 가져오기**, select the file,
and review any conflict in Settings. Import on one device and allow it to
sync before switching. The public PWA has no GitHub credential and cannot
pull the private repository automatically.

The update schema uses `id`, `before`, and `after`. For an addition, use `before: null` and supply the new English and Korean fields in `after`.

Use a fresh UUID for each proposed addition and reuse it for retries. Include
only changed fields in an update, with both the old and proposed values.
Supported fields are `en`, `ko`, `context`, `priority`, and `category`.
An empty category means unassigned. Import does not delete cards or include
any study data. It suppresses duplicate normalized English and preserves
existing IDs and schedules. If a current app value and proposal both changed
from the baseline, Settings shows both variants for manual resolution.

## Backup and remaining limits

Before changing devices or applying a large batch, download an encrypted or
device-protected backup via **설정 → 데이터 백업 / 복원**. Keep it separately
from GitHub. Restore from that screen only after confirming the backup date
and taking a new backup. Use local-only mode to inspect an older backup
before reconnecting it to a shared Worker profile.

The current Worker replaces snapshots through get/set. Rechecking and retrying
reduces races during device handoff but cannot guarantee atomic multi-device
writes. Fully automatic private imports would require a server-side, scoped
read-only GitHub credential and a protected proposal endpoint. An atomic
conditional write would require control of the deployed Worker source and its
storage binding. Neither credential belongs in the public PWA.
