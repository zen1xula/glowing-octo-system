const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { updateAll, readCache, getLastRun } = require('./src/updater');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const REFRESH_HOURS = Number(process.env.REFRESH_HOURS || 6);

// ---- API ----
app.get('/api/codexes', (req, res) => {
  res.json({ codexes: readCache(), lastRun: getLastRun() });
});

app.post('/api/refresh', async (req, res) => {
  const results = await updateAll();
  res.json(results);
});

app.post('/api/ask', async (req, res) => {
  const { systemPrompt, userContent } = req.body || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(400).json({ error: 'На сервере не задан ANTHROPIC_API_KEY (переменная окружения).' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message || 'Ошибка API' });
    const text = (data.content || []).map((c) => c.text || '').join('\n').trim();
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Sunrise GOS Helper запущен: http://localhost:${PORT}`);
  // Первое обновление сразу при старте сервера
  updateAll().then((r) => console.log('Первичное обновление базы:', r));
  // Дальше — по расписанию, пока сервер жив
  setInterval(() => {
    updateAll().then((r) => console.log('Плановое обновление базы:', r));
  }, REFRESH_HOURS * 60 * 60 * 1000);
});
