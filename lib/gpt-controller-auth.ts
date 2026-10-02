import { NextResponse } from "next/server";

const DEFAULT_DMIR_ACCOUNT_ID = "bc822f06-3f84-48dd-9468-3151cf3485f9";

export function controllerAccountId() {
  return process.env.GOC_GPT_ACCOUNT_ID?.trim() || DEFAULT_DMIR_ACCOUNT_ID;
}

export function requireGptController(request: Request) {
  const configured = process.env.GOC_GPT_ACTION_KEY?.trim();
  if (!configured) {
    return NextResponse.json(
      { error: "GPT controller authentication is not configured." },
      { status: 503 },
    );
  }

  const supplied = request.headers.get("authorization") || "";
  if (supplied !== `Bearer ${configured}`) {
    return NextResponse.json({ error: "Unauthorized controller request." }, { status: 401 });
  }
  return null;
}

export function controllerError(error: unknown, fallback = "Controller request failed.") {
  const rawStatus = (error as { status?: unknown })?.status;
  const status = typeof rawStatus === "number" && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  const currentRevision = (error as { currentRevision?: unknown })?.currentRevision;
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json(
    {
      error: message,
      ...(typeof currentRevision === "number" ? { revision: currentRevision } : {}),
    },
    { status },
  );
}
