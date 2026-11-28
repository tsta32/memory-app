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
const maxReceiptAge = 10 * 60 * 1000;
function validSnapshotReceipt(receipt) {
  return receipt?.version === 1 && receipt.snapshotVersion === 1 && receipt.hashVersion === 1 &&
    receipt.storageKeyCount === 7 && /^[a-f0-9]{64}$/.test(receipt.snapshotSha256);
}
function validateDeviceReceipt(receipt, now) {
  const checked = Date.parse(receipt?.checkedAt), success = Date.parse(receipt?.lastSuccessAt);
  if (!validSnapshotReceipt(receipt) || receipt.pending !== false ||
      !(checked <= now && now - checked <= maxReceiptAge && success > 0 && success <= checked)) {
    throw Error('A current matching device receipt with no pending writes is required');
  }
}
function verifyPublished(status, catalog, runId, attempt, started, device, now = Date.now()) {
  if (!validSnapshotReceipt(status) || status.source !== 'worker-get' ||
      status.workflowRunId !== String(runId) || status.workflowRunAttempt !== String(attempt) ||
      !(Date.parse(status.checkedAt) >= started && Date.parse(status.checkedAt) <= now) ||
      !Number.isSafeInteger(status.conflictCount) || status.conflictCount < 0 ||
      status.catalogSha256 !== createHash('sha256').update(catalog).digest('hex')) {
    throw Error('Published catalog could not be verified for this refresh');
  }
  if (device) {
    validateDeviceReceipt(device, now);
    if (status.snapshotSha256 !== device.snapshotSha256) throw Error('Device and Worker snapshots differ');
    if (status.conflictCount) throw Error('Unresolved sync conflicts block sentence work');
  }
}
async function refresh(args) {
  const workerOnly = args.length === 1 && args[0] === '--verify-worker-only';
  if (!workerOnly && (args.length !== 2 || args[0] !== '--device-receipt')) {
    throw Error('Provide the receipt from the app data match check with --device-receipt <file>');
  }
  const device = workerOnly ? null : JSON.parse(fs.readFileSync(args[1], 'utf8'));
  if (!workerOnly) validateDeviceReceipt(device, Date.now());
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
  verifyPublished(status, catalog, id, run.run_attempt, started, device);
  if (workerOnly) {
    console.log(JSON.stringify({ revision, runId: id, storageKeyCount: status.storageKeyCount,
      conflictCount: status.conflictCount, deviceVerified: false, sentenceWorkAllowed: false }));
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-sentence-task-'));
  fs.writeFileSync(path.join(dir, 'status.json'), statusBytes, { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'catalog.json'), catalog, { mode: 0o600 });
  console.log(JSON.stringify({ revision, runId: id, checkedAt: status.checkedAt, privateDirectory: dir }));
}
if (require.main === module) refresh(process.argv.slice(2)).catch(error => {
  console.error('Fresh sentence catalog unavailable: ' + (error instanceof SyntaxError ? 'Invalid receipt or GitHub response' : error.message));
  process.exitCode = 1;
});
module.exports = { validateDeviceReceipt, verifyPublished };
