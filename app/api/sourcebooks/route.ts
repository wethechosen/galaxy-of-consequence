import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/access-control";
import { assertLocalRequest } from "@/lib/local-http";
import { indexSourceFile, listSourceDocuments, reviewSourcePage, searchSources, sourcePage } from "@/lib/source-library.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request) { assertLocalRequest(request); requirePermission(request, "sources:manage"); }
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Sourcebook request failed." }, { status: 403 });
}

export async function GET(request: Request) {
  try {
    authorize(request);
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    const page = Number(params.get("page"));
    if (id && Number.isSafeInteger(page) && page > 0) {
      const passage = sourcePage(id, page);
      return passage ? NextResponse.json({ passage }) : NextResponse.json({ error: "Page not indexed yet." }, { status: 404 });
    }
    const query = params.get("q")?.trim();
    return NextResponse.json({ documents: listSourceDocuments(), hits: query ? searchSources(query, 12) : [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    authorize(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose a PDF, TXT, or Markdown file.");
    const extension = extname(file.name).toLowerCase();
    if (![".pdf", ".txt", ".md"].includes(extension) || file.size > 180_000_000) throw new Error("Choose a PDF, TXT, or Markdown file under 180 MB.");
    const authority = String(form.get("authority") || "setting");
    if (!["saga_core", "saga_errata", "saga_supplement", "setting"].includes(authority)) throw new Error("Invalid source authority.");
    const title = String(form.get("title") || basename(file.name, extension)).trim().slice(0, 160);
    if (!title) throw new Error("Give the source a title.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const id = createHash("sha256").update(bytes).digest("hex");
    const dir = resolve("data", "private-sources");
    mkdirSync(dir, { recursive: true });
    const path = resolve(dir, `${id}${extension}`);
    if (!existsSync(path)) writeFileSync(path, bytes, { flag: "wx" });
    const result = await indexSourceFile(path, { title, authority, maxPages: 8 });
    if (result.indexedPages < result.pages) {
      void indexSourceFile(path, { title, authority }).catch((error) => console.error("Private source indexing failed:", error));
    }
    return NextResponse.json({ document: result, note: result.indexedPages < result.pages ? "The remaining pages are indexing in the background. Scanned pages use OCR and require review before rules use." : "Indexed." });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") return NextResponse.json({ error: "This file is already in the library." }, { status: 409 });
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    authorize(request);
    const body = await request.json();
    if (typeof body.id !== "string" || !Number.isSafeInteger(body.page) || typeof body.reviewed !== "boolean") throw new Error("Invalid page review.");
    if (!reviewSourcePage(body.id, body.page, body.reviewed)) return NextResponse.json({ error: "Page not found." }, { status: 404 });
    return NextResponse.json({ reviewed: body.reviewed });
  } catch (error) { return failure(error); }
}
