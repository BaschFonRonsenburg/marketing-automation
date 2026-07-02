"""Scrapes a business's own public website for use as LLM research context.

Framework-free (no Streamlit import) so it's callable/testable standalone:
    python -m tools.scrape_business_site https://example.com
"""

import re
import sys
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

USER_AGENT = "AIAutomationSalesDemoBot/1.0 (+contact: sales-demo@example.com)"
STRIP_TAGS = ["script", "style", "nav", "footer", "header", "noscript"]
THIN_CONTENT_THRESHOLD = 150


@dataclass
class ScrapeResult:
    success: bool
    url: str
    pages_fetched: list = field(default_factory=list)
    text: str = ""
    char_count: int = 0
    error: str = None
    # error_type: one of "invalid_url" | "robots_disallowed" | "timeout"
    #             | "connection_error" | "http_error" | "thin_content" | "unknown" | None
    error_type: str = None


def normalize_url(raw_input: str) -> str:
    """Add https:// if missing, strip whitespace. Raises ValueError if unparseable."""
    candidate = raw_input.strip()
    if not candidate:
        raise ValueError("empty input")
    if not re.match(r"^https?://", candidate, re.IGNORECASE):
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    if not parsed.netloc or "." not in parsed.netloc:
        raise ValueError(f"not a parseable URL: {raw_input!r}")
    return candidate


def can_fetch(url: str, user_agent: str = USER_AGENT) -> bool:
    """Check robots.txt. Defaults to True if robots.txt is unreachable/404,
    but returns False if it explicitly disallows the path for our user-agent."""
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = RobotFileParser()
    parser.set_url(robots_url)
    try:
        parser.read()
    except Exception:
        return True
    return parser.can_fetch(user_agent, url)


def find_about_page_link(homepage_html: str, base_url: str):
    """Look for <a> tags whose href or text contains 'about', return first absolute match."""
    soup = BeautifulSoup(homepage_html, "html.parser")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)
        if "about" in href.lower() or "about" in text.lower():
            return urljoin(base_url, href)
    return None


def extract_visible_text(html: str, max_chars: int = 4000) -> str:
    """Strip boilerplate tags, extract visible text, collapse whitespace, truncate."""
    soup = BeautifulSoup(html, "html.parser")
    for tag_name in STRIP_TAGS:
        for tag in soup.find_all(tag_name):
            tag.decompose()
    text = soup.get_text(separator=" ")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_chars]


def _fetch(url: str, timeout: float):
    """Single GET with a descriptive User-Agent. Returns requests.Response."""
    return requests.get(
        url,
        timeout=timeout,
        headers={"User-Agent": USER_AGENT},
    )


def scrape_business_site(
    business_input: str,
    timeout: float = 8.0,
    max_chars: int = 4000,
    user_agent: str = USER_AGENT,
) -> ScrapeResult:
    """Orchestrates: normalize URL -> robots check -> GET homepage -> extract text
    -> try About page -> merge -> truncate. Never raises; always returns a ScrapeResult."""
    try:
        url = normalize_url(business_input)
    except ValueError:
        return ScrapeResult(
            success=False,
            url=business_input,
            error="Enter a valid business name or website URL.",
            error_type="invalid_url",
        )

    try:
        if not can_fetch(url, user_agent):
            return ScrapeResult(
                success=False,
                url=url,
                error="This site's robots.txt disallows automated access — please paste a short description manually.",
                error_type="robots_disallowed",
            )

        pages_fetched = []
        combined_text = ""

        try:
            resp = _fetch(url, timeout)
        except requests.exceptions.Timeout:
            return ScrapeResult(
                success=False, url=url,
                error="The site took too long to respond.",
                error_type="timeout",
            )
        except requests.exceptions.ConnectionError:
            return ScrapeResult(
                success=False, url=url,
                error="Couldn't reach that site — check the URL.",
                error_type="connection_error",
            )

        if resp.status_code >= 400:
            return ScrapeResult(
                success=False, url=url,
                error=f"The site blocked automated access (HTTP {resp.status_code}).",
                error_type="http_error",
            )
        if "text/html" not in resp.headers.get("Content-Type", ""):
            return ScrapeResult(
                success=False, url=url,
                error="That page isn't a readable HTML page.",
                error_type="http_error",
            )

        pages_fetched.append(url)
        combined_text += extract_visible_text(resp.text, max_chars)

        about_url = find_about_page_link(resp.text, url)
        if about_url and can_fetch(about_url, user_agent):
            try:
                about_resp = _fetch(about_url, timeout)
                if about_resp.status_code < 400 and "text/html" in about_resp.headers.get("Content-Type", ""):
                    pages_fetched.append(about_url)
                    combined_text += " " + extract_visible_text(about_resp.text, max_chars)
            except requests.exceptions.RequestException:
                pass  # about page is best-effort; homepage content alone is fine

        combined_text = combined_text.strip()[:max_chars]

        if len(combined_text) < THIN_CONTENT_THRESHOLD:
            return ScrapeResult(
                success=True,
                url=url,
                pages_fetched=pages_fetched,
                text=combined_text,
                char_count=len(combined_text),
                error="Very little text could be extracted (the site may require JavaScript) — consider pasting extra context manually.",
                error_type="thin_content",
            )

        return ScrapeResult(
            success=True,
            url=url,
            pages_fetched=pages_fetched,
            text=combined_text,
            char_count=len(combined_text),
        )

    except Exception as exc:  # never let an unexpected error crash a live demo
        return ScrapeResult(
            success=False, url=business_input,
            error=f"Unexpected error while scraping: {exc}",
            error_type="unknown",
        )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m tools.scrape_business_site <business name or URL>")
        sys.exit(1)
    result = scrape_business_site(sys.argv[1])
    print(result)
