# Workflow: Generate Personalized Cold Outreach (Live Sales Demo)

## Objective
During a live sales call, take a prospect's business name/website and produce
a personalized cold outreach email draft and a matching social media post
draft, using only public information from the business's own website —
demonstrating the "AI automation for marketing" service capability in real time.

## When This Runs
Triggered manually by the freelancer clicking "Research & Generate" in the
Streamlit app (`app.py`, "Generate Outreach" tab). Not automated/scheduled.

## Required Inputs
- Business name and/or website URL (typed into the app by the freelancer)
- A valid `ANTHROPIC_API_KEY` in `.env`

## Tools Used (in order)
1. `tools/scrape_business_site.py :: scrape_business_site(business_input)`
   → returns homepage(+about page) text, or a structured error
2. `tools/generate_outreach.py :: generate_outreach_email(...)`
   → returns a cold email draft
3. `tools/generate_outreach.py :: generate_social_post(...)`
   → returns a social post draft

## Expected Outputs
- `research_context`: the scraped text (shown to the freelancer for transparency,
  in a collapsible section)
- `email_draft`: editable text, ready to copy into an email client
- `social_draft`: editable text, ready to copy into a social scheduler

Neither draft is ever auto-sent. This tool only produces drafts for human review.

## Edge Cases & Failure Handling
- **Invalid/unreachable URL** → show error, offer a manual-paste textarea as a
  fallback research context so the demo can continue without the scrape step.
- **robots.txt disallows scraping** → do not scrape; show the same manual-paste
  fallback. Do not attempt to bypass.
- **Timeout / connection error** → friendly error, same fallback.
- **Thin content (likely a JS-rendered site)** → proceed but warn that context
  may be limited; suggest supplementing with manual paste.
- **Anthropic API failure (auth/rate-limit/network)** → friendly error shown
  in-app; freelancer can retry. Never crashes the app mid-call.
- **Case studies file missing/empty** → the Case Studies tab shows a placeholder
  message instead of erroring.

## Legal / Ethical Notes
- Only the target business's own public site is scraped (homepage + about page,
  max 2 requests per generation). No third-party data sources, no login-walled
  content, no deep crawling.
- `robots.txt` is checked and respected before every fetch.
- A descriptive `User-Agent` string is sent so the site owner can identify the
  traffic source.
- All generated content is a *draft* — a human must review before it is sent
  or posted anywhere.
- robots.txt compliance is necessary but not sufficient — some sites' ToS
  prohibit scraping regardless. If a prospect explicitly objects to being
  scraped, use the manual-paste fallback instead.

## Future Extension
If this is later wired into an automated pipeline (e.g., batch-processing a
lead list), an orchestrator can call `tools/scrape_business_site.py` and
`tools/generate_outreach.py` directly in sequence without any changes to
those scripts — only the orchestration layer changes (from this Streamlit UI
to a script/pipeline loop).

## Lessons Learned
_(Update this section as real usage surfaces quirks — rate limits, sites that
consistently block scraping, prompt tweaks that improved output quality, etc.)_
