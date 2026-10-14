import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { analyseResearch, validateInput } from './ai/research.mjs';
import { analyseRelationships, validateInput as validateRelationshipsInput } from './ai/relationships.mjs';
const envPath = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envPath)) loadEnvFile(envPath);
let busy = false;
const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
  const relationships = req.url === '/api/relationships/analyse';
  if ((!relationships && req.url !== '/api/research/cluster') || req.method !== 'POST') return send(404, { error: 'Not found.' });
  // JSON-only, same-local-origin requests; no permissive CORS or remote binding.
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
    return send(403, { error: 'Research analysis is available only from the local DAVE workspace.' });
  if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Expected JSON research data.' });
  if (busy) return send(409, { error: 'Research analysis is already running. Please wait.' });
  busy = true;
  try {
    const parts = []; let bytes = 0;
    for await (const part of req) {
      bytes += part.length;
      if (bytes > 1_000_000) return send(413, { error: 'The research request is too large.' });
      parts.push(part);
    }
    let input;
    try { input = JSON.parse(Buffer.concat(parts).toString('utf8')); (relationships ? validateRelationshipsInput : validateInput)(input); }
    catch { return send(400, { error: 'Invalid research input or prototype size limit exceeded.' }); }
    const output = await (relationships ? analyseRelationships : analyseResearch)(input, { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-4.1-mini' });
    send(200, output);
  } catch (error) {
    send(502, { error: error instanceof Error ? error.message : 'Research analysis failed. Please retry.' });
  } finally { busy = false; }
});
server.listen(3001, '127.0.0.1', () => console.log('DAVE AI server: http://127.0.0.1:3001'));
