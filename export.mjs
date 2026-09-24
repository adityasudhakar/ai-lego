// Headless Chrome exports: the instruction booklet as PDF and the showreel as MP4.
// usage: node export.mjs [pdf|video|all]
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.dirname(new URL(import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const what = process.argv[2] ?? 'all';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  protocolTimeout: 600000,
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-unsafe-swiftshader'],
});

async function open(file, viewport) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
  await page.setViewport(viewport);
  page.setDefaultTimeout(600000);
  await page.goto(`${base}/${file}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__ready === true', { timeout: 300000 });
  return page;
}

if (what === 'pdf' || what === 'all') {
  const t = Date.now();
  const page = await open('booklet.html', { width: 1200, height: 900 });
  await page.pdf({ path: path.join(root, 'bolt-instructions.pdf'), preferCSSPageSize: true, printBackground: true });
  const n = await page.$$eval('.page', (els) => els.length);
  console.log(`booklet: ${n} pages in ${((Date.now() - t) / 1000).toFixed(0)}s`);
  // page images for the 3D flip-through at the start of the showreel
  fs.rmSync(path.join(root, 'pages'), { recursive: true, force: true });
  fs.mkdirSync(path.join(root, 'pages'));
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1.3 });
  const els = await page.$$('.page');
  for (let i = 0; i < els.length; i++) {
    await els[i].screenshot({ path: path.join(root, 'pages', `p${String(i + 1).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 84 });
  }
  fs.writeFileSync(path.join(root, 'pages', 'index.js'), `export default ${els.length};\n`);
  console.log(`page images: ${els.length}`);
  await page.close();
}

if (what === 'video' || what === 'all') {
  const fps = 30, t0 = Date.now();
  const page = await open('record.html', { width: 1280, height: 720 });
  const dur = await page.evaluate('window.TOTAL');
  const wavPath = path.join(root, 'bolt-soundtrack.wav');
  fs.writeFileSync(wavPath, Buffer.from(await page.evaluate('window.soundtrack()'), 'base64'));
  console.log('soundtrack rendered');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-i', wavPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', path.join(root, 'bolt-showreel.mp4')],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(dur * fps);
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.renderAt(t), i / fps);
    ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 92 }));
    if (i % 150 === 0) console.log(`frame ${i}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log(`video: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

await browser.close();
server.close();
