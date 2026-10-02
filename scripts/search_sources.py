import argparse
import sqlite3
parser = argparse.ArgumentParser()
parser.add_argument("query")
parser.add_argument("--book")
args = parser.parse_args()
db = sqlite3.connect("data/sources.sqlite")
for source, page, text in db.execute("SELECT source_id,pdf_page,text FROM source_pages WHERE lower(text) LIKE ? AND (? IS NULL OR source_id=?) LIMIT 8", ("%" + args.query.lower() + "%", args.book, args.book)):
    print(f"\nSOURCE: {source}, PDF PAGE: {page}\n{text}")
