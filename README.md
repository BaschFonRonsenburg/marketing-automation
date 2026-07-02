# AI Automation — Live Sales Demo

A Streamlit app for live client calls: enter a prospect's business name/URL,
it scrapes their own public site for context, and drafts a personalized cold
outreach email and social post with Claude. A second tab showcases case studies.

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
