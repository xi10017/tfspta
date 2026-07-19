#!/usr/bin/env python3
"""Import the staff directory from contacts.csv into the contacts page template."""

import csv
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "contacts.csv"
TEMPLATE_PATH = ROOT / "src" / "templates" / "site-contacts.html"

STAFF_MARKER_START = "<!-- staff-contacts:start -->"
STAFF_MARKER_END = "<!-- staff-contacts:end -->"

def esc(value: str) -> str:
    return html.escape(str(value or "").strip(), quote=True)

def load_staff_rows() -> list[dict]:
    if not CSV_PATH.exists():
        return []

    with CSV_PATH.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        staff = []

        for row in reader:
            section = (row.get("section") or "").strip()
            group = (row.get("group") or "").strip()
            name = (row.get("name") or "").strip()
            email = (row.get("email") or "").strip()
            note = (row.get("note") or "").strip()

            if not section or not group or not name or not email:
                continue

            staff.append(
                {
                    "section": section,
                    "group": group,
                    "name": name,
                    "email": email,
                    "note": note,
                }
            )

        return staff


def render_staff_contact(person: dict) -> str:
    note = f"{esc(person['note'])} — " if person["note"] else ""
    return f'<li>{esc(person["name"])} — {note}<a href="mailto:{esc(person["email"])}">{esc(person["email"])}</a></li>'


def render_staff_section(staff: list[dict]) -> str:
    if not staff:
        return ""

    by_section: dict[str, dict[str, list[dict]]] = {}
    for person in staff:
        by_section.setdefault(person["section"], {}).setdefault(person["group"], []).append(person)

    sections = []
    for section, groups in by_section.items():
        groups_html = []
        for group, people in groups.items():
            entries = "\n          ".join(render_staff_contact(person) for person in people)
            groups_html.append(
                f"""      <div class="contact-directory-group">
        <h4>{esc(group)}</h4>
        <ul class="contact-directory-list">
          {entries}
        </ul>
      </div>"""
            )

        section_html = "\n".join(groups_html)
        sections.append(
            f"""    <div class="school-tier">
      <h3 class="school-tier-title">{esc(section)}</h3>
      <div class="contact-directory-section">
{section_html}
      </div>
    </div>"""
        )

    return "\n\n".join(sections)


def patch_template(staff_html: str) -> None:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    if STAFF_MARKER_START not in template or STAFF_MARKER_END not in template:
        raise SystemExit(f"Missing staff markers in {TEMPLATE_PATH}")

    start = template.index(STAFF_MARKER_START) + len(STAFF_MARKER_START)
    end = template.index(STAFF_MARKER_END)
    updated = template[:start] + "\n" + staff_html + "\n    " + template[end:]
    TEMPLATE_PATH.write_text(updated, encoding="utf-8")


def main() -> None:
    staff = load_staff_rows()
    patch_template(render_staff_section(staff))
    print(f"Imported {len(staff)} staff contact(s) from contacts.csv")


if __name__ == "__main__":
    main()
