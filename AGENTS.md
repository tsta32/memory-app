# Codex repository workflow

## App-owned business card data

Before inspecting, editing, or regenerating `general_business_english_literal_ko.json`, `business-contexts.js`, or `business-priorities.js` for a task involving templates, contexts, or priority grades, run this first from the repository root:

```sh
npm run sync:app-templates
```

This command fetches a new, complete snapshot from the existing authenticated Worker `get` API and safely applies template-linked user edits locally. App edits to English, Korean, context, and priority take precedence over repository defaults. It creates a private pre-change backup outside Git. It does not call Worker `set`, push to GitHub, or change SRS/review statistics.

If the Codex runtime cannot reach the Worker, do not reuse a saved snapshot or continue with repository defaults. Ask the user to run the same fetch/apply process from a normal Linux terminal in this checkout:

```sh
npm run sync:app-templates:local
npm run sync:app-templates:verify-local
```

The local command uses the same private sync-code file and existing Worker `get` endpoint; it writes the merged templates and a private receipt HMAC-signed with that local secret, bound to the fetched snapshot hash and starting Git commit. Before resuming, run the receipt verifier, inspect the local template diff, and confirm its timestamp is from this task. A failed or interrupted run leaves no valid completed receipt. If the terminal cannot access this same checkout, do not treat a snapshot file alone as proof of current data; arrange a safe checkout transfer instead.

Use `npm run sync:app-templates -- --dry-run` when comparison only is needed. Dry-run still performs a fresh authenticated read; it never uses the last saved snapshot as a fallback.

If the command exits nonzero, reports a conflict, cannot fetch a complete current snapshot, or reports unreviewed context, stop template/priority work. Do not use a previous snapshot or repository defaults as a substitute for current app data. Report the exact failure and request only the minimum user action needed to restore authenticated read access or resolve the conflict. Do not alter Cloudflare Worker code or settings.

After syncing, continue the requested edit, run relevant tests, inspect the resulting template diff, then commit and publish only when authorized by the task. Never include the private sync secret, snapshot, or backup files in Git.

## Priority classification data

If essential-priority criteria or classification schema changes, update `docs/business-priorities.md`, `business-priorities.js`, and their tests together. Do not invent a reason or coverage purpose for a newly essential or content-edited card; leave it marked for review until an explicit assessment is saved.
