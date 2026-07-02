"""Generates personalized outreach drafts (email + social post) via the Anthropic API.

Pure LLM-call logic, no Streamlit import. Standalone test:
    python -m tools.generate_outreach
"""

import os
from dataclasses import dataclass

import anthropic
from dotenv import load_dotenv

load_dotenv()  # no-op if already loaded by the caller (e.g. app.py); lets this
                # module also be run standalone via `python -m tools.generate_outreach`

DEFAULT_MODEL = os.environ.get("MODEL_NAME", "claude-sonnet-5")

_SYSTEM_PROMPT = (
    "You write concise, specific, non-generic cold outreach and social content. "
    "Avoid flattery clichés and buzzwords. Reference concrete facts from the "
    "research context provided. Never invent facts not present in that context. "
    "Output only the requested content itself — no preamble, no \"Here's a draft:\", "
    "no explanation."
)

_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
    return _client


@dataclass
class LLMResult:
    success: bool
    text: str = ""
    error: str = None
    model: str = None


def _call_claude(user_prompt: str, model: str, max_tokens: int) -> LLMResult:
    try:
        client = _get_client()
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except anthropic.AuthenticationError:
        return LLMResult(success=False, error="Anthropic API key is missing or invalid — check .env")
    except anthropic.RateLimitError:
        return LLMResult(success=False, error="Rate limited by Anthropic — wait a few seconds and try again")
    except anthropic.APIConnectionError:
        return LLMResult(success=False, error="Network error reaching Anthropic API — check your connection")
    except anthropic.APIStatusError as e:
        return LLMResult(success=False, error=f"Anthropic API error ({e.status_code}): {e.message}")
    except Exception as exc:  # never let an unexpected error crash a live demo
        return LLMResult(success=False, error=f"Unexpected error calling Anthropic API: {exc}")

    text = next((block.text for block in response.content if block.type == "text"), "")
    return LLMResult(success=True, text=text.strip(), model=model)


def generate_outreach_email(
    business_name: str,
    research_context: str,
    sender_name: str = "there",
    sender_service_description: str = "AI automation for marketing",
    tone: str = "warm, professional, concise",
    model: str = DEFAULT_MODEL,
    max_tokens: int = 700,
) -> LLMResult:
    """Drafts a short (120-180 word) personalized cold email referencing 1-2
    specific, concrete details from research_context."""
    prompt = f"""Write a cold outreach email to {business_name}.

Research context (from their own website):
\"\"\"
{research_context}
\"\"\"

Sender name: {sender_name}
Sender's service: {sender_service_description}
Tone: {tone}

Requirements:
- 120-180 words.
- Reference 1-2 specific, concrete details from the research context.
- Make clear how the sender's service could help this specific business.
- End with a low-friction call to action (e.g. a short call).
- Output only the email body (including a greeting and sign-off), nothing else."""
    return _call_claude(prompt, model, max_tokens)


def generate_social_post(
    business_name: str,
    research_context: str,
    platform: str = "LinkedIn",
    model: str = DEFAULT_MODEL,
    max_tokens: int = 300,
) -> LLMResult:
    """Drafts a short (40-80 word) on-brand social post/caption showcasing personalization."""
    prompt = f"""Write a short {platform} post that {business_name} could plausibly publish,
based on the following research about them (from their own website):
\"\"\"
{research_context}
\"\"\"

Requirements:
- 40-80 words.
- On-brand for the business based on the research context.
- Reference at least one specific, concrete detail from the research context.
- Output only the post text, nothing else."""
    return _call_claude(prompt, model, max_tokens)


if __name__ == "__main__":
    sample_context = (
        "Riverside Bakery is a family-owned bakery in Portland specializing in "
        "sourdough bread and seasonal fruit tarts. Founded in 2015, they source "
        "flour from local Oregon mills and offer weekly baking classes for kids."
    )
    email_result = generate_outreach_email("Riverside Bakery", sample_context, sender_name="Ryan")
    print("--- EMAIL ---")
    print(email_result.text if email_result.success else f"ERROR: {email_result.error}")

    social_result = generate_social_post("Riverside Bakery", sample_context)
    print("\n--- SOCIAL POST ---")
    print(social_result.text if social_result.success else f"ERROR: {social_result.error}")
