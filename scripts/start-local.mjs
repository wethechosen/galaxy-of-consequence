import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile, access } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const port = 3100;
const runtime = join(root, "data", "runtime");
const recordFile = join(runtime, "build.json");
const cli = join(root, "node_modules", "next", "dist", "bin", "next");

async function fingerprint() {
  const hash = createHash("sha256");
  async function visit(relative) {
    const entries = await readdir(join(root, relative), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const name = join(relative, entry.name);
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile()) { hash.update(name); hash.update(await readFile(join(root, name))); }
    }
  }
  await visit("app"); await visit("lib");
  await visit("original");
  for (const file of ["package.json", "package-lock.json", "next.config.ts"]) hash.update(await readFile(join(root, file)));
  return hash.digest("hex");
}

function run(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: root, env, stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Next.js exited with code ${code}`)));
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill());
  });
}

try {
  await access(cli);
  // Never kill or replace an unknown service already using the port.
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () => reject(new Error("Port 3100 is already in use. Try http://127.0.0.1:3100/; do not start a second copy.")));
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
  await mkdir(runtime, { recursive: true });
  const current = await fingerprint();
  let cached = await readFile(recordFile, "utf8").then(JSON.parse).catch(() => null);
  const reusable = cached?.fingerprint === current && /^\.next-run-\d+$/.test(cached?.directory ?? "") &&
    await access(join(root, cached.directory, "BUILD_ID")).then(() => true, () => false);
  if (!reusable || process.argv.includes("--rebuild")) {
    cached = { fingerprint: current, directory: `.next-run-${Date.now()}` };
    console.log("Building Galaxy of Consequence in a fresh local cache. No saves will be removed.");
    await run(["build"], { ...process.env, GOC_BUILD_DIR: cached.directory });
    await writeFile(recordFile, JSON.stringify(cached, null, 2));
  }
  console.log("Galaxy of Consequence: http://127.0.0.1:3100/");
  console.log("Keep this process running while playing. The datapad uses the server-configured NVIDIA test engine; the legacy archive remains read-only.");
  await run(["start", "--hostname", "127.0.0.1", "--port", String(port)], { ...process.env, GOC_BUILD_DIR: cached.directory });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
