import { originalProvider } from "@/lib/original-provider";
export const runtime = "nodejs";
export const POST = (request: Request) => originalProvider(request, "local");
