import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { authorize, validate } from '../review-backend/api/review.js';

const a = randomBytes(32).toString('hex'), b = randomBytes(32).toString('hex');
const base = 'http://127.0.0.1:3129';
let server, directory, browser;
const payload = { action: 'feedback', mode: 'a', kind: 'general', page: '/', comment: 'The navigation is useful.', author: '', target: null, viewport: { width: 1200, height: 800 } };
const api = (token, body, options = {}) => fetch(`${base}/api/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Review-Token': token, ...options.headers }, body: JSON.stringify(body), ...options });
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ieor-review-test-'));
  server = spawn(process.execPath, ['scripts/review-local.mjs'], { env: { ...process.env, PORT: '3129', REVIEW_A_TOKEN: a, REVIEW_B_TOKEN: b, REVIEW_LOCAL_DIR: directory }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Local server exited: ${code}`)));
  });
});
after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) {
    await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
  }
  await rm(directory, { recursive: true, force: true });
});

test('tokens are distinct, route bound, and required; professor element payloads fail', () => {
  const env = { REVIEW_A_TOKEN: a, REVIEW_B_TOKEN: b };
  assert.equal(authorize('a', a, env), true);
  assert.equal(authorize('b', b, env), true);
  assert.equal(authorize('a', b, env), false);
  assert.equal(authorize('b', a, env), false);
  assert.equal(authorize('a', '', env), false);
  assert.equal(authorize('a', a, { ...env, REVIEW_B_TOKEN: a }), false);
  assert.equal(authorize('a', a, {}), false);
  assert.match(validate({ ...payload, kind: 'element' }, 'b').error, /general feedback only/);
  assert.ok(validate({ ...payload, page: '//evil.com/' }, 'a').error);
  assert.ok(validate({ ...payload, comment: ' ' }, 'a').error);
  assert.ok(validate({ ...payload, author: 'a'.repeat(121) }, 'a').error);
  assert.ok(validate({ ...payload, comment: 'a'.repeat(5001) }, 'a').error);
  assert.ok(validate({ ...payload, viewport: { width: -1, height: 20 } }, 'a').error);
  assert.ok(validate({ ...payload, target: { selector: 'h1' } }, 'a').error);
});

test('API persists independent private records and exposes no review listing', async () => {
  assert.equal((await api(a, { action: 'session', mode: 'a' })).status, 200);
  assert.equal((await api(b, { action: 'session', mode: 'a' })).status, 401);
  assert.equal((await api('', payload)).status, 401);
  assert.equal((await api(b, { ...payload, mode: 'b', kind: 'element' })).status, 400);
  assert.equal((await fetch(`${base}/api/review`)).status, 405);
  const forbidden = await api(a, payload, { headers: { 'Content-Type': 'application/json', 'X-Review-Token': a, Origin: 'https://other.example' } });
  assert.equal(forbidden.status, 403);
  const submissions = await Promise.all([api(a, payload), api(b, { ...payload, mode: 'b' })]);
  assert.deepEqual(submissions.map(response => response.status), [201, 201]);
  const files = await readdir(directory);
  assert.equal(files.length, 2);
  const records = await Promise.all(files.map(file => readFile(join(directory, file), 'utf8').then(JSON.parse)));
  assert.deepEqual(records.map(record => record.audience).sort(), ['professor', 'student']);
  assert.notEqual(records[0].id, records[1].id);
  for (const record of records) {
    assert.equal(record.author, null);
    assert.equal(record.comment, payload.comment);
    assert.equal(JSON.stringify(record).includes(a), false);
    assert.equal(JSON.stringify(record).includes(b), false);
  }
});

test('browser: route separation, navigation, element selection, failed drafts, mobile, and persistence', async () => {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Avoid font network dependencies in this local flow check.
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  const professor = await context.newPage();
  const requested = [];
  professor.on('request', request => requested.push(request.url()));
  await professor.goto(`${base}/review/b?token=${b}`);
  await professor.locator('#review-actions').waitFor({ state: 'visible' });
  assert.equal(new URL(professor.url()).search, '');
  assert.equal(await professor.locator('#comment-toggle').count(), 0);
  assert.equal(requested.some(url => url.includes('review-elements.js')), false);
  const profFrame = professor.frameLocator('#site-frame');
  await profFrame.locator('#site-nav a[href="/academics/"]').click();
  await profFrame.locator('h1').filter({ hasText: 'Academics' }).waitFor();
  await professor.locator('#general-feedback').click();
  await professor.locator('#review-comment').fill('Professor: make the curriculum easier to find.');
  await professor.locator('#send-feedback').click();
  await professor.locator('#confirmation').filter({ hasText: 'saved' }).waitFor();
  await professor.reload();
  await professor.locator('#review-actions').waitFor({ state: 'visible' });
  assert.equal(await professor.locator('#comment-toggle').count(), 0);

  const student = await context.newPage();
  await student.goto(`${base}/review/a?token=${a}`);
  await student.locator('#comment-toggle').waitFor();
  const studFrame = student.frameLocator('#site-frame');
  await studFrame.locator('h1').waitFor();
  await student.locator('#comment-toggle').click();
  await studFrame.locator('h1').click();
  await student.locator('#feedback-dialog').waitFor({ state: 'visible' });
  await student.locator('#review-comment').fill('Student: the heading needs a clearer explanation.');
  await student.locator('#send-feedback').click();
  await student.locator('#confirmation').filter({ hasText: 'saved' }).waitFor();
  await student.locator('#comment-toggle').click();
  await studFrame.locator('#site-nav a[href="/research/"]').click();
  await studFrame.locator('h1').filter({ hasText: 'Research' }).waitFor();
  await student.locator('#comment-toggle').click();
  await studFrame.locator('h1').click();
  await student.locator('#close-feedback').click();
  await student.locator('#general-feedback').click();
  await student.locator('#review-comment').fill('Keep this draft if storage fails.');
  await student.route('**/api/review', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Feedback could not be saved.' }) }));
  await student.locator('#send-feedback').click();
  await student.locator('#feedback-status').filter({ hasText: 'still here' }).waitFor();
  assert.equal(await student.locator('#review-comment').inputValue(), 'Keep this draft if storage fails.');
  await student.unroute('**/api/review');
  await student.locator('#send-feedback').click();
  await student.locator('#confirmation').filter({ hasText: 'saved' }).waitFor();
  await student.setViewportSize({ width: 390, height: 844 });
  await student.locator('#general-feedback').click();
  const bounds = await student.locator('#feedback-dialog').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
  await student.screenshot({ path: join(directory, 'mobile-review.png') });
  await student.locator('#close-feedback').click();
  const invalid = await context.newPage();
  await invalid.goto(`${base}/review/b?token=${a}`);
  await invalid.locator('#gate-title').filter({ hasText: 'Unable' }).waitFor();
  assert.equal(await invalid.locator('#comment-toggle').count(), 0);
  assert.equal(await invalid.locator('#review-actions').isVisible(), false);
  const files = (await readdir(directory)).filter(file => file.endsWith('.json'));
  const records = await Promise.all(files.map(file => readFile(join(directory, file), 'utf8').then(JSON.parse)));
  const element = records.find(record => record.kind === 'element');
  assert.equal(element.audience, 'student');
  assert.equal(element.target.tag, 'h1');
  assert.equal(element.page, '/');
  assert.ok(element.target.selector);
  assert.equal(records.some(record => record.audience === 'professor' && record.page === '/academics/'), true);
  assert.equal(records.some(record => record.comment === 'Keep this draft if storage fails.' && record.page === '/research/'), true);
  await context.close();
});
