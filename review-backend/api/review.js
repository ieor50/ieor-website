import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { put } from '@vercel/blob';

const pages = new Set(['/', '/academics/', '/academics/btech/', '/academics/mtech/', '/academics/msc/', '/academics/msc-phd/', '/academics/phd/', '/admissions/', '/research/', '/people/', '/opportunities/', '/about/', '/news-events/', '/contact/']);
const equal = (a, b) => {
  const left = Buffer.from(a || ''), right = Buffer.from(b || '');
  return left.length === right.length && timingSafeEqual(left, right);
};

export function authorize(mode, token, env = process.env) {
  const a = env.REVIEW_A_TOKEN || '', b = env.REVIEW_B_TOKEN || '';
  if (a.length < 32 || b.length < 32 || equal(a, b)) return false;
  return (mode === 'a' || mode === 'b') && typeof token === 'string' && token.length <= 256 && equal(token, mode === 'a' ? a : b);
}

export function validate(body, mode) {
  const fail = error => ({ error });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('The submission could not be read.');
  const kind = body.kind;
  if (kind !== 'general' && kind !== 'element') return fail('Choose a valid feedback type.');
  if (mode === 'b' && kind !== 'general') return fail('This link accepts general feedback only.');
  if (typeof body.comment !== 'string' || !body.comment.trim() || body.comment.length > 5000) return fail('Write feedback of up to 5,000 characters.');
  if (!pages.has(body.page)) return fail('Choose a page from this website.');
  if (body.author !== undefined && (typeof body.author !== 'string' || body.author.length > 120)) return fail('Your name must be at most 120 characters.');
  const target = body.target;
  if (kind === 'element' && (!target || typeof target.selector !== 'string' || !target.selector || target.selector.length > 1000 || typeof target.text !== 'string' || target.text.length > 500 || typeof target.tag !== 'string' || !/^[a-z][a-z0-9-]{0,30}$/.test(target.tag))) return fail('Select an element again.');
  if (kind === 'general' && target != null) return fail('General feedback cannot include an element.');
  const viewport = body.viewport;
  if (!viewport || !Number.isInteger(viewport.width) || !Number.isInteger(viewport.height) || viewport.width < 1 || viewport.height < 1 || viewport.width > 20000 || viewport.height > 20000) return fail('The browser dimensions could not be read.');
  return { record: {
    id: randomUUID(), submittedAt: new Date().toISOString(),
    audience: mode === 'a' ? 'student' : 'professor', kind,
    page: body.page, author: body.author?.trim() || null, comment: body.comment.trim(),
    target: kind === 'element' ? { selector: target.selector, text: target.text, tag: target.tag } : null,
    viewport: { width: viewport.width, height: viewport.height }
  } };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  const allowed = process.env.REVIEW_ALLOWED_ORIGIN || 'https://ieor.hsbhandari.dev';
  if (req.headers.origin && req.headers.origin !== allowed) return res.status(403).json({ error: 'Origin not allowed.' });
  if (req.headers.origin === allowed) res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Review-Token');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (Number(req.headers['content-length']) > 24000) return res.status(413).json({ error: 'Submission too large.' });
  let body;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!raw || Buffer.byteLength(raw) > 24000) return res.status(413).json({ error: 'Submission too large.' });
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch { return res.status(400).json({ error: 'The submission could not be read.' }); }
  if (!authorize(body?.mode, req.headers['x-review-token'])) return res.status(401).json({ error: 'This review link is invalid or has expired.' });
  if (body.action === 'session') return res.status(200).json({ ok: true });
  if (body.action !== 'feedback') return res.status(400).json({ error: 'Unknown action.' });
  const result = validate(body, body.mode);
  if (result.error) return res.status(400).json({ error: result.error });
  try {
    const key = `ieor-reviews/${result.record.submittedAt.slice(0, 10)}/${result.record.id}.json`;
    if (process.env.REVIEW_LOCAL === '1' && !process.env.VERCEL) {
      const directory = resolve(process.env.REVIEW_LOCAL_DIR || '.review-data');
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(resolve(directory, `${result.record.id}.json`), JSON.stringify(result.record, null, 2), { flag: 'wx', mode: 0o600 });
    } else {
      await put(key, JSON.stringify(result.record), { access: 'private', addRandomSuffix: false, contentType: 'application/json' });
    }
    return res.status(201).json({ ok: true });
  } catch {
    console.error('review storage failed');
    return res.status(503).json({ error: 'Feedback could not be saved. Please try again.' });
  }
}
