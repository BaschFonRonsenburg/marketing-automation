// Extract Competitors — n8n Code node (Run Once for All Items)
// Parses DuckDuckGo HTML results (keyless search) into a clean, deduped
// competitor list (max 3), filtering out the company's own domain and
// non-competitor aggregator/directory sites. Emits ONE ITEM PER COMPETITOR
// so the next HTTP node scrapes each in turn.
const norm = $('Normalize Input').first().json;
const ownHost = (norm.companyHost || '').toLowerCase();

// The DuckDuckGo HTML page arrives as a string (httpRequest responseFormat=text).
const htmlBody = $json.data || $json.body || '';

const BLOCK = [
  'yelp.', 'facebook.', 'instagram.', 'tripadvisor.', 'wikipedia.', 'reddit.',
  'youtube.', 'linkedin.', 'amazon.', 'google.', 'maps.', 'doordash.', 'ubereats.',
  'grubhub.', 'opentable.', 'foursquare.', 'mapquest.', 'bbb.org', 'indeed.',
  'glassdoor.', 'pinterest.', 'tiktok.', 'x.com', 'twitter.', 'apple.',
  'duckduckgo.', 'bing.', 'yellowpages.', 'thumbtack.', 'angi.', 'nextdoor.',
];

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); }
  catch (e) { return ''; }
}

// DuckDuckGo wraps every result link as //duckduckgo.com/l/?uddg=<encoded real url>&...
// Decode uddg back to the real destination; fall back to any absolute http link.
function decodeDdg(href) {
  if (!href) return '';
  let h = href;
  if (h.startsWith('//')) h = 'https:' + h;
  const m = h.match(/[?&]uddg=([^&]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch (e) { return ''; } }
  return /^https?:\/\//i.test(h) ? h : '';
}

// Pull the result anchors. DDG HTML uses class="result__a" on result title links;
// be tolerant of attribute order / extra classes.
const anchorRe = /<a\b[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const titleToName = (t) => stripTags(t).split(/[|\-–—:·•]/)[0].trim().slice(0, 60);

const seen = new Set([ownHost]);
const competitors = [];
let m;
while ((m = anchorRe.exec(htmlBody)) !== null) {
  const url = decodeDdg(m[1]);
  if (!url) continue;
  const host = hostOf(url);
  if (!host || seen.has(host)) continue;
  if (host === ownHost || host.endsWith('.' + ownHost) || ownHost.endsWith('.' + host)) continue;
  if (BLOCK.some(b => host.includes(b))) continue;
  seen.add(host);
  competitors.push({
    name: titleToName(m[2]) || host.split('.')[0],
    url: 'https://' + host,
    host,
  });
  if (competitors.length >= 3) break;
}

// Always return at least one item so the branch runs; mark when empty.
if (competitors.length === 0) {
  return [{ json: { name: '', url: '', host: '', _noCompetitors: true } }];
}
return competitors.map(c => ({ json: c }));
