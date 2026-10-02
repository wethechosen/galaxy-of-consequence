export type HostedUser = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: SupabaseAuthUser;
};

function authConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Hosted Supabase authentication is not configured.");
  }
  return { url, key };
}

async function authRequest(path: string, init: RequestInit = {}) {
  const { url, key } = authConfig();
  const response = await fetch(`${url}/auth/v1${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || `Supabase Auth failed (${response.status})` };
  }
  return { response, data };
}

export function publicUser(user: SupabaseAuthUser | null | undefined): HostedUser | null {
  if (!user?.id) return null;
  const username = String(user.email || user.id);
  const appRole = user.app_metadata?.role;
  const role: HostedUser["role"] =
    appRole === "admin" || username.toLowerCase() === "gm@galaxy.local" ? "admin" : "user";
  const displayName = String(
    user.user_metadata?.display_name ||
      user.user_metadata?.displayName ||
      (username.includes("@") ? username.split("@")[0] : username),
  );
  return { id: user.id, username, displayName, role };
}

export async function passwordLogin(username: string, password: string) {
  const { response, data } = await authRequest("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: username.trim().toLowerCase(), password }),
  });
  if (!response.ok) {
    throw Object.assign(new Error(data?.error_description || data?.msg || data?.error || "Invalid login."), {
      status: response.status,
    });
  }
  return data as SupabaseSession;
}

export async function refreshSession(refreshToken: string) {
  const { response, data } = await authRequest("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  return data as SupabaseSession;
}

export async function getAuthUser(accessToken: string) {
  const { response, data } = await authRequest("/user", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  return data as SupabaseAuthUser;
}

export async function registerUser(username: string, password: string, displayName: string) {
  const { response, data } = await authRequest("/signup", {
    method: "POST",
    body: JSON.stringify({
      email: username.trim().toLowerCase(),
      password,
      data: { display_name: displayName },
    }),
  });
  if (!response.ok) {
    throw Object.assign(new Error(data?.msg || data?.error_description || data?.error || "Registration failed."), {
      status: response.status,
    });
  }
  const session = (data?.session || data) as Partial<SupabaseSession>;
  if (!session.access_token || !session.refresh_token) {
    throw Object.assign(new Error("Account created, but email confirmation is required before login."), { status: 409 });
  }
  return session as SupabaseSession;
}

export async function signOut(accessToken?: string) {
  if (!accessToken) return;
  await authRequest("/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => null);
}
