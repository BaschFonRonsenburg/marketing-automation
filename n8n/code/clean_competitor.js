// Clean Competitor Text — n8n Code node (Run Once for All Items)
// Strips each fetched competitor page to visible text. Preserves competitor
// identity by aligning to Extract Competitors by index (HTTP preserves order),
// and tolerates dead/empty fetches so one bad site never breaks the run.
const MAX = 2500;

function htmlToText(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const metas = $('Extract Competitors').all().map(i => i.json);
const items = $input.all();

return items.map((it, idx) => {
  const meta = metas[idx] || {};
  const body = it.json.data || it.json.body || '';
  const text = htmlToText(body).slice(0, MAX);
  return {
    json: {
      name: meta.name || '',
      url: meta.url || '',
      host: meta.host || '',
      competitorText: text,
      reachable: text.length >= 120,
    },
  };
});
