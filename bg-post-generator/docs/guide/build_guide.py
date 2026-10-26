"""Build the operator guide PDF: guide.html + guide.css → headless Chrome → PyMuPDF (header and page numbers).

    python3 docs/guide/build_guide.py

Needs Google Chrome (or set CHROME=/path/to/chrome) and PyMuPDF (`pip install pymupdf`).
"""
import os
import pathlib
import subprocess
import tempfile

import fitz

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent / "Bride-Groom-Post-Generator-Operator-Guide.pdf"
TITLE = "Bride&Groom Post Generator — Operator Guide"
CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def render(raw: pathlib.Path) -> None:
    with tempfile.TemporaryDirectory() as profile:
        subprocess.run([
            CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer",
            f"--user-data-dir={profile}", f"--print-to-pdf={raw}",
            (HERE / "guide.html").as_uri(),
        ], check=True, capture_output=True, timeout=120)


def decorate(raw: pathlib.Path) -> None:
    doc = fitz.open(str(raw))
    n = len(doc)
    for i, page in enumerate(doc):
        if i == 0:
            continue
        w, h = page.rect.width, page.rect.height
        grey = (0.45, 0.45, 0.5)
        page.insert_text((57, 38), TITLE, fontname="helv", fontsize=8, color=grey)
        label = f"{i + 1} / {n}"
        page.insert_text((w - 57 - fitz.get_text_length(label, "helv", 8), h - 30), label, fontname="helv", fontsize=8, color=grey)
        page.draw_line((57, 46), (w - 57, 46), color=(0.85, 0.85, 0.88), width=0.5)
    doc.set_metadata({"title": TITLE, "author": "Bride&Groom", "subject": "How to create Instagram posts with Claude Code and Figma"})
    doc.save(str(OUT), garbage=3, deflate=True)
    doc.close()


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        raw = pathlib.Path(tmp) / "raw.pdf"
        render(raw)
        decorate(raw)
    print(OUT)
