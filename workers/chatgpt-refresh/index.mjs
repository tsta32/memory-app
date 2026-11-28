const repository = 'tsta32/memory-app-private';
const workflow = 'private-sentence-library.yml';
const apiRoot = 'https://api.github.com/repos/' + repository;
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const verifyStep = 'Verify published bytes for ChatGPT Work';

function reply(origin, status, data) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin'
    }
  });
}

async function authenticate(refreshKey, configuredHash) {
  if (!validHash(refreshKey) || !validHash(configuredHash)) return false;
  const actual = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(refreshKey)));
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ parseInt(configuredHash.slice(i * 2, i * 2 + 2), 16);
  return difference === 0;
}

async function github(token, path, options = {}) {
  const response = await fetch(apiRoot + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'User-Agent': 'Memory-App-Private-Refresh',
      'X-GitHub-Api-Version': '2026-03-10'
    },
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    throw Object.assign(Error('GitHub request failed'), { upstreamStatus: response.status });
  }
  return response.json();
}

async function status(token, runId, expectedHash) {
  const run = await github(token, '/actions/runs/' + runId);
  if (run.id !== runId || run.event !== 'workflow_dispatch' || run.head_branch !== 'main' ||
      ![ '.github/workflows/' + workflow, '.github/workflows/' + workflow + '@main' ].includes(run.path)) {
    return { state: 'failed', reason: 'invalid-run' };
  }
  if (run.status !== 'completed') return { state: 'pending' };
  if (run.conclusion !== 'success') return { state: 'failed', reason: 'workflow' };
  const { jobs } = await github(token, '/actions/runs/' + runId + '/attempts/' + run.run_attempt + '/jobs');
  if (!jobs.some(job => job.conclusion === 'success' &&
      job.steps?.some(step => step.name === verifyStep && step.conclusion === 'success'))) {
    return { state: 'failed', reason: 'verification' };
  }
  const head = await github(token, '/git/ref/heads/main');
  const entry = await github(token, '/contents/memory-library/status.json?ref=' + encodeURIComponent(head.object.sha));
  if (entry.encoding !== 'base64') return { state: 'failed', reason: 'verification' };
  const receipt = JSON.parse(atob(entry.content));
  if (receipt.workflowRunId !== String(runId) || receipt.workflowRunAttempt !== String(run.run_attempt) ||
      receipt.version !== 1 || receipt.source !== 'worker-get' || receipt.snapshotVersion !== 1 ||
      receipt.hashVersion !== 1 || receipt.storageKeyCount !== 7 || !validHash(receipt.catalogSha256) ||
      !(Date.parse(receipt.checkedAt) >= Date.parse(run.created_at) && Date.parse(receipt.checkedAt) <= Date.now()) ||
      !Number.isSafeInteger(receipt.conflictCount) || receipt.conflictCount < 0) {
    return { state: 'failed', reason: 'verification' };
  }
  if (receipt.conflictCount !== 0) return { state: 'failed', reason: 'conflicts' };
  if (receipt.snapshotSha256 !== expectedHash) return { state: 'failed', reason: 'snapshot-changed' };
  return { state: 'success', checkedAt: receipt.checkedAt, revision: head.object.sha };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (!origin || origin !== env.APP_ORIGIN) return new Response(null, { status: 403 });
    if (request.method === 'OPTIONS') return reply(origin, 204, null);
    if (request.method !== 'POST') return reply(origin, 405, { reason: 'method' });
    const path = new URL(request.url).pathname;
    if (path !== '/start' && path !== '/status') return reply(origin, 404, { reason: 'path' });
    if (!env.GITHUB_TOKEN || !validHash(env.REFRESH_KEY_SHA256) || !env.REFRESH_LIMIT) {
      return reply(origin, 503, { reason: 'unconfigured' });
    }
    let stage = 'request';
    try {
      const allowed = await env.REFRESH_LIMIT.limit({ key: path + ':' + (request.headers.get('CF-Connecting-IP') || 'unknown') });
      if (!allowed.success) return reply(origin, 429, { reason: 'limited' });
      const size = Number(request.headers.get('Content-Length'));
      if (size > 1024) return reply(origin, 413, { reason: 'invalid-request' });
      const raw = await request.text();
      if (raw.length > 1024) return reply(origin, 413, { reason: 'invalid-request' });
      let body;
      try { body = JSON.parse(raw); } catch { return reply(origin, 400, { reason: 'invalid-request' }); }
      if (!body || !await authenticate(body.refreshKey, env.REFRESH_KEY_SHA256)) {
        return reply(origin, 401, { reason: 'unauthorized' });
      }
      if (!validHash(body.snapshotSha256)) return reply(origin, 400, { reason: 'invalid-request' });
      if (path === '/start') {
        stage = 'repository';
        const repo = await github(env.GITHUB_TOKEN, '');
        if (repo.full_name !== repository || repo.private !== true || repo.visibility !== 'private' || repo.default_branch !== 'main') {
          return reply(origin, 409, { reason: 'destination' });
        }
        stage = 'dispatch';
        const run = await github(env.GITHUB_TOKEN, '/actions/workflows/' + workflow + '/dispatches', {
          method: 'POST',
          body: JSON.stringify({ ref: 'main' })
        });
        if (!Number.isSafeInteger(run.workflow_run_id) || run.workflow_run_id <= 0) throw Error('Missing run id');
        return reply(origin, 202, { runId: run.workflow_run_id });
      }
      if (!Number.isSafeInteger(body.runId) || body.runId <= 0) return reply(origin, 400, { reason: 'invalid-request' });
      stage = 'status';
      return reply(origin, 200, await status(env.GITHUB_TOKEN, body.runId, body.snapshotSha256));
    } catch (error) {
      return reply(origin, 502, {
        reason: 'github',
        stage,
        ...(Number.isInteger(error?.upstreamStatus) && { upstreamStatus: error.upstreamStatus })
      });
    }
  }
};
