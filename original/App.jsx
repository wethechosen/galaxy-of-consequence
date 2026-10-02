import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { GameProvider } from "@/original/lib/GameContext";
import { AuthProvider, useAuth } from "@/original/lib/AuthContext";
import PageNotFound from "@/original/lib/PageNotFound";
import ScrollToTop from "@/original/components/ScrollToTop";
import CharacterPage from "@/original/pages/CharacterPage";
import PlayerPage from "@/original/pages/PlayerPage";
import HudPage from "@/original/pages/HudPage";
import PlayersPage from "@/original/pages/PlayersPage";
import CommsPage from "@/original/pages/CommsPage";
import GmConsolePage from "@/original/pages/GmConsolePage";
import Login from "@/original/pages/Login";
import Register from "@/original/pages/Register";
import Home from "@/original/pages/Home";
import ExchangesPage from "@/original/pages/ExchangesPage";
import ProfilePage from "@/original/pages/ProfilePage";
import SyndicatesPage from "@/original/pages/SyndicatesPage";
import ArchiveMapsPage from "@/original/pages/ArchiveMapsPage";

function AuthenticatedApp() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return <div className="original-game fixed inset-0 flex items-center justify-center px-6" style={{ background: "radial-gradient(circle at 25% 10%, rgba(255,122,26,.12), transparent 36%), #07060b", color: "#e7e5df" }}><div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[.025] px-7 py-8 text-center"><p className="mb-3 text-[10px] tracking-[0.28em] text-[#ff9b50]">SECURE DATAPAD LINK</p><p className="gc-display text-lg font-bold tracking-wide">VERIFYING YOUR IDENTITY</p><div className="mx-auto mt-5 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/[.07]"><div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-[#ff7a1a] to-[#ed5266]" /></div><p className="mt-4 text-xs text-[#8b93a3]">Reestablishing your encrypted campaign record…</p></div></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (user?.role !== "admin" && location.pathname === "/gm") {
    return <Navigate to="/character" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/character" element={<CharacterPage />} />
      <Route path="/player" element={<PlayerPage />} />
      <Route path="/hud" element={<HudPage />} />
      <Route path="/players" element={<PlayersPage />} />
      <Route path="/comms" element={<CommsPage />} />
      <Route path="/exchanges" element={<ExchangesPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/syndicates" element={<SyndicatesPage />} />
      <Route path="/archive" element={<ArchiveMapsPage />} />
      <Route path="/gm" element={user?.role === "admin" ? <GmConsolePage /> : <Navigate to="/" replace />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
      </GameProvider>
    </AuthProvider>
  );
}
