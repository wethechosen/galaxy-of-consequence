import { requireAccount, listAccounts } from "@/lib/accounts";
import { assertLocalRequest } from "@/lib/local-http";
import { readDatapad } from "@/lib/datapad-save";
import { hostedPersistenceEnabled } from "@/lib/hosted-bridge";
import { neonQuery } from "@/lib/neon-db";
import { setTimeout as delay } from "node:timers/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    const actor = requireAccount(request);
    const url = new URL(request.url);
    const requested = url.searchParams.get("accountId") || actor.id;
    if (requested !== actor.id && actor.role !== "admin") return Response.json({ error: "You can only open your own campaign." }, { status: 403 });
    const target = requested === actor.id ? actor : listAccounts().find(account => account.id === requested);
    if (!target) return Response.json({ error: "Account not found." }, { status: 404 });
    const cancellation = new AbortController();
    request.signal.addEventListener("abort", () => cancellation.abort(), { once: true });
    const encoder = new TextEncoder();
    let revision = Number(request.headers.get("last-event-id") || url.searchParams.get("since") || 0);
    if (!Number.isSafeInteger(revision) || revision < 0) revision = 0;
    const stream = new ReadableStream({
      async start(controller) {
        const deadline = Date.now() + 45_000;
        try {
          controller.enqueue(encoder.encode("retry: 3000\n\n"));
          while (!cancellation.signal.aborted && Date.now() < deadline) {
            const current = hostedPersistenceEnabled()
              ? Number((await neonQuery<{ revision: string }>("SELECT revision FROM private.goc_datapad_saves WHERE account_id=$1", [target.id]))[0]?.revision || 0)
              : Number(readDatapad(actor, target.id).revision);
            if (current > revision) {
              revision = current;
              controller.enqueue(encoder.encode(`id: ${revision}\nevent: revision\ndata: ${JSON.stringify({ revision })}\n\n`));
            } else controller.enqueue(encoder.encode(": heartbeat\n\n"));
            await delay(3000, undefined, { signal: cancellation.signal });
          }
        } catch { /* Closing reconnects the browser; polling remains available. */ }
        finally { if (!cancellation.signal.aborted) controller.close(); }
      },
      cancel() { cancellation.abort(); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "private, no-store, no-transform", "X-Accel-Buffering": "no" } });
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 403 });
  }
}
