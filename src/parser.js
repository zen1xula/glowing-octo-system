// Разбивает сырой текст кодекса на отдельные статьи.
// Ищет шаблон "Статья N." или "Статья N.N." и режет текст между вхождениями.
function parseCodexText(raw) {
  const re = /Статья\s+(\d+(?:\.\d+)?)\.?\s*([^\n\r]*)/gi;
  let match;
  const marks = [];
  while ((match = re.exec(raw)) !== null) {
    marks.push({
      index: match.index,
      num: match[1],
      titleLine: match[2].trim(),
      fullMatchLen: match[0].length,
    });
  }
  const articles = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index + marks[i].fullMatchLen;
    const end = i + 1 < marks.length ? marks[i + 1].index : raw.length;
    const body = raw.slice(start, end).trim();
    articles.push({
      num: marks[i].num,
      title: marks[i].titleLine || '(без заголовка)',
      text: body,
    });
  }
  return articles;
}

module.exports = { parseCodexText };
