import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ensureDemoAccounts, getCurrentUser, getRegisteredUsers, logout, PRESENCE_KEY } from "@/original/lib/localAuth";

const AuthContext = createContext(null);
const AUTH_CHANGED = "galaxy-auth-changed";

export function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCurrentUser());
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);

  function refreshPresence() {
    const now = Date.now();
    let presence = {};
    try { presence = JSON.parse(localStorage.getItem(PRESENCE_KEY) || "{}"); } catch { presence = {}; }
    const active = Object.fromEntries(Object.entries(presence).filter(([, timestamp]) => now - timestamp < 45000));
    setOnlineUsers(Object.keys(active));
    return active;
  }

  useEffect(() => {
    const syncUser = () => setUser(getCurrentUser());
    let active = true;
    ensureDemoAccounts().then(() => {
      if (!active) return;
      syncUser();
      setIsLoadingAuth(false);
    }).catch(() => {
      if (active) { setUser(null); setIsLoadingAuth(false); }
    });
    const current = getCurrentUser();
    if (current) {
      let presence = {};
      try { presence = JSON.parse(localStorage.getItem(PRESENCE_KEY) || "{}"); } catch { presence = {}; }
      presence[current.email] = Date.now();
      localStorage.setItem(PRESENCE_KEY, JSON.stringify(presence));
      refreshPresence();
    }
    const heartbeat = window.setInterval(() => {
      const current = getCurrentUser();
      if (current) {
        let presence = {};
        try { presence = JSON.parse(localStorage.getItem(PRESENCE_KEY) || "{}"); } catch { presence = {}; }
        presence[current.email] = Date.now();
        localStorage.setItem(PRESENCE_KEY, JSON.stringify(presence));
      }
      refreshPresence();
    }, 15000);
    // Keep an actively used local campaign signed in. The server extends both
    // the database session and its HttpOnly cookie; sleeping or closed tabs do
    // not renew and still expire normally.
    const sessionHeartbeat = window.setInterval(() => {
      ensureDemoAccounts().then(syncUser).catch(() => setUser(null));
    }, 15 * 60 * 1000);
    refreshPresence();
    window.addEventListener(AUTH_CHANGED, syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGED, syncUser);
      window.removeEventListener("storage", syncUser);
      window.clearInterval(heartbeat);
      window.clearInterval(sessionHeartbeat);
    };
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    isLoadingAuth,
    authError: null,
    navigateToLogin: () => {},
    logout: async () => {
      const current = getCurrentUser();
      if (current) {
        let presence = {};
        try { presence = JSON.parse(localStorage.getItem(PRESENCE_KEY) || "{}"); } catch { presence = {}; }
        delete presence[current.email];
        localStorage.setItem(PRESENCE_KEY, JSON.stringify(presence));
      }
      await logout();
      setUser(null);
    },
    onlineUsers,
    registeredUsers: getRegisteredUsers(),
    isPlayerOnline: onlineUsers.some((email) => email !== "admin@galaxy.local"),
  }), [isLoadingAuth, user, onlineUsers]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
