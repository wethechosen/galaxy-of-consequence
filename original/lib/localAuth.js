export const PRESENCE_KEY = "galaxy-consequence-presence";
let currentUser = null;
let registeredUsers = [];
export function safeReturnTo(value) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}
export function defaultRouteForUser() { return "/"; }
const adapt = (account) => account ? { ...account, email: account.username, role: account.role === "admin" ? "admin" : "user" } : null;
async function api(action, values = {}) {
  const response = await fetch("/api/auth", { method: action ? "POST" : "GET", headers: { "Content-Type": "application/json" }, ...(action ? { body: JSON.stringify({action, ...values}) } : {}), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to access your account.");
  currentUser = adapt(data.user);
  if (currentUser?.role === "admin") {
    const result = await fetch("/api/admin", { cache: "no-store" });
    if (result.ok) registeredUsers = (await result.json()).accounts.map(adapt);
  } else registeredUsers = currentUser ? [currentUser] : [];
  window.dispatchEvent(new Event("galaxy-auth-changed"));
  return currentUser;
}
// Retained import name for compatibility; no demo credentials are created.
export async function ensureDemoAccounts() { return api(); }
export async function register(email, password) { return api("register", { username: email, password, displayName: email.split("@")[0] }); }
export async function login(email, password) { return api("login", { username: email, password }); }
export function getCurrentUser() { return currentUser; }
export function getRegisteredUsers() { return registeredUsers; }
export async function logout() { await api("logout"); }
