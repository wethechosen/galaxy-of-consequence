import { createHmac } from 'node:crypto';
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
  input.close();
  break;
}
