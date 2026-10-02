import { NextResponse } from "next/server";
import { resetPassword, SESSION_COOKIE, startSession } from "@/lib/accounts";
import { assertLocalRequest, readLocalObject } from "@/lib/local-http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertLocalRequest(request);
    const body = await readLocalObject(request);
    const account = resetPassword(typeof body.token === "string" ? body.token : "", typeof body.password === "string" ? body.password : "");
    const response = NextResponse.json({ user: account });
    response.cookies.set(SESSION_COOKIE, startSession(account), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 28800, secure: new URL(request.url).protocol === "https:" });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Password recovery failed." }, { status: 400 });
  }
}
