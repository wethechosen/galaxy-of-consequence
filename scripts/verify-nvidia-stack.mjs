import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listSourceDocuments, searchSources } from "../lib/source-library.mjs";

function loadLocalEnvironment() {
  const path = resolve(".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadLocalEnvironment();

const model = process.env.NVIDIA_MODEL || "nvidia/nemotron-3-super-120b-a12b";
const key = process.env.NVIDIA_API_KEY;
const report = {
  deployment: "hosted-nemotron+local-sourcebook-rag",
  provider: { name: "nvidia", model, configured: Boolean(key), reachable: false },
  rag: { engine: "sqlite-fts5", documents: 0, indexedPages: 0, retrievalReady: false },
};

try {
  const documents = listSourceDocuments();
  report.rag.documents = documents.length;
  report.rag.indexedPages = documents.reduce((sum, item) => sum + Number(item.indexedPages || 0), 0);
  report.rag.retrievalReady = report.rag.indexedPages > 0;
  if (report.rag.retrievalReady) searchSources("Coruscant prison Black Sun", 1);
} catch (error) {
  report.rag.error = error instanceof Error ? error.message : "Source index unavailable";
}

if (!key) {
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} else {
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly READY." }],
        max_tokens: 16,
        temperature: 0,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    report.provider.reachable = response.ok;
    report.provider.httpStatus = response.status;
    if (!response.ok) report.provider.error = response.status === 401 || response.status === 403
      ? "Credential rejected" : response.status === 404 || response.status === 410
        ? "Model unavailable or retired" : `Provider returned HTTP ${response.status}`;
  } catch (error) {
    report.provider.error = error instanceof Error ? error.message : "Provider unavailable";
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.provider.reachable || !report.rag.retrievalReady) process.exitCode = 1;
}
