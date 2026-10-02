import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

// Local-only, explicit allowlist. No network, resizing, or source-file changes.
const root = fileURLToPath(new URL("../", import.meta.url));
const catalog = JSON.parse(await readFile(join(root, "lib/map-catalog.json"), "utf8"));
if (!process.argv[2]) throw new Error('Usage: node scripts/import_maps.mjs "path/to/Galactic Maps"');
const source = resolve(process.argv[2]);
const target = join(root, "data/maps");
await mkdir(target, { recursive: true });
const manifest = [];
for (const map of catalog) {
  const bytes = await readFile(join(source, map.file));
  const png = map.file.endsWith(".png");
  if (png ? !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] !== 255 || bytes[1] !== 216) throw new Error(`Invalid image: ${map.file}`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const destination = join(target, map.file);
  try {
    await writeFile(destination, bytes, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const existing = createHash("sha256").update(await readFile(destination)).digest("hex");
    if (existing !== sha256) throw new Error(`Existing import differs: ${map.file}. Preserved both originals; review before replacing.`);
  }
  manifest.push({ id: map.id, file: map.file, sha256, bytes: bytes.length });
  console.log(`Imported/verified: ${map.file}`);
}
await writeFile(join(target, "manifest.json"), JSON.stringify({ importedAt: new Date().toISOString(), maps: manifest }, null, 2));
console.log(`${manifest.length} original maps ready. Private data/maps is excluded from Git.`);
