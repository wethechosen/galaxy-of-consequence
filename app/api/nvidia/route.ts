import { originalProvider, testAiStatus } from "@/lib/original-provider";
import { assertAuthenticatedRequest } from "@/lib/local-http";
export async function GET(request: Request) {
  try { assertAuthenticatedRequest(request); return Response.json(testAiStatus()); }
  catch { return Response.json({ error: "Sign in required." }, { status: 403 }); }
}
export const runtime = "nodejs";
export const POST = (request: Request) => originalProvider(request, "nvidia");
