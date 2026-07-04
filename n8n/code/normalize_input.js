// Normalize Input — n8n Code node (Run Once for All Items)
// Cleans the form submission: extracts a hostname from almost any input
// (bare domain, www, protocol-relative //, full URL, trailing slashes) without
// relying on new URL() — which can be strict/inconsistent in the sandbox.
const f = $json;

function pick(...names) {
  for (const n of names) {
    if (f[n] != null && String(f[n]).trim() !== '') return String(f[n]).trim();
  }
  return '';
}

const raw = pick('Company website URL', 'Company website', 'companyUrl', 'url', 'Website');
if (!raw) throw new Error('Please enter the company website (for example: boscoffee.com).');

// Strip an optional scheme + any leading slashes, then a leading "www.".
let cleaned = raw.replace(/^\s*(https?:)?\/+/i, '').replace(/^www\./i, '');
// Host = everything up to the first slash / query / hash / whitespace.
const host = cleaned.split(/[\/?#\s]/)[0].toLowerCase();

if (!host || !host.includes('.')) {
  throw new Error('That does not look like a website: "' + raw + '". Try something like boscoffee.com');
}

const companyUrl = 'https://' + host;
const companyLabel = pick('Company name', 'companyName')
  || host.split('.')[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

return [{
  json: {
    companyUrl,
    companyHost: host,
    companyLabel,
    audience: pick('Target audience', 'audience') || "the company's core customers",
    senderName: pick('Your name / brand', 'Your brand', 'senderName') || 'AI Automation',
    notifyEmail: pick('Notify email', 'email') || 'you@example.com',
  },
}];
