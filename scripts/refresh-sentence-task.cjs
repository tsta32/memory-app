'use strict';

const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');
const os = require('node:os');
const path = require('node:path');

const repository = 'tsta32/memory-app-private';
const workflow = 'private-sentence-library.yml';
function gh(args, timeout = 30000) {
  const result = spawnSync('gh', args, { encoding: 'utf8', timeout, maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw Error('GitHub request failed');
  return result.stdout;
}
function api(endpoint, ...args) {
  return JSON.parse(gh(['api', '-H', 'X-GitHub-Api-Version: 2026-03-10', endpoint, ...args]));
}
async function refresh() {
  const root = 'repos/' + repository;
  const info = api(root);
  if (info.private !== true || info.visibility !== 'private' || info.full_name !== repository || info.default_branch !== 'main') {
    throw Error('Private destination verification failed');
  }
  const started = Date.now();
  const dispatch = api(root + '/actions/workflows/' + workflow + '/dispatches', '-X', 'POST', '-f', 'ref=main');
  const id = dispatch.workflow_run_id;
  if (!Number.isSafeInteger(id)) throw Error('GitHub did not identify this refresh run');
  let run;
  const deadline = Date.now() + 15 * 60 * 1000;
  do {
    run = api(root + '/actions/runs/' + id);
    if (run.status === 'completed') break;
    await delay(5000);
  } while (Date.now() < deadline);
  if (run.status !== 'completed') throw Error('This refresh timed out');
  if (run.conclusion !== 'success' || run.event !== 'workflow_dispatch' || run.head_branch !== 'main') {
    throw Error('Workflow result does not confirm this refresh');
  }
  const revision = api(root + '/git/ref/heads/main').object.sha;
  function read(file) {
    const item = api(root + '/contents/memory-library/' + file + '?ref=' + revision);
    if (item.encoding !== 'base64') throw Error('Could not read the published catalog at its exact commit');
    return Buffer.from(item.content, 'base64');
  }
  const statusBytes = read('status.json');
  const catalog = read('catalog.json');
  const status = JSON.parse(statusBytes);
  if (status.source !== 'worker-get' || status.workflowRunId !== String(id) ||
      status.workflowRunAttempt !== String(run.run_attempt) || !(Date.parse(status.checkedAt) >= started) ||
      status.catalogSha256 !== createHash('sha256').update(catalog).digest('hex')) {
    throw Error('Published catalog could not be verified for this refresh');
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-sentence-task-'));
  fs.writeFileSync(path.join(dir, 'status.json'), statusBytes, { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'catalog.json'), catalog, { mode: 0o600 });
  console.log(JSON.stringify({ revision, runId: id, checkedAt: status.checkedAt, privateDirectory: dir }));
}
refresh().catch(error => {
  console.error('Fresh sentence catalog unavailable: ' + (error instanceof SyntaxError ? 'Invalid GitHub response' : error.message));
  process.exitCode = 1;
});
