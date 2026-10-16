import { createHmac, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

if (process.stdin.isTTY) process.stdin.setRawMode(true);
const input = createInterface({ input: process.stdin, terminal: false });
console.log('Waiting for private verification input.');
for await (const line of input) {
  const { url, actionKey, sessionSecret } = JSON.parse(line);
  const account = { id: 'bc822f06-3f84-48dd-9468-3151cf3485f9', username: 'dmir@galaxy.local', displayName: "D'mir Holloran", role: 'player' };
  const payload = Buffer.from(JSON.stringify({ account, exp: Date.now() + 600000 })).toString('base64url');
  const token = `${payload}.${createHmac('sha256', sessionSecret).update(payload).digest('base64url')}`;
  const paths = actionKey ? ['/api/gpt/ping', '/api/gpt/state', '/api/gpt/hud', '/api/gpt/checkpoints', '/api/datapad'] : ['/api/gpt/ping', '/api/datapad'];
  for (const path of paths) {
    const response = await fetch(new URL(path, url), { headers: path === '/api/datapad' ? { cookie: `goc_session=${token}` } : { authorization: `Bearer ${actionKey || ''}` }, signal: AbortSignal.timeout(60000) });
    let body; try { body = await response.json(); } catch { body = {}; }
    const saved = body.save || body;
    console.log(JSON.stringify({ path, status: response.status, revision: saved.revision, version: body.version, error: body.error, hasSnapshot: Boolean(saved.snapshot), checkpoints: Array.isArray(body.checkpoints) ? body.checkpoints.length : undefined }));
    if (!response.ok) process.exitCode = 1;
  }
  if (process.argv.includes('--exercise-preview')) {
    if (new URL(url).hostname !== 'galaxy-local-i9hzqqm2f-ceejays-projects-fab7399b.vercel.app') throw new Error('Write checks are restricted to the isolated migration preview.');
    const request = async (path, body, useAction = false) => {
      const response = await fetch(new URL(path, url), { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(useAction ? {authorization: `Bearer ${actionKey}`} : {cookie: `goc_session=${token}`}) }, ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(60000) });
      const data = await response.json();
      if (!response.ok) throw new Error(`${path} ${response.status}: ${data.error}`);
      return data;
    };
    const before = await request('/api/datapad');
    const transactionId = `neon-cutover-${randomUUID()}`;
    const depositBody = {revision: before.revision, action:'deposit', amount:1, transactionId};
    const deposit = await request('/api/bank', depositBody);
    const replay = await request('/api/bank', depositBody);
    if (!replay.replayed || replay.revision !== deposit.revision) throw new Error('Transfer replay was not idempotent.');
    const withdrawal = await request('/api/bank', {revision:deposit.revision, action:'withdraw', amount:1, transactionId:`${transactionId}-return`});
    const after = await request('/api/datapad');
    if (after.revision !== withdrawal.revision || after.snapshot.gameState.credits !== before.snapshot.gameState.credits || after.snapshot.gameState.bankCredits !== before.snapshot.gameState.bankCredits) throw new Error('Persisted transfer balances did not reconcile.');
    const checkpoint = await request('/api/gpt/save', {label:'Isolated Neon cutover verification'}, true);
    if (!checkpoint.checkpointId && !checkpoint.checkpoint?.checkpoint_id && !checkpoint.checkpoint?.id) throw new Error('Checkpoint receipt missing.');
    console.log(JSON.stringify({previewWrites:'passed',revision:after.revision,replay:'exactly-once',balances:'restored',checkpoint:'saved',productionModified:false}));
  }
  input.close();
  break;
}
