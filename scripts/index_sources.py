"""Index user-authorized books locally. Extraction is NOT rules/lore verification."""
import argparse
import hashlib
import json
import sqlite3
import re
import shutil
import subprocess
from pathlib import Path
from pypdf import PdfReader

BOOKS = {
    "Saga Edition Core Rulebook.pdf": "saga_core",
    "Legacy Era Campaign Guide.pdf": "saga_supplement",
    "The Unknown Regions.pdf": "saga_supplement",
    "Threats of the Galaxy.pdf": "saga_supplement",
    "Starships of the Galaxy.pdf": "saga_supplement",
    "The Force Unleashed Campaign Guide.pdf": "saga_supplement",
    "Scum and Villany.pdf": "saga_supplement",
    "Scavenger's Guide to Droids.pdf": "saga_supplement",
    "Star Wars Gamemaster Screen.pdf": "saga_supplement",
    "Knights of the Old Rebuplic Campaign Guide.pdf": "saga_supplement",
    "Jedi Academy Training Manual.pdf": "saga_supplement",
    "Galaxy of Intrigue.pdf": "saga_supplement",
    "Galaxy at War.pdf": "saga_supplement",
    "Arms and Equipment Guide.pdf": "lore_only",
    "Coruscant and the Core Worlds.pdf": "lore_only",
    "Galactic Campaign Guide.pdf": "lore_only",
    "Hero's Guide.pdf": "lore_only",
    "Ultimate Alien Anthology.pdf": "lore_only",
    "Geonosis and the Outer Rim Worlds.pdf": "lore_only",
    "Ultimate Adversaries.pdf": "lore_only",
    "Revised Core Rulebook (1).pdf": "lore_only",
    "Han Solo and the Corporate Sector Sourcebook WEG40042.pdf": "lore_only",
    "Medical Sourcebook.pdf": "unverified_reference",
    "Galaxy Guide 17 Cyborgs and Cybernetics.pdf": "unverified_reference",
    "Star Wars - Force and Destiny - Nexus of Power - Force Worlds (Sourcebook).pdf": "lore_only",
    "Star Wars Galaxy Guide The Corporate Era.pdf": "campaign_draft",
    "Force and Destiny - Core Rulebook.pdf": "lore_only",
    "Star Wars - Dark Side Sourcebook (Sourcebook).pdf": "lore_only",
    "Book of Sith - Secrets from the Dark Side.pdf": "lore_only",
    "Galaxy_of_Consequence_Sourcebook (1).pdf": "campaign_draft",
    "Instructions (2).pdf": "campaign_draft",
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--database", type=Path, default=Path("data/sources.sqlite"))
    parser.add_argument("--book", choices=list(BOOKS))
    args = parser.parse_args()
    args.database.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(args.database)
    db.executescript("""
    CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, title TEXT NOT NULL, authority TEXT NOT NULL,
      sha256 TEXT NOT NULL, page_count INTEGER NOT NULL, status TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS source_pages (source_id TEXT NOT NULL, pdf_page INTEGER NOT NULL,
      printed_page TEXT, text TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(source_id, pdf_page));
    CREATE VIRTUAL TABLE IF NOT EXISTS source_search USING fts5(source_id UNINDEXED, pdf_page UNINDEXED, text);
    CREATE TABLE IF NOT EXISTS ocr_completed(source_id TEXT, pdf_page INTEGER, PRIMARY KEY(source_id,pdf_page));
    """)
    for filename, authority in BOOKS.items():
        if args.book and filename != args.book:
            continue
        path = args.directory / filename
        if not path.is_file():
            print(json.dumps({"book": filename, "status": "missing"}), flush=True)
            continue
        try:
            with path.open("rb") as stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
            previous = db.execute("SELECT sha256 FROM sources WHERE id=?", (filename,)).fetchone()
            if previous and previous[0] == digest:
                print(json.dumps({"book": filename, "status": "unchanged"}), flush=True)
                continue
            reader = PdfReader(path, strict=False)
            text_pages = 0
            with db:
                db.execute("DELETE FROM source_pages WHERE source_id=?", (filename,))
                db.execute("DELETE FROM source_search WHERE source_id=?", (filename,))
                db.execute("DELETE FROM ocr_completed WHERE source_id=?", (filename,))
                for index, page in enumerate(reader.pages, 1):
                    text = page.extract_text() or ""
                    text_pages += len(text.strip()) >= 80
                    db.execute("INSERT INTO source_pages(source_id,pdf_page,text) VALUES(?,?,?)", (filename, index, text))
                    db.execute("INSERT INTO source_search VALUES(?,?,?)", (filename, index, text))
                status = "needs_ocr" if text_pages == 0 else "needs_page_review"
                db.execute("INSERT OR REPLACE INTO sources VALUES(?,?,?,?,?,?)", (filename, filename[:-4], authority, digest, len(reader.pages), status))
            print(json.dumps({"book": filename, "pages": len(reader.pages), "text_pages": text_pages, "status": status}), flush=True)
        except Exception as error:
            db.rollback()
            # Malformed object trees may still render correctly in Poppler.
            # Register their pages for OCR rather than claiming extracted text.
            try:
                renderer = shutil.which("pdftoppm")
                info = Path(renderer).with_name("pdfinfo.exe") if renderer else None
                if not info or not info.exists():
                    raise RuntimeError("Poppler metadata fallback unavailable")
                result = subprocess.run([str(info), str(path)], check=True, capture_output=True, timeout=60)
                count = int(re.search(r"Pages:\s+(\d+)", result.stdout.decode("utf-8", errors="replace")).group(1))
                with db:
                    db.execute("DELETE FROM source_pages WHERE source_id=?", (filename,))
                    db.execute("DELETE FROM source_search WHERE source_id=?", (filename,))
                    db.execute("DELETE FROM ocr_completed WHERE source_id=?", (filename,))
                    for page in range(1, count + 1):
                        db.execute("INSERT INTO source_pages(source_id,pdf_page,text) VALUES(?,?,?)", (filename, page, ""))
                    db.execute("INSERT OR REPLACE INTO sources VALUES(?,?,?,?,?,?)", (filename, filename[:-4], authority, digest, count, "needs_ocr"))
                print(json.dumps({"book": filename, "pages": count, "status": "needs_ocr", "fallback": "poppler"}), flush=True)
            except Exception as fallback_error:
                print(json.dumps({"book": filename, "status": "error", "error": str(error), "fallback_error": str(fallback_error)}), flush=True)
    db.close()

if __name__ == "__main__":
    main()
