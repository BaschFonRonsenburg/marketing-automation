# AI Automation — Live Sales Demo

A Streamlit app for live client calls: enter a prospect's business name/URL,
it scrapes their own public site for context, and drafts a personalized cold
outreach email and social post with Claude. A second tab showcases case studies.

## How it works

1. **You enter a business name or URL** in the "Generate Outreach" tab.
2. **The app scrapes that business's own public site** (`tools/scrape_business_site.py`):
   it checks `robots.txt` first, fetches the homepage plus an "About" page if
   one is linked, strips boilerplate (nav/footer/scripts), and extracts up to
   ~4,000 characters of visible text as research context. If the site can't be
   scraped (blocked by robots.txt, unreachable, or mostly JS-rendered with too
   little text), the app falls back to a manual-paste box so the demo can
   continue without interruption.
3. **That research context is sent to Claude** (`tools/generate_outreach.py`),
   which drafts a 120-180 word cold outreach email and a short social post,
   each required to reference specific, concrete details from the scraped
   content rather than generic filler.
4. **Both drafts are shown as editable text** — nothing is ever sent or posted
   automatically. A human reviews and copies the draft into their own email
   client or social scheduler.
5. The **Case Studies tab** reads `data/case_studies.yaml` and renders each
   entry as a card, so the demo can show past results alongside the live
   generation.

Only two API calls happen per generation (the site scrape and the Claude
request), which keeps the live-demo experience fast and predictable.

## Setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
2. Copy `.env.example` to `.env` and fill in your Anthropic API key:
   ```
   cp .env.example .env
   ```
3. Run the app:
   ```
   streamlit run app.py
   ```

## Project layout

- `app.py` — Streamlit UI (thin orchestrator, calls into `tools/` only)
- `tools/` — standalone Python scripts (scraping, LLM calls, data loading), each testable via `python -m tools.<name>`
- `workflows/generate_personalized_outreach.md` — SOP for the outreach-generation flow
- `data/case_studies.yaml` — editable case-study content shown in the demo (no code changes needed)

## Adding real case studies

Edit `data/case_studies.yaml` and replace the `[PLACEHOLDER]` entries with real
client results. Only `client_name` is required per entry.

## Testing individual tools

```
python -m tools.scrape_business_site https://example.com
python -m tools.generate_outreach
python -m tools.load_case_studies
```
