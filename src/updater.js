const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { parseCodexText } = require('./parser');
const sources = require('./codexSources');

const CACHE_FILE = path.join(__dirname, '..', 'data', 'codexes.json');

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function writeCache(codexes) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(codexes, null, 2), 'utf-8');
}

async function fetchThreadFirstPostText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    timeout: 20000,
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const html = await res.text();
  const $ = cheerio.load(html);
  const firstPost = $('.message-body .bbWrapper').first();
  if (firstPost.length === 0) throw new Error('Не найден текст поста (изменилась вёрстка форума?)');
  firstPost.find('br').replaceWith('\n');
  return firstPost.text().replace(/\u00a0/g, ' ').trim();
}

let lastRun = null;
let isRunning = false;

async function updateAll() {
  if (isRunning) return { skipped: true };
  isRunning = true;
  const existing = readCache();
  const results = { ok: [], failed: [], ranAt: new Date().toISOString() };

  for (const src of sources) {
    try {
      const raw = await fetchThreadFirstPostText(src.url);
      const articles = parseCodexText(raw);
      if (articles.length === 0) throw new Error('статьи не найдены в тексте');

      const idx = existing.findIndex((c) => c.name === src.name);
      const codex = {
        id: idx >= 0 ? existing[idx].id : 'auto-' + Buffer.from(src.name).toString('hex').slice(0, 12),
        name: src.name,
        code: src.code,
        sourceUrl: src.url,
        auto: true,
        updatedAt: new Date().toISOString(),
        articles,
      };
      if (idx >= 0) existing[idx] = codex;
      else existing.push(codex);
      results.ok.push({ name: src.name, count: articles.length });
    } catch (err) {
      results.failed.push({ name: src.name, error: err.message });
    }
  }

  writeCache(existing);
  lastRun = results;
  isRunning = false;
  return results;
}

function getLastRun() {
  return lastRun;
}

module.exports = { updateAll, readCache, getLastRun };
