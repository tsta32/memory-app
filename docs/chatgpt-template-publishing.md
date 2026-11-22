# ChatGPT ↔ app template publishing

The user edits sequentially, not concurrently. Two distinct write paths share the three template files on GitHub:

1. **App → GitHub:** App changes persist in the existing Cloudflare Worker. The scheduled `sync-review.yml` reads authenticated Worker data, verifies direct user-edit provenance, tests the exact candidate, and merges/deploys when its release gate permits. Never write to Worker from GitHub.
2. **ChatGPT → GitHub → app:** For an explicit user request to add or edit learning templates, ChatGPT reads the current repository and submits a same-repository PR touching only the intended template files. GitHub Pages deploys after merge. This is **not** a continuous chat export: each requested publication requires a ChatGPT GitHub write.

## Required order for a ChatGPT edit

- Check that the latest app-to-GitHub scheduled sync has completed. If pending user edits or a conflict exists, stop; do not overwrite app-owned fields.
- Before editing any template file, run `npm run sync:app-templates` with fresh authenticated Worker GET, per `AGENTS.md`. A connected GitHub file reader is **not** a substitute for the Worker snapshot. If the authenticated read cannot be performed, do not publish a template change.
- Preserve existing template keys, stable card identities, category, SRS, stats, and user edits. Add only requested content; do not rewrite all 200 existing entries or invent essential-priority assessments.
- Create a feature branch and PR, never directly edit `main` for ChatGPT-authored templates.
- The `chatgpt-template-pr.yml` check performs a second fresh Worker GET and rejects a PR when its templates are stale relative to app edits. Run all unit and browser tests. If the Worker cannot be read, the check must fail closed.
- Review the PR diff and checks before merging. The ordinary GitHub Pages deployment then serves the updated files. Confirm public Pages content and app loading after the first real change.
- A later app edit follows the existing app-to-GitHub path. If an app-side edit refers to an obsolete template baseline, do not force an overwrite; reconcile it using verified edit history.

## Limitations

This PR adds a safety validation workflow and publishing procedure, **not** a ChatGPT background daemon, automatic PR merger, or a new Worker API. The first real ChatGPT-created template publication and its Pages/app display remain to be verified. GitHub Pages delivery alone does not prove the client loaded a new template; test that separately.

Never log or commit Worker credentials, snapshots, private receipts or backups. No Worker SET, destructive reset, force push or broad replacement of template arrays.
