# Review-only app template sync

This implementation was rebuilt from main (`8b6cd10`). The historical local
commit `9df012d` was unavailable and was not recovered.

## Running locally

`npm run sync:app-templates:review` reads a fresh complete snapshot using Worker
`get`, then applies verified template changes to the local checkout only. It
uses `MEMORY_APP_SYNC_CODE` when that variable exists; otherwise it uses the
existing private local credential configured by `sync:app-templates:setup`.
An empty environment variable fails instead of falling back. Do not put a
credential in command arguments, repository files or logs.

The strict path rejects deletion requests, supplied or recomputed conflicts,
duplicate identities, incomplete/cyclic event ancestry, and changed fields
without a matching direct user event (entity, card ID, template identity,
field, value, device and timestamp). Legacy imports and derived context events
are not direct user evidence. Historical deletion events also stop automation,
even after a later restoration; resolve those cases manually. Each original
template file is backed up privately before local writes. The input snapshot
and all study statistics remain unchanged. No snapshot is uploaded as an
artifact, and no Worker `set` is used.

## GitHub Actions

The ordinary **Tests** workflow runs unit and isolated browser tests without
the Worker Secret and with read-only repository permission.

**Review app template sync** is manual and accepts only the default branch.
After reviewing and merging the workflow, an owner can configure the repository
Secret `MEMORY_APP_SYNC_CODE` and separately authorize a live run. The Secret is
exposed only to the read/apply step; it is absent from test and publication
steps. Do not dispatch this workflow during a task that defers live credential
checks. No Secret has been installed or tested as part of this implementation.

The workflow serializes sync runs, installs Chromium, reads/applies locally,
runs `npm test`, and submits only the three template files on a unique
`sync/app-templates-<run-id>-<attempt>` branch. It refuses unexpected file
changes and stops if main advanced during testing. It uses a normal push,
never force-pushes or writes main, and never merges the PR. Main can still
advance after the freshness check; normal PR review/mergeability checks remain
necessary. The repository must allow GitHub Actions to create pull requests;
that live token permission is not established by fixture tests. A bot-token
push may not trigger another workflow; the full suite already runs before it.

## Validation scope

Fixture tests cover Secret/local credential selection, private file permissions,
rejected authentication, direct edit provenance, hidden concurrent conflicts,
deletion refusal, immutable snapshots, actual local apply/backup and no-write
failure paths. Existing browser tests cover edits across devices, stale data,
reload/recovery, conflict resolution and learning-record preservation.

Workflow syntax is checked with actionlint. Publication shell checks were also
exercised against temporary bare Git repositories with a stubbed GitHub CLI:
no changes, successful review-branch submission, main advancement, and unexpected
changed files. These checks do not authenticate to a Worker or prove production
Secret validity. Cloudflare Worker code/settings are outside this change.

In restricted cloud environments use an installed browser:

```sh
MEMORY_APP_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

Otherwise use the pinned Playwright browser installed by
`npx playwright install --with-deps chromium`. Browser tests use isolated fixture
profiles and intercept Worker calls; they do not use an existing user profile.
