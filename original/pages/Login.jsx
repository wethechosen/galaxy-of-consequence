import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Lock, LogIn, Mail } from "lucide-react";
import { defaultRouteForUser, login, safeReturnTo } from "@/original/lib/localAuth";
import { Shell } from "@/original/components/GalaxyUI";
import GoogleIcon from "@/original/components/GoogleIcon";

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = safeReturnTo(new URLSearchParams(location.search).get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(new URLSearchParams(location.search).get("error") || "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const authenticatedUser = await login(email, password);
      const roleHome = defaultRouteForUser(authenticatedUser);
      navigate(returnTo === "/" || returnTo === "/player" ? roleHome : returnTo, { replace: true });
    } catch (err) {
      setError(err.message || "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
  }

  return (
    <Shell>
      <main className="gc-page-scroll flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-6">
        <div className="gc-glass rounded-2xl p-8 w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <LogIn size={22} style={{ color: "var(--sig)" }} />
            <div>
              <p className="gc-display text-sm font-bold tracking-wide text-[#f2f0ea]">GALAXY OF CONSEQUENCE</p>
              <p className="text-xs text-[#8b93a3]">Open your secured datapad record</p>
            </div>
          </div>

          {error && <div className="mb-4 p-3 rounded-lg bg-[#e23b3b]/10 text-[#ff8a8a] text-sm">{error}</div>}

          <div className="mb-5 rounded-xl border border-white/10 bg-white/[.03] p-3">
            <p className="mb-2 text-[10px] tracking-widest text-[#8b93a3]">LOCAL CAMPAIGN PROFILE</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setEmail("dmir@galaxy.local"); setError(""); }} className="rounded-lg border border-[#22e5c5]/25 px-3 py-2 text-left hover:bg-[#22e5c5]/10">
                <span className="block text-xs text-[#f2f0ea]">D’MIR</span>
                <span className="block text-[9px] tracking-wider text-[#22e5c5]">PLAYER</span>
              </button>
              <button type="button" onClick={() => { setEmail("gm@galaxy.local"); setError(""); }} className="rounded-lg border border-[#ff7a1a]/25 px-3 py-2 text-left hover:bg-[#ff7a1a]/10">
                <span className="block text-xs text-[#f2f0ea]">GM OPERATOR</span>
                <span className="block text-[9px] tracking-wider text-[#ff9b50]">ADMIN</span>
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[#5c6370]">Choose the profile, then enter its access code. The player and GM records remain separate.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-[10px] tracking-widest text-[#8b93a3] mb-2">EMAIL OR USERNAME</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b93a3]" aria-hidden="true" />
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  autoFocus
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="gc-input w-full pl-10 pr-3 py-3 text-sm text-[#f2f0ea]"
                  placeholder="you@example.com"
                />
              </div>
            </label>
            <label className="block">
              <span className="block text-[10px] tracking-widest text-[#8b93a3] mb-2">PASSWORD</span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b93a3]" aria-hidden="true" />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  minLength={12}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="gc-input w-full pl-10 pr-3 py-3 text-sm text-[#f2f0ea]"
                  placeholder="At least 12 characters"
                />
              </div>
            </label>
            <button type="submit" className="gc-btn w-full py-3 text-sm" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> LOGGING IN...</> : "LOG IN"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
            <div className="relative flex justify-center"><span className="bg-[#0d0b12] px-3 text-[10px] tracking-widest text-[#5c6370]">OR</span></div>
          </div>
          <button type="button" onClick={handleGoogle} className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm text-[#f2f0ea] hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,.14)" }}>
            <GoogleIcon className="w-5 h-5" /> CONTINUE WITH GOOGLE
          </button>

          <p className="text-xs text-[#8b93a3] mt-6 text-center">
            No account yet?{" "}
            <Link
              to={`/register?returnTo=${encodeURIComponent(returnTo)}`}
              className="text-[#ff9b50] hover:underline"
            >
              Create one
            </Link>
          </p>
          <p className="text-[11px] text-[#5c6370] mt-4 leading-relaxed">
            Sign in with your email or existing username. Accounts are saved on this local server.
          </p>
        </div>
      </main>
    </Shell>
  );
}
