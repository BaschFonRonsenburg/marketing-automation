// ============================================================================
// Assemble Report  —  n8n Code node (Run Once for All Items)
// Builds the final themed HTML email from the analysis + campaign outputs.
// Industry-adaptive: picks a theme preset from Gap Analysis' `theme.preset_key`,
// falls back to `recon_neutral` for unknown industries. Motifs are inline SVG
// (email clients strip external/background images; the themed color always carries).
// ============================================================================

// ---- pull upstream data (guarded so a partial run still emails something) ---
const norm = $('Normalize Input').first().json;
const gap = ($('Gap Analysis').first().json.output) || {};
const camp = ($('Campaign Copy').first().json.output) || {};
const agg = $('Aggregate Context').first().json;

const competitors = agg.competitors || [];
const theme = gap.theme || {};

// ---------------------------------------------------------------------------
// THEME PRESETS  — each supplies only the tokens that differ; the CSS below is
// shared. Add presets here to teach the report a new industry look.
// ---------------------------------------------------------------------------
const THEMES = {
  recon_neutral: {
    label: 'recon_neutral', motif: 'radar',
    fonts: {
      display: "'Bahnschrift','DIN Condensed','Arial Narrow','Helvetica Neue',sans-serif",
      body: "Georgia,'Sitka Text','Times New Roman',serif",
      label: "'Bahnschrift','DIN Condensed','Segoe UI',sans-serif",
    },
    vars: {
      ink:'#14203a', inkSoft:'#33405c', muted:'#5a6577', paper:'#f3f5f8', card:'#ffffff',
      hairline:'#e0e5ec', hairlineStrong:'#cfd6e0', brand:'#0e6e6a', brandDeep:'#0a4f4c',
      gap:'#c24236', gapBg:'#f9e7e4', watch:'#b3801b', watchBg:'#f7eed9', have:'#2f8f5b', haveBg:'#e4f1e9',
    },
    masthead:'linear-gradient(150deg,#101a2c 0%,#16263f 55%,#123634 130%)',
    mastheadText:'#eef2f7', kicker:'#6fd6cf', kickerRgb:'111,214,207',
    subjectDesc:'#b9c4d4', metaLabel:'#8ea0b8', metaVal:'#dfe6ef',
  },
  cozy_warm: {
    label: 'cozy_warm', motif: 'beans',
    fonts: {
      display: "'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif",
      body: "Georgia,'Iowan Old Style','Times New Roman',serif",
      label: "'Trebuchet MS','Segoe UI','Gill Sans',sans-serif",
    },
    vars: {
      ink:'#2c1e15', inkSoft:'#5a4433', muted:'#8a7563', paper:'#f6efe4', card:'#fffdf8',
      hairline:'#e7dccb', hairlineStrong:'#d8c9b2', brand:'#a5673f', brandDeep:'#7a4a2b',
      gap:'#b23a2e', gapBg:'#f6e3de', watch:'#b3801b', watchBg:'#f6ecd6', have:'#5c7a3a', haveBg:'#eaf0dc',
    },
    masthead:'linear-gradient(150deg,#2b1d14 0%,#3a2618 55%,#4a2f1a 130%)',
    mastheadText:'#f4e9da', kicker:'#e0b483', kickerRgb:'224,180,131',
    subjectDesc:'#d8c3aa', metaLabel:'#b79a7c', metaVal:'#ece0d0',
  },
  fresh_modern: {
    label: 'fresh_modern', motif: 'grid',
    fonts: {
      display: "'Segoe UI Semibold','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
      body: "'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
      label: "'Segoe UI Semibold','Segoe UI',Roboto,Arial,sans-serif",
    },
    vars: {
      ink:'#0f1b2d', inkSoft:'#33455f', muted:'#5d6b80', paper:'#f4f7fb', card:'#ffffff',
      hairline:'#e2e8f1', hairlineStrong:'#cbd5e3', brand:'#2563eb', brandDeep:'#1d4ed8',
      gap:'#dc2b45', gapBg:'#fbe3e7', watch:'#c2820c', watchBg:'#f8efd7', have:'#16a34a', haveBg:'#dcf3e4',
    },
    masthead:'linear-gradient(150deg,#0b1220 0%,#122036 55%,#0b2a4a 130%)',
    mastheadText:'#eaf1fb', kicker:'#7cc0ff', kickerRgb:'124,192,255',
    subjectDesc:'#aabbd2', metaLabel:'#8497b3', metaVal:'#dbe6f5',
  },
  trust_corporate: {
    label: 'trust_corporate', motif: 'lines',
    fonts: {
      display: "Georgia,'Times New Roman',serif",
      body: "Georgia,'Times New Roman',serif",
      label: "'Segoe UI','Helvetica Neue',Arial,sans-serif",
    },
    vars: {
      ink:'#1a2432', inkSoft:'#3a4655', muted:'#606c7c', paper:'#f5f6f7', card:'#ffffff',
      hairline:'#e3e6ea', hairlineStrong:'#cdd3da', brand:'#9a6b2f', brandDeep:'#7a5323',
      gap:'#b23a34', gapBg:'#f6e4e2', watch:'#b3801b', watchBg:'#f6ecd8', have:'#3f7a52', haveBg:'#e4efe8',
    },
    masthead:'linear-gradient(150deg,#182231 0%,#20304a 55%,#1c2740 130%)',
    mastheadText:'#eef1f5', kicker:'#d9b481', kickerRgb:'217,180,129',
    subjectDesc:'#b6c0cd', metaLabel:'#8b97a6', metaVal:'#dde3ea',
  },
};
// Aliases so the LLM has more industry vocabulary than there are hand-built skins.
THEMES.vital_energetic = THEMES.fresh_modern;
THEMES.earthy_craft = THEMES.cozy_warm;

const T = THEMES[theme.preset_key] || THEMES.recon_neutral;

// Optional per-company accent tuning from the LLM (kept within the preset).
const isHex = (s) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
const brand = isHex(theme.accent_hex) ? theme.accent_hex : T.vars.brand;

// ---------------------------------------------------------------------------
// MOTIFS — decorative masthead SVG, one per style. Purely additive.
// ---------------------------------------------------------------------------
function motifSvg(kind, rgb) {
  const c = `rgb(${rgb})`;
  if (kind === 'beans') {
    return `<svg class="motif" viewBox="0 0 420 420" fill="none" aria-hidden="true"><g stroke="${c}" stroke-width="1.4" opacity="0.85">`
      + `<g transform="translate(300,90) rotate(28)"><ellipse rx="26" ry="17"/><path d="M0 -15 C 8 -6,8 6,0 15"/></g>`
      + `<g transform="translate(360,180) rotate(-14)"><ellipse rx="24" ry="15"/><path d="M0 -13 C 7 -5,7 5,0 13"/></g>`
      + `<g transform="translate(250,200) rotate(52)"><ellipse rx="22" ry="14"/><path d="M0 -12 C 6 -4,6 4,0 12"/></g>`
      + `<g transform="translate(330,290) rotate(8)"><ellipse rx="25" ry="16"/><path d="M0 -14 C 7 -5,7 5,0 14"/></g></g>`
      + `<g stroke="${c}" stroke-width="2" opacity="0.3" stroke-linecap="round"><path d="M120 300 C 138 270,102 250,120 220 C 138 190,102 170,120 140"/><path d="M160 320 C 178 290,142 270,160 240 C 178 210,142 190,160 160"/></g></svg>`;
  }
  if (kind === 'grid') {
    return `<svg class="motif" viewBox="0 0 420 420" fill="none" aria-hidden="true"><g stroke="${c}" stroke-width="1" opacity="0.5">`
      + Array.from({length:9}, (_,i)=>`<line x1="${i*52}" y1="0" x2="${i*52}" y2="420"/><line x1="0" y1="${i*52}" x2="420" y2="${i*52}"/>`).join('')
      + `</g><g fill="${c}" opacity="0.9"><circle cx="312" cy="104" r="4"/><circle cx="208" cy="208" r="4"/><circle cx="364" cy="260" r="3"/></g></svg>`;
  }
  if (kind === 'lines') {
    return `<svg class="motif" viewBox="0 0 420 420" fill="none" aria-hidden="true"><g stroke="${c}" stroke-width="0.9" opacity="0.4">`
      + Array.from({length:14}, (_,i)=>`<path d="M${-40+i*34} 420 C ${60+i*30} 300, ${-20+i*30} 160, ${120+i*24} -20"/>`).join('')
      + `</g></svg>`;
  }
  // 'radar' default
  return `<svg class="motif" viewBox="0 0 460 460" fill="none" aria-hidden="true"><g stroke="${c}">`
    + `<circle cx="230" cy="230" r="70" stroke-width="1"/><circle cx="230" cy="230" r="130" stroke-width="1"/>`
    + `<circle cx="230" cy="230" r="190" stroke-width="1"/><circle cx="230" cy="230" r="250" stroke-width="0.8"/>`
    + `<line x1="230" y1="0" x2="230" y2="460" stroke-width="0.6"/><line x1="0" y1="230" x2="460" y2="230" stroke-width="0.6"/></g>`
    + `<path d="M230 230 L230 40 A190 190 0 0 1 390 320 Z" fill="${c}" fill-opacity="0.10"/></svg>`;
}

// ---- small helpers ---------------------------------------------------------
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const RATING = {
  none:  { cls:'gap',   text:'None' },
  partial:{ cls:'watch', text:'Partial' },
  have:  { cls:'have',  text:'Have' },
};
const cell = (r) => {
  const m = RATING[(r||'').toLowerCase()] || RATING.partial;
  return `<span class="cell ${m.cls}"><span class="dot"></span>${m.text}</span>`;
};

// ---- data with fallbacks ---------------------------------------------------
const companyLabel = esc(norm.companyLabel || 'Your Company');
const companyDesc = esc(gap.company_descriptor || norm.companyUrl || '');
const summary = esc(gap.company_summary || 'Analysis summary unavailable.');
const positioning = esc(gap.positioning_angle || '');
const limitations = Array.isArray(gap.limitations) ? gap.limitations : [];
const recommendations = Array.isArray(gap.recommendations) ? gap.recommendations : [];
const matrix = gap.matrix || { columns: [], rows: [] };
const cols = matrix.columns || [];
const rows = matrix.rows || [];
const email = camp.email || {};
const paras = Array.isArray(email.body_paragraphs) ? email.body_paragraphs : [];
const hashtags = Array.isArray(camp.hashtags) ? camp.hashtags : [];
const today = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const len = (s)=> (s? String(s).length : 0);

// ---- matrix html -----------------------------------------------------------
const matrixHead = `<tr><th>Capability</th><th class="subject-col">${companyLabel}<span class="col-tag">you</span></th>`
  + cols.map(c=>`<th>${esc(c.name||c)}<span class="col-tag">${esc(c.url||'')}</span></th>`).join('') + `</tr>`;
const matrixBody = rows.map(row => {
  const compCells = (row.competitor_ratings||[]).map(r=>`<td>${cell(r)}</td>`).join('');
  return `<tr><td class="cap">${esc(row.capability||'')}</td>`
    + `<td class="subject-col">${cell(row.subject_rating)}</td>${compCells}</tr>`;
}).join('');

// ---- render ----------------------------------------------------------------
const v = T.vars;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Competitive Edge — ${companyLabel}</title>
<style>
:root{--ink:${v.ink};--ink-soft:${v.inkSoft};--muted:${v.muted};--paper:${v.paper};--card:${v.card};--hairline:${v.hairline};--hairline-strong:${v.hairlineStrong};--brand:${brand};--brand-deep:${v.brandDeep};--gap:${v.gap};--gap-bg:${v.gapBg};--watch:${v.watch};--watch-bg:${v.watchBg};--have:${v.have};--have-bg:${v.haveBg};--fd:${T.fonts.display};--fb:${T.fonts.body};--fl:${T.fonts.label};--fm:'Consolas','Cascadia Mono',ui-monospace,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--paper)}
.doc{background:var(--paper);color:var(--ink);font-family:var(--fb);font-size:17px;line-height:1.62;-webkit-font-smoothing:antialiased}
.wrap{max-width:940px;margin:0 auto;padding:0 24px 72px}
.eyebrow{font-family:var(--fl);text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:var(--brand)}
h2{font-family:var(--fd);font-weight:700;font-size:27px;letter-spacing:.005em;margin:0;color:var(--ink)}
h3{font-family:var(--fd);font-weight:700;font-size:18px;margin:0;color:var(--ink)}
p{margin:0}
.masthead{position:relative;overflow:hidden;background:${T.masthead};color:${T.mastheadText}}
.masthead-inner{position:relative;z-index:2;max-width:940px;margin:0 auto;padding:40px 24px 34px}
.motif{position:absolute;top:-80px;right:-70px;width:440px;height:440px;z-index:1;opacity:.5;pointer-events:none;fill:none}
.kicker{font-family:var(--fl);text-transform:uppercase;letter-spacing:.28em;font-size:12px;font-weight:700;color:${T.kicker};margin-bottom:18px;display:flex;align-items:center;gap:12px}
.kicker::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(${T.kickerRgb},.55),rgba(${T.kickerRgb},0))}
.subject-name{font-family:var(--fd);font-weight:700;font-size:clamp(34px,6vw,52px);line-height:1.02;margin:0 0 10px}
.subject-desc{font-size:18px;color:${T.subjectDesc};max-width:54ch;margin-bottom:26px}
.meta-row{display:flex;flex-wrap:wrap;gap:26px 40px;padding-top:20px;border-top:1px solid rgba(255,255,255,.13)}
.meta-label{font-family:var(--fl);text-transform:uppercase;letter-spacing:.14em;font-size:10.5px;color:${T.metaLabel};margin-bottom:4px;font-weight:700}
.meta-val{font-family:var(--fm);font-size:13.5px;color:${T.metaVal}}
section{margin-top:50px}
.sec-head{display:flex;align-items:baseline;gap:16px;margin-bottom:22px}
.sec-head .idx{font-family:var(--fm);font-size:13px;color:var(--brand);padding-top:4px}
.sec-head .sub{margin-left:auto;font-size:14px;color:var(--muted);font-family:var(--fl);text-align:right}
.lead{font-size:19px;line-height:1.6;color:var(--ink-soft);max-width:68ch;margin-bottom:26px}
.tiles{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.tile{background:var(--card);border:1px solid var(--hairline);border-radius:12px;padding:18px 20px}
.t-num{font-family:var(--fd);font-weight:700;font-size:34px;line-height:1;color:var(--ink)}
.t-num.accent{color:var(--gap)}
.t-label{margin-top:8px;font-size:13.5px;color:var(--muted)}
.tile.wide{grid-column:span 2}
.tile.wide .t-num{font-size:20px;font-family:var(--fb);font-style:italic;color:var(--brand-deep);line-height:1.3}
.matrix-scroll{overflow-x:auto;border-radius:12px;border:1px solid var(--hairline)}
table.matrix{width:100%;border-collapse:collapse;background:var(--card);min-width:620px}
table.matrix thead th{font-family:var(--fl);font-size:13px;font-weight:700;text-align:left;padding:15px 16px;color:var(--muted);border-bottom:1px solid var(--hairline-strong);vertical-align:bottom}
table.matrix thead th.subject-col{color:var(--ink);border-bottom:2px solid var(--brand)}
.col-tag{display:block;font-family:var(--fm);font-size:10px;color:var(--brand);text-transform:none;margin-top:3px;font-weight:400}
table.matrix tbody td{padding:13px 16px;border-bottom:1px solid var(--hairline);font-size:14px}
table.matrix tbody tr:last-child td{border-bottom:none}
td.cap{font-family:var(--fb);color:var(--ink)}
td.subject-col{background:rgba(0,0,0,.02)}
.cell{display:inline-flex;align-items:center;gap:7px;font-family:var(--fl);font-weight:600;font-size:12.5px;padding:4px 10px 4px 8px;border-radius:20px;white-space:nowrap}
.cell .dot{width:8px;height:8px;border-radius:50%;flex:none}
.cell.gap{background:var(--gap-bg);color:var(--gap)}.cell.gap .dot{background:var(--gap)}
.cell.watch{background:var(--watch-bg);color:var(--watch)}.cell.watch .dot{background:var(--watch)}
.cell.have{background:var(--have-bg);color:var(--have)}.cell.have .dot{background:var(--have)}
.legend{display:flex;flex-wrap:wrap;gap:18px;margin-top:14px;font-size:13px;color:var(--muted);font-family:var(--fl)}
.legend span{display:inline-flex;align-items:center;gap:7px}.legend .dot{width:9px;height:9px;border-radius:50%}
.split{display:grid;gap:26px;grid-template-columns:1fr 1fr}
.panel{background:var(--card);border:1px solid var(--hairline);border-radius:12px;padding:24px 26px}
.panel>h3{margin-bottom:16px}
ul.findings{list-style:none;margin:0;padding:0;display:grid;gap:15px}
ul.findings li{padding-left:20px;position:relative;font-size:15px;line-height:1.5;color:var(--ink-soft)}
ul.findings li::before{content:"";position:absolute;left:0;top:9px;width:8px;height:8px;border-radius:2px;background:var(--gap);transform:rotate(45deg)}
ul.findings li b{color:var(--ink)}
ol.recs{list-style:none;margin:0;padding:0;counter-reset:r;display:grid;gap:18px}
ol.recs li{counter-increment:r;display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;font-size:15px;line-height:1.5;color:var(--ink-soft)}
ol.recs li::before{content:counter(r,decimal-leading-zero);font-family:var(--fm);font-size:13px;color:var(--brand);font-weight:700;padding-top:2px}
ol.recs li b{color:var(--ink)}
.positioning{margin-top:26px;border:1px solid var(--hairline);border-left:3px solid var(--brand);border-radius:10px;padding:20px 24px;background:var(--card)}
.positioning p{font-size:20px;font-style:italic;line-height:1.45;color:var(--ink);margin-top:8px;max-width:60ch}
.drafts-badge{display:inline-flex;align-items:center;gap:8px;font-family:var(--fl);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--watch);background:var(--watch-bg);border:1px solid var(--watch);border-radius:20px;padding:5px 13px}
.drafts-badge .pulse{width:7px;height:7px;border-radius:50%;background:var(--watch)}
.email-card{background:var(--card);border:1px solid var(--hairline);border-radius:12px;overflow:hidden}
.email-head{padding:16px 24px;border-bottom:1px solid var(--hairline);display:flex;flex-wrap:wrap;gap:6px 16px;align-items:baseline}
.email-head .lbl{font-family:var(--fl);font-weight:700;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.email-head .subj{font-size:18px;font-weight:700;color:var(--ink);font-family:var(--fd)}
.email-body{padding:22px 24px}
.email-body p{margin-bottom:13px;color:var(--ink-soft);font-size:15.5px}
.cta-line{color:var(--brand-deep);font-weight:700;font-style:italic}
.sig{color:var(--muted);font-size:14.5px}
.socials{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));margin-top:16px}
.social{background:var(--card);border:1px solid var(--hairline);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column}
.s-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.s-plat{font-family:var(--fl);font-weight:700;font-size:14px;color:var(--ink)}
.s-count{font-family:var(--fm);font-size:11px;color:var(--muted)}
.s-text{font-size:14.5px;line-height:1.5;color:var(--ink-soft);flex:1}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.tag{font-family:var(--fm);font-size:11.5px;color:var(--brand-deep);background:var(--hairline);border-radius:5px;padding:3px 8px}
.foot{margin-top:54px;padding-top:22px;border-top:1px solid var(--hairline-strong);display:grid;gap:10px;font-size:12.5px;color:var(--muted);line-height:1.55}
.foot .brandline{font-family:var(--fl);font-weight:700;color:var(--ink-soft)}
.foot code{font-family:var(--fm);font-size:11.5px;color:var(--brand-deep)}
@media(max-width:680px){.split{grid-template-columns:1fr}.tile.wide{grid-column:span 1}.sec-head .sub{display:none}}
</style></head><body><div class="doc">
<header class="masthead">${motifSvg(T.motif, T.kickerRgb)}<div class="masthead-inner">
<div class="kicker">Competitive Edge &middot; Market Recon Brief</div>
<p class="subject-name">${companyLabel}</p>
<p class="subject-desc">${companyDesc}</p>
<div class="meta-row">
<div><div class="meta-label">Prepared by</div><div class="meta-val">${esc(norm.senderName||'AI Automation')}</div></div>
<div><div class="meta-label">Generated</div><div class="meta-val">${today}</div></div>
<div><div class="meta-label">Sources</div><div class="meta-val">${competitors.length+1} public websites</div></div>
<div><div class="meta-label">Competitors mapped</div><div class="meta-val">${competitors.length} auto-discovered</div></div>
</div></div></header>
<div class="wrap">
<section><div class="sec-head"><span class="eyebrow">Executive Summary</span></div>
<p class="lead">${summary}</p>
<div class="tiles">
<div class="tile"><div class="t-num accent">${limitations.length}</div><div class="t-label">Capability gaps vs. competitors</div></div>
<div class="tile"><div class="t-num">${competitors.length}</div><div class="t-label">Direct competitors analyzed</div></div>
<div class="tile"><div class="t-num">${recommendations.length}</div><div class="t-label">Prioritized moves recommended</div></div>
<div class="tile"><div class="t-num">4</div><div class="t-label">Campaign assets drafted</div></div>
${positioning?`<div class="tile wide"><div class="t-label" style="margin-top:0;margin-bottom:6px">Recommended positioning</div><div class="t-num">&ldquo;${positioning}&rdquo;</div></div>`:''}
</div></section>
<section><div class="sec-head"><span class="idx">01</span><h2>Competitive Gap Analysis</h2><span class="sub">${companyLabel} vs. discovered competitors</span></div>
<div class="matrix-scroll"><table class="matrix"><thead>${matrixHead}</thead><tbody>${matrixBody}</tbody></table></div>
<div class="legend"><span><span class="dot" style="background:var(--gap)"></span>None &mdash; not offered</span><span><span class="dot" style="background:var(--watch)"></span>Partial &mdash; underbuilt</span><span><span class="dot" style="background:var(--have)"></span>Have &mdash; established</span></div></section>
<section><div class="sec-head"><span class="idx">02</span><h2>Limitations &amp; How to Beat the Market</h2></div>
<div class="split"><div class="panel"><h3>Where ${companyLabel} is losing ground</h3><ul class="findings">
${limitations.map(l=>`<li><b>${esc(l.title||'')}.</b> ${esc(l.detail||'')}</li>`).join('')}
</ul></div><div class="panel"><h3>Prioritized moves</h3><ol class="recs">
${recommendations.map(r=>`<li><span><b>${esc(r.title||'')}.</b> ${esc(r.detail||'')}</span></li>`).join('')}
</ol></div></div>
${positioning?`<div class="positioning"><span class="eyebrow">The angle the campaign runs on</span><p>&ldquo;${positioning}&rdquo;</p></div>`:''}</section>
<section><div class="sec-head"><span class="idx">03</span><h2>Ready-to-Post Campaign</h2><span class="sub"><span class="drafts-badge"><span class="pulse"></span>Drafts &middot; review before sending</span></span></div>
<div class="email-card"><div class="email-head"><span class="lbl">Marketing Email</span><span class="lbl">Subject</span><span class="subj">${esc(email.subject||'')}</span></div>
<div class="email-body">${paras.map((p,i)=>`<p class="${/subscri|shop|start|book|call|learn|get |visit|order/i.test(p)&&i>0&&i<paras.length-1?'cta-line':''}">${esc(p)}</p>`).join('')}</div></div>
<div class="socials">
<div class="social"><div class="s-head"><span class="s-plat">LinkedIn</span><span class="s-count">${len(camp.linkedin)} chars</span></div><p class="s-text">${esc(camp.linkedin||'')}</p></div>
<div class="social"><div class="s-head"><span class="s-plat">X / Twitter</span><span class="s-count">${len(camp.x_post)} / 280</span></div><p class="s-text">${esc(camp.x_post||'')}</p></div>
<div class="social"><div class="s-head"><span class="s-plat">Instagram</span><span class="s-count">${len(camp.instagram_caption)} chars</span></div><p class="s-text">${esc(camp.instagram_caption||'')}</p>
${hashtags.length?`<div class="tags">${hashtags.map(h=>`<span class="tag">${esc(h.startsWith&&h.startsWith('#')?h:'#'+h)}</span>`).join('')}</div>`:''}</div>
</div></section>
<footer class="foot">
<div class="brandline">Competitive Edge Campaign Builder &middot; automated market recon</div>
<div>Generated from public web sources only &mdash; the company's own site plus <code>${competitors.length}</code> auto-discovered competitor sites. Competitor capability ratings are inferred from public pages and may need a human sanity-check.</div>
<div>All campaign copy above is a <b>draft for human review</b>. Nothing is posted to social media or sent to any customer automatically.</div>
<div style="font-family:var(--fl);color:var(--brand-deep)">Theme applied: <b>${esc(T.label)}</b>${theme.industry?` &mdash; auto-selected for the ${esc(theme.industry)} industry`:''}.</div>
</footer></div></div></body></html>`;

// ---- email-safe summary (the email BODY; the full report goes out as a PDF) ----
// Gmail strips flexbox/grid, so this uses only inline styles + block elements.
const topGaps = limitations.slice(0, 3);
const summaryHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#222222;font-size:15px;line-height:1.6;max-width:600px;">
<p style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8a8a;margin:0 0 4px;">Competitive Edge &middot; Market Recon</p>
<h2 style="font-size:22px;margin:0 0 12px;color:#111111;">${companyLabel}</h2>
<p style="margin:0 0 18px;">${summary}</p>
<p style="font-weight:bold;margin:0 0 6px;color:#111111;">Top gaps vs. competitors</p>
<ul style="margin:0 0 18px;padding-left:20px;">
${(topGaps.length ? topGaps : [{title:'See attached report',detail:''}]).map(l=>`<li style="margin-bottom:7px;"><b>${esc(l.title||'')}.</b> ${esc(l.detail||'')}</li>`).join('')}
</ul>
${recommendations.length ? `<p style="font-weight:bold;margin:0 0 6px;color:#111111;">Top move</p>
<p style="margin:0 0 18px;">&rarr; <b>${esc(recommendations[0].title||'')}.</b> ${esc(recommendations[0].detail||'')}</p>` : ''}
${positioning ? `<p style="margin:0 0 18px;padding:12px 16px;background:#f4f4f4;border-left:3px solid #9a9a9a;font-style:italic;">&ldquo;${positioning}&rdquo;</p>` : ''}
<p style="margin:0 0 18px;"><b>${competitors.length}</b> competitor${competitors.length===1?'':'s'} analyzed via web search. The full designed report &mdash; gap matrix, recommendations, and a ready-to-post campaign (email + LinkedIn + X + Instagram) &mdash; is attached as a <b>PDF</b>.</p>
<p style="font-size:12px;color:#9a9a9a;margin:18px 0 0;">All campaign copy is a draft for review. Nothing is auto-posted or sent to customers.</p>
</div>`;

const slug = (norm.companyHost || 'report').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
const pdfFilename = `competitive-edge-${slug}.pdf`;

return [{
  json: {
    to: norm.notifyEmail,
    subject: `Competitive Edge Report + Campaign — ${norm.companyLabel || 'your company'}`,
    reportHtml: html,   // full designed report → rendered to PDF by the next node
    summaryHtml,        // email body (Gmail-safe)
    pdfFilename,
    themeApplied: T.label,
  },
}];
