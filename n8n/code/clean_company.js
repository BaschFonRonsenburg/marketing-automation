// Clean Company Text — n8n Code node (Run Once for Each Item)
// Strips a fetched HTML page down to visible text (regex port of the
// BeautifulSoup logic in the old scrape_business_site.py).
const MAX = 4000;

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

// httpRequest (response format = text) puts the body in $json.data
const body = $json.data || $json.body || '';
const text = htmlToText(body).slice(0, MAX);

return [{
  json: {
    companyText: text,
    companyTextChars: text.length,
    thin: text.length < 150,
  },
}];
