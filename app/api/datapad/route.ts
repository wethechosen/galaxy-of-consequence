import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { bridgeGet, bridgeSave, bridgeSaveConfig } from "../../../lib/datapad-bridge";
import { getAuthUser, publicUser, refreshSession } from "../../../lib/supabase-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCESS_COOKIE = "goc_access_token";
const REFRESH_COOKIE = "goc_refresh_token";

function cookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  };
}

async function authorizeAccount(accountId: string) {
  const store = await cookies();
  let accessToken = store.get(ACCESS_COOKIE)?.value || "";
  const refreshToken = store.get(REFRESH_COOKIE)?.value || "";
  let refreshed: Awaited<ReturnType<typeof refreshSession>> | null = null;
  let user = accessToken ? await getAuthUser(accessToken) : null;

  if (!user && refreshToken) {
    refreshed = await refreshSession(refreshToken);
    if (refreshed?.access_token) {
      accessToken = refreshed.access_token;
      user = refreshed.user || (await getAuthUser(accessToken));
    }
  }

  if (!user) return { authorized: false as const, status: 401, refreshed: null };
  const visibleUser = publicUser(user);
  const isAdmin = visibleUser?.role === "admin";
  if (!isAdmin && user.id !== accountId) {
    return { authorized: false as const, status: 403, refreshed };
  }
  return { authorized: true as const, user, visibleUser, refreshed };
}

function applyRefreshCookies(response: NextResponse, refreshed: Awaited<ReturnType<typeof refreshSession>> | null) {
  if (!refreshed?.access_token || !refreshed.refresh_token) return;
  response.cookies.set(ACCESS_COOKIE, refreshed.access_token, cookieOptions(refreshed.expires_in || 3600));
  response.cookies.set(REFRESH_COOKIE, refreshed.refresh_token, cookieOptions(60 * 60 * 24 * 30));
}

function errorResponse(error: unknown) {
  const statusRaw = (error as { status?: unknown })?.status;
  const status = typeof statusRaw === "number" && statusRaw >= 400 && statusRaw < 600 ? statusRaw : 500;
  const currentRevision = (error as { currentRevision?: unknown })?.currentRevision;
  const message = error instanceof Error ? error.message : "Datapad request failed.";
  return NextResponse.json(
    { error: message, ...(typeof currentRevision === "number" ? { revision: currentRevision } : {}) },
    { status },
  );
}

export async function GET(request: Request) {
  const accountId = new URL(request.url).searchParams.get("accountId")?.trim() || "";
  if (!accountId) return NextResponse.json({ error: "accountId is required." }, { status: 400 });

  const auth = await authorizeAccount(accountId);
  if (!auth.authorized) return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Forbidden" }, { status: auth.status });

  try {
    const result = await bridgeGet(accountId, true);
    const save = result?.save ?? result ?? null;
    const configRow = result?.config ?? null;
    const response = NextResponse.json(
      {
        accountId,
        revision: Number(save?.revision || 0),
        snapshot: save?.snapshot ?? null,
        configRevision: Number(configRow?.revision || 0),
        config: configRow?.config ?? null,
        updatedAt: save?.updated_at ?? null,
      },
      { status: 200 },
    );
    applyRefreshCookies(response, auth.refreshed);
    return response;
  } catch (error) {
    console.error("[api/datapad] load failed", error);
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const queryAccountId = new URL(request.url).searchParams.get("accountId")?.trim() || "";
  const accountId = String(body?.accountId || queryAccountId).trim();
  if (!accountId) return NextResponse.json({ error: "accountId is required." }, { status: 400 });

  const auth = await authorizeAccount(accountId);
  if (!auth.authorized) return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Forbidden" }, { status: auth.status });

  try {
    if (body?.action === "config") {
      const revision = Number(body?.revision);
      if (!Number.isInteger(revision) || revision < 0 || !body?.config || typeof body.config !== "object") {
        return NextResponse.json({ error: "revision and config are required." }, { status: 400 });
      }
      if (auth.visibleUser?.role !== "admin") {
        return NextResponse.json({ error: "Admin access is required to change GM configuration." }, { status: 403 });
      }
      const saved = await bridgeSaveConfig(accountId, revision, body.config);
      const response = NextResponse.json(
        { accountId, configRevision: Number(saved?.revision || revision + 1), config: saved?.config ?? body.config },
        { status: 200 },
      );
      applyRefreshCookies(response, auth.refreshed);
      return response;
    }

    const revision = Number(body?.revision);
    if (!Number.isInteger(revision) || revision < 0 || !body?.snapshot || typeof body.snapshot !== "object") {
      return NextResponse.json({ error: "revision and snapshot are required." }, { status: 400 });
    }

    const saved = await bridgeSave(accountId, revision, body.snapshot);
    const response = NextResponse.json(
      {
        accountId,
        revision: Number(saved?.revision || revision + 1),
        snapshot: saved?.snapshot ?? body.snapshot,
        updatedAt: saved?.updated_at ?? null,
      },
      { status: 200 },
    );
    applyRefreshCookies(response, auth.refreshed);
    return response;
  } catch (error) {
    console.error("[api/datapad] save failed", error);
    return errorResponse(error);
  }
}
