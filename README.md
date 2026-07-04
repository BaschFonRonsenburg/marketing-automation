# Marketing Automation

Two AI marketing tools built as portfolio pieces:

1. **Competitive Edge Campaign Builder** — an n8n workflow that turns one company URL into a
   competitor gap analysis **and** a ready-to-post ad campaign, delivered as a polished PDF. *(main project)*
2. **Live Sales Demo** — an earlier Streamlit app that drafts a personalized cold email + social post
   from a prospect's website. *(kept for reference)*

---

## 1. Competitive Edge Campaign Builder (n8n)

You give it a company. A few minutes later you get an email with a designed **PDF report** that shows
where that company is losing to its competitors and hands you a full ad campaign to fix it — all
generated automatically, nothing posted or sent to customers without your review.

### How it works

1. **You submit a company website** in a simple web form (the workflow's built-in form trigger).
2. **It reads the company's own site** and figures out what the business is and what to search for.
3. **It finds real competitors** with a keyless web search, then reads each competitor's site.
4. **AI analyzes the gaps** — where the company trails its rivals — and writes prioritized
   recommendations plus a positioning angle (Google Gemini does the reasoning).
5. **AI writes the campaign** — a marketing email + LinkedIn, X, and Instagram posts with hashtags.
6. **A themed report is built** that automatically re-skins to match the company's industry
   (a coffee shop gets a warm, cozy look; a SaaS gets a clean modern one; etc.).
7. **You get an email** with a short summary of the findings and the **full report attached as a PDF**.

Everything is a **draft for human review** — the tool never posts to social media or emails customers.

### Built with (all free-tier friendly)

- **n8n** — the workflow engine (self-hosted or cloud)
- **Google Gemini** — the AI writing/analysis (free Google AI Studio key)
- **DuckDuckGo** — competitor discovery (no API key needed)
- **PDFShift** — turns the HTML report into a PDF (free tier)
- **Gmail** — sends the finished report

### Run it

1. In n8n: **Import from File** → [`n8n/competitive_edge_campaign.workflow.json`](n8n/competitive_edge_campaign.workflow.json).
2. Add three credentials: **Google Gemini** (on the *Gemini* node), **PDFShift** (Header Auth,
   `X-API-Key`, on the *Render PDF* node), and **Gmail** (on the *Email Report* node).
3. Activate the workflow, open the form's URL, and submit a company. The report lands in your inbox.

Full step-by-step + design notes: [`workflows/competitive_edge_campaign.md`](workflows/competitive_edge_campaign.md).

### How the n8n folder is organized

The workflow JSON is generated from small, readable source files so it's easy to edit:

- `n8n/code/` — the JavaScript for each processing step (URL cleanup, scraping, competitor
  extraction, report + PDF assembly)
- `n8n/prompts/` — the AI prompts (company profile, gap analysis, campaign copy)
- `n8n/schemas/` — example JSON shapes that keep the AI's output structured
- `n8n/build_workflow.js` — assembles all of the above into the importable workflow
  (`node build_workflow.js` regenerates `competitive_edge_campaign.workflow.json`)
- `templates/` — standalone HTML previews of the report design (open in a browser)

---

## 2. Live Sales Demo (Streamlit) — earlier version

A Streamlit app for live client calls: enter a prospect's business name/URL, it scrapes their own
public site for context, and drafts a personalized cold outreach email and social post with Claude.
A second tab showcases case studies.

### How it works

1. You enter a business name or URL.
2. The app scrapes that business's own public site (`tools/scrape_business_site.py`) — it respects
   `robots.txt`, reads the homepage + an About page, and extracts up to ~4,000 characters of text.
   If the site can't be scraped, it falls back to a manual-paste box.
3. That context is sent to Claude (`tools/generate_outreach.py`), which drafts a short cold email +
   a social post, each grounded in concrete details from the site.
4. Both drafts are editable — nothing is ever sent automatically.
5. The **Case Studies tab** renders `data/case_studies.yaml` as cards.

### Setup

```
pip install -r requirements.txt
cp .env.example .env    # then add your Anthropic API key
streamlit run app.py
```

- `app.py` — Streamlit UI (thin orchestrator, calls into `tools/`)
- `tools/` — standalone Python scripts, each testable via `python -m tools.<name>`
- `data/case_studies.yaml` — editable case-study content

---

_No secrets are committed — `.env` is gitignored, and API keys live only in your n8n credentials or
your local `.env`. All generated marketing copy is a draft for human review._
