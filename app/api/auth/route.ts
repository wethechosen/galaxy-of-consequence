import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAuthUser,
  passwordLogin,
  publicUser,
  refreshSession,
  registerUser,
  signOut,
} from "../../../lib/supabase-auth";

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
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

function setSessionCookies(response: NextResponse, session: { access_token: string; refresh_token: string; expires_in?: number }) {
  response.cookies.set(ACCESS_COOKIE, session.access_token, cookieOptions(session.expires_in || 3600));
  response.cookies.set(REFRESH_COOKIE, session.refresh_token, cookieOptions(60 * 60 * 24 * 30));
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
  response.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
}

async function currentSession() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value || "";
  const refreshToken = store.get(REFRESH_COOKIE)?.value || "";

  if (accessToken) {
    const user = await getAuthUser(accessToken);
    if (user) return { user, accessToken, refreshed: null as null | Awaited<ReturnType<typeof refreshSession>> };
  }

  if (refreshToken) {
    const refreshed = await refreshSession(refreshToken);
    if (refreshed?.access_token) {
      const user = refreshed.user || (await getAuthUser(refreshed.access_token));
      if (user) return { user, accessToken: refreshed.access_token, refreshed };
    }
  }

  return null;
}

export async function GET() {
  try {
    const session = await currentSession();
    if (!session) return NextResponse.json({ user: null }, { status: 200 });

    const response = NextResponse.json({ user: publicUser(session.user) }, { status: 200 });
    if (session.refreshed?.access_token && session.refreshed.refresh_token) {
      setSessionCookies(response, session.refreshed);
    }
    return response;
  } catch (error) {
    console.error("[api/auth] session check failed", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body?.action || "");

    if (action === "login") {
      const username = String(body?.username || "").trim();
      const password = String(body?.password || "");
      if (!username || !password) {
        return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
      }

      const session = await passwordLogin(username, password);
      const user = session.user || (await getAuthUser(session.access_token));
      if (!user) return NextResponse.json({ error: "Unable to verify the signed-in account." }, { status: 401 });

      const response = NextResponse.json({ user: publicUser(user) }, { status: 200 });
      setSessionCookies(response, session);
      return response;
    }

    if (action === "register") {
      const username = String(body?.username || "").trim();
      const password = String(body?.password || "");
      const displayName = String(body?.displayName || username.split("@")[0] || "Player").trim();
      if (!username || password.length < 12) {
        return NextResponse.json({ error: "Use a valid email and a password of at least 12 characters." }, { status: 400 });
      }

      const session = await registerUser(username, password, displayName);
      const user = session.user || (await getAuthUser(session.access_token));
      if (!user) return NextResponse.json({ error: "Account created but the session could not be verified." }, { status: 409 });

      const response = NextResponse.json({ user: publicUser(user) }, { status: 200 });
      setSessionCookies(response, session);
      return response;
    }

    if (action === "logout") {
      const store = await cookies();
      const accessToken = store.get(ACCESS_COOKIE)?.value;
      await signOut(accessToken);
      const response = NextResponse.json({ user: null }, { status: 200 });
      clearSessionCookies(response);
      return response;
    }

    return NextResponse.json({ error: "Unsupported auth action." }, { status: 400 });
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? Number((error as { status: number }).status) : 500;
    const message = error instanceof Error ? error.message : "Authentication failed.";
    console.error("[api/auth] request failed", { status, message });
    return NextResponse.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
