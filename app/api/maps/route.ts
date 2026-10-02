import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MAPS, findMap } from "../../../lib/maps";
import { assertAuthenticatedRequest as assertLocalRequest } from "../../../lib/local-http";
import { requirePermission } from "../../../lib/access-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const directory = () => join(process.cwd(), "data", "maps");

export async function GET(request: Request) {
  try { assertLocalRequest(request); }
  catch { return Response.json({ error: "Local access only" }, { status: 403 }); }
  const id = new URL(request.url).searchParams.get("id");
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
  if (id === null) {
    const maps = await Promise.all(MAPS.map(async map => ({ ...map, available: await access(join(directory(), map.file)).then(() => true, () => false) })));
    return Response.json({ maps }, { headers });
  }
  const map = findMap(id);
  if (!map) return Response.json({ error: "Unknown map" }, { status: 404, headers });
  try {
    const bytes = await readFile(join(directory(), map.file));
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": map.file.endsWith(".png") ? "image/png" : "image/jpeg" } });
  } catch { return Response.json({ error: "Map not imported. Run the local map importer." }, { status: 404, headers }); }
}

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try { assertLocalRequest(request); requirePermission(request, "maps:manage"); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Administrator access required" }, { status: 403, headers }); }
  try {
    const form = await request.formData();
    const map = findMap(String(form.get("id") || ""));
    const file = form.get("file");
    if (!map || !(file instanceof File)) return Response.json({ error: "Choose a known chart and image file." }, { status: 400, headers });
    if (file.size < 32 || file.size > 30 * 1024 * 1024) return Response.json({ error: "Chart must be between 32 bytes and 30 MB." }, { status: 400, headers });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if ((map.file.endsWith(".png") && !png) || (map.file.endsWith(".jpg") && !jpeg)) return Response.json({ error: `This catalog entry requires a ${map.file.endsWith(".png") ? "PNG" : "JPEG"} image.` }, { status: 400, headers });
    await mkdir(directory(), { recursive: true });
    await writeFile(join(directory(), map.file), bytes, { flag: "w" });
    return Response.json({ map: { ...map, available: true } }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Chart import failed." }, { status: 400, headers });
  }
}
