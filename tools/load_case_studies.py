"""Loads case-study content from a YAML file for display in the portfolio demo.

Pure data-loading logic, no Streamlit import.
"""

from dataclasses import dataclass, field

import yaml


@dataclass
class CaseStudy:
    client_name: str
    client_type: str = ""
    challenge: str = ""
    solution: str = ""
    results: list = field(default_factory=list)  # [{"metric": "...", "value": "..."}]
    testimonial: str = ""
    testimonial_author: str = ""


def load_case_studies(path: str = "data/case_studies.yaml") -> list:
    """Returns [] (not an exception) if the file is missing, empty, or malformed.
    Entries missing the required client_name are skipped."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
    except (FileNotFoundError, yaml.YAMLError):
        return []

    if not raw or not isinstance(raw, list):
        return []

    case_studies = []
    for entry in raw:
        if not isinstance(entry, dict) or not entry.get("client_name"):
            continue
        case_studies.append(
            CaseStudy(
                client_name=entry.get("client_name", ""),
                client_type=entry.get("client_type", ""),
                challenge=entry.get("challenge", ""),
                solution=entry.get("solution", ""),
                results=entry.get("results", []) or [],
                testimonial=entry.get("testimonial", ""),
                testimonial_author=entry.get("testimonial_author", ""),
            )
        )
    return case_studies


if __name__ == "__main__":
    for cs in load_case_studies():
        print(cs)
