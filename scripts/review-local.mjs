import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import handler from '../review-backend/api/review.js';

const port = Number(process.env.PORT || 3000);
process.env.REVIEW_LOCAL = '1';
process.env.REVIEW_ALLOWED_ORIGIN = `http://127.0.0.1:${port}`;
process.env.REVIEW_A_TOKEN ||= randomBytes(32).toString('hex');
process.env.REVIEW_B_TOKEN ||= randomBytes(32).toString('hex');
const root = resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/assets/review-config.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end("window.IEOR_REVIEW_API_BASE = '';\n");
    return;
  }
  if (url.pathname === '/api/review') {
    let raw = '', oversized = false;
    for await (const chunk of req) {
      if (Buffer.byteLength(raw) + chunk.length > 24000) { oversized = true; break; }
      raw += chunk;
    }
    if (oversized) { res.writeHead(413); res.end(); return; }
    req.body = raw;
    res.status = code => { res.statusCode = code; return res; };
    res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
    return handler(req, res);
  }
  try {
    let path = decodeURIComponent(url.pathname);
    if (!extname(path)) path = path.replace(/\/$/, '') + '/index.html';
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(file);
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => {
  console.log(`Student: http://127.0.0.1:${port}/review/a?token=${process.env.REVIEW_A_TOKEN}`);
  console.log(`Professor: http://127.0.0.1:${port}/review/b?token=${process.env.REVIEW_B_TOKEN}`);
});
