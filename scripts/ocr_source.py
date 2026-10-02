"""Local Windows OCR into the private source index; never approves a page."""
import argparse
import concurrent.futures
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--database", type=Path, default=Path("data/sources.sqlite"))
    parser.add_argument("--workers", type=int, default=3)
    args = parser.parse_args()
    pdf = args.pdf.resolve()
    poppler = shutil.which("pdftoppm")
    if not poppler:
        raise SystemExit("pdftoppm is required")
    script = Path(__file__).with_name("ocr_image.ps1").resolve()
    db = sqlite3.connect(args.database, timeout=60)
    db.execute("CREATE TABLE IF NOT EXISTS ocr_completed(source_id TEXT, pdf_page INTEGER, PRIMARY KEY(source_id,pdf_page))")
    rows = db.execute("SELECT pdf_page FROM source_pages WHERE source_id=? AND length(trim(text))<80 AND pdf_page NOT IN (SELECT pdf_page FROM ocr_completed WHERE source_id=?)", (pdf.name, pdf.name)).fetchall()
    if not rows:
        print("No pending OCR pages")
        return
    scratch = Path("data/ocr").resolve()
    scratch.mkdir(parents=True, exist_ok=True)
    def process(row):
        page = row[0]
        with tempfile.TemporaryDirectory(prefix="page-", dir=scratch) as folder:
            prefix = Path(folder) / "render"
            subprocess.run([poppler, "-f", str(page), "-l", str(page), "-r", "160", "-singlefile", "-png", str(pdf), str(prefix)], check=True, capture_output=True, timeout=90)
            result = subprocess.run(["powershell.exe", "-NoProfile", "-File", str(script), "-ImagePath", str(prefix) + ".png"], check=True, capture_output=True, timeout=90)
            return page, result.stdout.decode("utf-8-sig", errors="replace")
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as pool:
        futures = {pool.submit(process, row): row[0] for row in rows}
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            try:
                page, text = future.result()
                with db:
                    db.execute("UPDATE source_pages SET text=?, approved=0 WHERE source_id=? AND pdf_page=?", (text, pdf.name, page))
                    db.execute("DELETE FROM source_search WHERE source_id=? AND pdf_page=?", (pdf.name, page))
                    db.execute("INSERT INTO source_search VALUES(?,?,?)", (pdf.name, page, text))
                    db.execute("INSERT INTO ocr_completed VALUES(?,?)", (pdf.name, page))
                if index % 20 == 0 or index == len(rows):
                    print(json.dumps({"completed": index, "total": len(rows)}), flush=True)
            except Exception as error:
                failures.append(futures[future])
                print(json.dumps({"page": futures[future], "error": str(error)}), flush=True)
    with db:
        db.execute("UPDATE sources SET status=? WHERE id=?", ("partial_ocr" if failures else "ocr_needs_page_review", pdf.name))
    print(json.dumps({"finished": pdf.name, "failed_pages": failures}), flush=True)
    db.close()

if __name__ == "__main__":
    main()
