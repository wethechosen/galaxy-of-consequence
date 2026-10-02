import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/access-control";
import { assertLocalRequest } from "@/lib/local-http";
import { sourceFile } from "@/lib/source-library.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    requirePermission(request, "sources:read");
    const { id } = await context.params;
    if (!/^[a-f0-9]{64}$/.test(id)) return NextResponse.json({ error: "Unknown source." }, { status: 404 });
    const file = sourceFile(id);
    if (!file) return NextResponse.json({ error: "Unknown source." }, { status: 404 });
    const size = statSync(file.sourcePath).size;
    const stream = Readable.toWeb(createReadStream(file.sourcePath));
    return new Response(stream as ReadableStream, { headers: {
      "Content-Type": file.filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/plain; charset=utf-8",
      "Content-Disposition": `inline; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "Content-Length": String(size), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return NextResponse.json({ error: "Source unavailable." }, { status: 403 }); }
}
