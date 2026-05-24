#!/usr/bin/env python3
"""Generate empty competition/club page shells for the static site build.

Live listings come from approved submissions in Supabase, not from TFS Activities.xlsx.
"""

import html
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "TFS Activities.xlsx"
TEMPLATES = ROOT / "src" / "templates"

COMPETITION_SHEETS = [
    "Math",
    "Science",
    "Debate",
    "Robotics",
    "Chess",
    "Latin",
    "Social Sciences",
    "MISC",
]

SKIP_SHEETS = {"Instructions", "Clubs", "FBLA"}


def esc(value: str) -> str:
    if not value:
        return ""
    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    return html.escape(text, quote=True)


def cell_str(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%B %d, %Y")
    return str(value).strip()


def normalize_link(value: str) -> tuple[str, str]:
    if not value:
        return "", ""
    if value.startswith("http://") or value.startswith("https://"):
        return value, ""
    return "", value


def is_header_row(name: str, row: list[str]) -> bool:
    if name.lower() in {"description", "subcategory"}:
        return True
    joined = " ".join(row).lower()
    if "description" in joined and "test format" in joined:
        return True
    if name.startswith("http"):
        return True
    if "example information" in joined or "place competition subcategories" in joined:
        return True
    return False


def parse_competition_row(cells: list[str], category: str) -> dict | None:
    name = cells[0] if cells else ""

    if not name:
        if len(cells) < 2 or not cells[1] or cells[1].lower() == "description":
            return None
        description = cells[1] if len(cells) > 1 else ""
        test_format = cells[2] if len(cells) > 2 else ""
        contact = cells[3] if len(cells) > 3 else ""
        eligibility = cells[4] if len(cells) > 4 else ""
        period = cells[5] if len(cells) > 5 else ""
        level = cells[6] if len(cells) > 6 else ""
        link_raw = cells[7] if len(cells) > 7 else ""
        link, link_note = normalize_link(link_raw)
        if link_note and not link:
            name = link_note
            link_note = ""
        else:
            name = description.split(".")[0][:80] if description else f"{category} Competition"
    else:
        description = cells[1] if len(cells) > 1 else ""
        test_format = cells[2] if len(cells) > 2 else ""
        contact = cells[3] if len(cells) > 3 else ""
        eligibility = cells[4] if len(cells) > 4 else ""
        period = cells[5] if len(cells) > 5 else ""
        level = cells[6] if len(cells) > 6 else ""
        link_raw = cells[7] if len(cells) > 7 else ""
        link, link_note = normalize_link(link_raw)

    if not description and not test_format and level and not contact:
        description = f"Frazer School participates at the {level} level."
    elif not description:
        description = "Details coming soon."

    if link_note:
        description = f"{description} {link_note}".strip()

    if not name:
        return None

    return {
        "category": category,
        "name": name,
        "description": description,
        "format": test_format,
        "contact": contact,
        "eligibility": eligibility,
        "period": period,
        "level": level,
        "link": link,
    }


def parse_competition_sheet(ws, category: str) -> list[dict]:
    entries = []
    for row in ws.iter_rows(values_only=True):
        cells = [cell_str(c) for c in row]
        if not any(cells):
            continue

        name = cells[0] if cells else ""
        if name and is_header_row(name, cells):
            continue
        if name.startswith("^^") or "pls expand" in name.lower():
            continue

        entry = parse_competition_row(cells, category)
        if entry:
            entries.append(entry)
    return entries


def parse_clubs_sheet(ws) -> list[dict]:
    entries = []
    for row in ws.iter_rows(values_only=True):
        cells = [cell_str(c) for c in row]
        name = cells[0] if cells else ""
        if not name or name.lower() == "description":
            continue
        if "pls expand" in name.lower():
            continue

        description = cells[1] if len(cells) > 1 else ""
        contact = cells[2] if len(cells) > 2 else ""
        eligibility = cells[3] if len(cells) > 3 else ""
        period = cells[4] if len(cells) > 4 else ""
        link_raw = cells[5] if len(cells) > 5 else ""
        notes = cells[6] if len(cells) > 6 else ""

        link, link_note = normalize_link(link_raw)
        if link_note:
            notes = f"{notes} {link_note}".strip() if notes else link_note

        if not any([description, contact, eligibility, period, link, notes]):
            if name in {"CoderGirls", "Computer Science Club", "Heart and Sole"}:
                entries.append(
                    {
                        "name": name,
                        "description": "",
                        "contact": "",
                        "eligibility": "",
                        "period": "",
                        "link": "",
                        "notes": "",
                    }
                )
            continue

        entries.append(
            {
                "name": name,
                "description": description,
                "contact": contact,
                "eligibility": eligibility,
                "period": period,
                "link": link,
                "notes": notes,
            }
        )
    return entries


def slugify(value: str) -> str:
    text = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return text or "entry"


def placeholder(text: str, fallback: str = "Details coming soon.") -> str:
    return text if text else fallback


def competition_entry_tag(entry: dict) -> str:
    attrs = {
        "slug": slugify(entry["name"]),
        "name": entry["name"],
        "description": placeholder(entry["description"]),
        "format": placeholder(entry["format"], "N/A"),
        "contact": placeholder(entry["contact"]),
        "eligibility": placeholder(entry["eligibility"]),
        "period": placeholder(entry["period"]),
        "level": placeholder(entry["level"]),
        "link": entry["link"] or "",
    }
    parts = [f'{key}="{esc(val)}"' for key, val in attrs.items()]
    return f"        <competition-entry {' '.join(parts)}></competition-entry>"


def club_entry_tag(entry: dict) -> str:
    attrs = {
        "slug": slugify(entry["name"]),
        "name": entry["name"],
        "description": placeholder(entry["description"]),
        "contact": placeholder(entry["contact"]),
        "eligibility": placeholder(entry["eligibility"]),
        "period": placeholder(entry["period"]),
        "link": entry["link"] or "",
        "notes": entry["notes"] or "",
    }
    parts = [f'{key}="{esc(val)}"' for key, val in attrs.items()]
    return f"        <club-entry {' '.join(parts)}></club-entry>"


def write_competitions(by_category: dict[str, list[dict]]) -> None:
    lines = [
        '<section class="section competitions-page">',
        "  <div class=\"container\">",
        '    <div id="contextual-submit" class="contextual-submit" hidden></div>',
        '    <div id="competitions-live-notice"></div>',
        "    <p class=\"section-intro\">Competitions on this page are added after a parent proposal is submitted and a PTA admin approves it.</p>",
        '    <nav class="category-nav" aria-label="Competition categories">',
    ]
    for category in COMPETITION_SHEETS:
        lines.append(
            f'      <a href="#{slugify(category)}">{html.escape(category)}</a>'
        )
    lines.append("    </nav>")

    for category in COMPETITION_SHEETS:
        lines.append(f'    <div class="competition-category" id="{slugify(category)}">')
        lines.append(f'      <h3 class="school-tier-title">{html.escape(category)}</h3>')
        lines.append('      <div class="competition-list"></div>')
        lines.append("    </div>")

    lines.extend(["  </div>", "</section>", ""])
    (TEMPLATES / "site-competitions.html").write_text("\n".join(lines), encoding="utf-8")


def write_clubs(entries: list[dict]) -> None:
    lines = [
        '<section class="section clubs-page">',
        "  <div class=\"container\">",
        '    <div id="contextual-submit" class="contextual-submit" hidden></div>',
        '    <div id="clubs-live-notice"></div>',
        "    <p class=\"section-intro\">Clubs on this page are added after a parent proposal is submitted and a PTA admin approves it.</p>",
        '    <div class="club-list">',
        "    </div>",
        "  </div>",
        "</section>",
        "",
    ]
    (TEMPLATES / "site-clubs.html").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    # Live competitions/clubs come from approved submissions in Supabase, not the spreadsheet.
    write_competitions({})
    write_clubs([])

    print(f"Generated empty competition shells ({len(COMPETITION_SHEETS)} categories)")
    print("Generated empty clubs shell")
    print("Spreadsheet rows are not written to the public site.")


if __name__ == "__main__":
    main()
