// Aggregate Context — n8n Code node (Run Once for All Items)
// Merges the company context with every scraped competitor into a single
// item + a preformatted text block the Gap Analysis prompt can drop straight in.
const norm = $('Normalize Input').first().json;
const company = $('Clean Company Text').first().json;

const items = $input.all().map(i => i.json).filter(c => c && c.name);
const competitors = items.filter(c => !c._noCompetitors);

const reachable = competitors.filter(c => c.reachable);

const competitorsBlock = competitors.length
  ? competitors.map((c, i) =>
      `Competitor ${i + 1}: ${c.name} (${c.url})\n` +
      (c.reachable ? c.competitorText : '[site could not be read — infer only from the name/URL]')
    ).join('\n\n---\n\n')
  : 'No competitors could be discovered via web search.';

return [{
  json: {
    companyLabel: norm.companyLabel,
    companyUrl: norm.companyUrl,
    audience: norm.audience,
    senderName: norm.senderName,
    notifyEmail: norm.notifyEmail,
    companyText: company.companyText || '',
    companyThin: !!company.thin,
    competitors: competitors.map(c => ({ name: c.name, url: c.url, reachable: !!c.reachable })),
    competitorCount: competitors.length,
    reachableCount: reachable.length,
    competitorsBlock,
  },
}];
