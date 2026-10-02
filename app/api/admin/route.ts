import { NextResponse } from "next/server";
import { createAccount, listAccounts, reviewRequest } from "@/lib/accounts";
import { assertLocalRequest, boundedText, readObject } from "@/lib/local-http";
import { gameplayReadiness } from "@/lib/game-readiness";
import { PERMISSIONS, permissionsFor, requirePermission, setPermission, type Permission } from "@/lib/access-control";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { assertLocalRequest(request); const actor = requirePermission(request, "accounts:manage"); return NextResponse.json({ accounts: listAccounts().map(account => ({ ...account, permissions: permissionsFor(account) })), permissions: PERMISSIONS, readiness: gameplayReadiness(), actor: { id: actor.id, permissions: permissionsFor(actor) } }); }
  catch { return NextResponse.json({ error: "Administrator access required." }, { status: 403 }); }
}
export async function POST(request: Request) {
  try {
    assertLocalRequest(request); const user = requirePermission(request, "accounts:manage"); const body = await readObject(request);
    if (body.action === "create_player") {
      if (typeof body.password !== "string") throw new Error("Password required.");
      return NextResponse.json({ account: createAccount(boundedText(body.username, 80), body.password, boundedText(body.displayName, 80), "player") });
    }
    if (body.action === "set_permission") {
      const accountId = boundedText(body.accountId, 80);
      const permission = boundedText(body.permission, 80) as Permission;
      setPermission(user, accountId, permission, body.granted !== false);
      return NextResponse.json({ ok: true, accountId, permission, granted: body.granted !== false });
    }
    if (body.action !== "review") throw new Error("Invalid admin action.");
    reviewRequest(user, boundedText(body.id, 80), boundedText(body.response, 4000), boundedText(body.status, 20));
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Admin action failed." }, { status: 403 }); }
}
