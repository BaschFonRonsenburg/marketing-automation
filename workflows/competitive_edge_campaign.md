# Workflow: Competitive Edge Campaign Builder (n8n)

## Objective
Given one company (URL + optional audience), auto-discover its competitors via web
search, analyze where the company trails them, and produce a **ready-to-post ad
campaign** (marketing email + LinkedIn / X / Instagram). Everything is emailed to the
operator as a single, **industry-themed HTML report**. Drafts only — nothing is posted
or sent to customers automatically. Built as a portfolio / live-demo piece.

This replaces the old Streamlit outreach demo (`app.py`, `tools/`), which is kept as
reference but superseded.

## How it runs
Deployed as an n8n workflow. Trigger = **n8n Form Trigger** (a hosted web form). The
operator submits a company; the form returns immediately ("being generated…") and the
report arrives by email a few minutes later.

Build artifacts live in [`../n8n/`](../n8n/):
- `code/*.js` — the exact body of each Code node (edit these, not the JSON).
- `prompts/*.txt` — the three LLM prompts.
- `schemas/*.example.json` — output-shape examples for the Structured Output Parsers.
- `build_workflow.js` — assembles everything into the importable JSON.
- `competitive_edge_campaign.workflow.json` — **import this into n8n.**

To regenerate the JSON after editing any code/prompt/schema:
```
cd n8n && node build_workflow.js
```

## Node flow (18 nodes)
1. **Campaign Request Form** (`formTrigger`) — fields: Company website URL (required),
   Company name, Target audience, Your name/brand, Notify email. `responseMode: onReceived`.
2. **Normalize Input** (`code`) — normalize URL, derive host + company label, apply defaults.
3. **Fetch Company Site** (`httpRequest`, text, neverError) — GET the homepage.
4. **Clean Company Text** (`code`) — regex strip tags → visible text (~4000 chars).
   Port of the BeautifulSoup logic in the old `tools/scrape_business_site.py`.
5. **Company Profile** (`chainLlm` + Claude + Profile Schema) → `{ company_name, industry,
   location, search_query }`.
6. **DuckDuckGo Search** (`httpRequest`, **keyless**) — GET `html.duckduckgo.com/html/?q=…`
   with a browser User-Agent. No API key or signup.
7. **Extract Competitors** (`code`) — parse DDG result links (decode the `uddg=` redirect),
   drop own domain + aggregators (Yelp/FB/TripAdvisor/…), dedupe, cap 3. Emits one item per competitor.
8. **Fetch Competitor Site** (`httpRequest`) — scrape each competitor (runs per item).
9. **Clean Competitor Text** (`code`) — text-extract each, aligned by index; dead sites tolerated.
10. **Aggregate Context** (`code`) — merge company + competitors into one item + a prompt block.
11. **Gap Analysis** (`chainLlm` + Claude + Analysis Schema) → limitations, capability matrix,
    recommendations, positioning_angle, **and the `theme` (industry → report skin)**.
12. **Campaign Copy** (`chainLlm` + Claude + Campaign Schema) → email + social drafts.
13. **Assemble Report** (`code`) — build the themed report HTML (theme-preset library lives here);
    outputs `reportHtml` (full designed report → PDF) + `summaryHtml` (Gmail-safe email body) + `pdfFilename`.
14. **Render PDF** (`httpRequest`, POST) — send `reportHtml` to PDFShift → PDF binary (`data`).
15. **Name PDF** (`code`) — set a friendly filename/mime on the PDF binary.
16. **Email Report** (`gmail`, send) — body = `summaryHtml` (findings summary), **PDF attached**.

**Why PDF:** Gmail strips flexbox/grid, so the full HTML report collapses when emailed directly.
A PDF is Chromium-rendered, so the exact designed report survives — the email carries a clean
summary and the polished report rides along as an attachment.

**Shared AI sub-nodes:** one **Gemini** (`lmChatGoogleGemini`, `models/gemini-2.5-flash`, free
tier) model feeds all three chains; each chain has its own **Structured Output Parser**.

## Adaptive theming
`Assemble Report` holds a `THEMES` preset library (palette + fonts + inline-SVG motif). The
Gap Analysis LLM returns `theme.preset_key` (`cozy_warm`, `fresh_modern`, `trust_corporate`,
`vital_energetic`, `earthy_craft`, or `recon_neutral` fallback) plus a tuned `accent_hex` and
`motif_key`. The layout skeleton is fixed; only the skin changes. Motifs are inline SVG —
**never external images** — so they survive email clients; the themed background color always
carries the look if a motif is stripped. Design reference: `../templates/report-mockup-*.html`.

## Credentials required (attach after import) — all FREE
- **Google Gemini** (`Google Gemini(PaLM) Api`) → on the **Gemini** node. Get a free API key at
  aistudio.google.com (no credit card, no phone). This is the only signup needed.
- **Search** → none. **DuckDuckGo Search** is keyless.
- **PDFShift** (HTML→PDF) → create an n8n **Header Auth** credential: Name = `X-API-Key`,
  Value = your free PDFShift API key. Attach to **Render PDF**. Free tier ~50 PDFs/mo, email
  signup, no card. (Basic Auth with the key as username also works per PDFShift docs, but
  Header Auth is less error-prone in n8n.) Swappable for Browserless / html2pdf.app.
- **Gmail OAuth2** → on **Email Report**. Reuse the credential from the job-scraper workflow.
- (Dropped: Anthropic — paid; SerpApi — phone-verification blocked.)

## Edge cases & failure handling
- Unreachable company site → `neverError` + `onError: continueRegularOutput`; the LLM works
  from whatever text (or the name/URL) it has.
- A competitor site that blocks/times out → skipped (index-aligned), run still completes.
- DuckDuckGo returns nothing / throttled → `Extract Competitors` emits a `_noCompetitors`
  marker; the report is produced with an empty competitor set and says so. (DDG can throttle
  datacenter IPs; this runs on a self-hosted residential IP, where it's reliable.)
- Unknown industry → `Assemble Report` falls back to the `recon_neutral` theme.
- All fetch nodes: `retryOnFail` (2 tries), `alwaysOutputData`.

## Legal / ethical notes
- Only public pages are read — the company's own site + auto-discovered competitor homepages.
- Competitor capability ratings are **inferred** from public pages; the report says so and
  flags that they need a human sanity-check.
- All campaign copy is a **draft for human review**. Nothing is posted or sent automatically.
- A descriptive `User-Agent` is sent. (Unlike the old Streamlit tool this does not yet check
  `robots.txt` — see Lessons Learned before any high-volume use.)

## Verification (once credentials are attached)
1. Import `n8n/competitive_edge_campaign.workflow.json`; attach Gemini + Gmail credentials; **Activate**.
2. Open the Form URL, submit a real company (e.g. a local café or a SaaS site).
3. Confirm the email arrives with: filled gap matrix, limitations + recommendations, all four
   campaign drafts, and a **theme matching the industry**.
4. Try a second, different-industry company to confirm the skin changes.

## Lessons Learned
_(Update as real runs surface quirks — SerpApi rate limits, sites that block scraping, prompt
tweaks, theme misclassifications, whether robots.txt checking needs to be added, etc.)_
