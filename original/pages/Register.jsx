import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail, UserPlus } from "lucide-react";
import { register, safeReturnTo } from "@/original/lib/localAuth";
import { Shell } from "@/original/components/GalaxyUI";
import GoogleIcon from "@/original/components/GoogleIcon";

export default function Register() {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = safeReturnTo(new URLSearchParams(location.search).get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.message || "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <main className="gc-page-scroll flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-6">
        <div className="gc-glass rounded-2xl p-8 w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <UserPlus size={22} style={{ color: "var(--sig)" }} />
            <div>
              <p className="gc-display text-sm font-bold tracking-wide text-[#f2f0ea]">NEW DATAPAD RECORD</p>
              <p className="text-xs text-[#8b93a3]">Create a local account</p>
            </div>
          </div>
          {error && <div className="mb-4 p-3 rounded-lg bg-[#e23b3b]/10 text-[#ff8a8a] text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-[10px] tracking-widest text-[#8b93a3] mb-2">EMAIL</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b93a3]" aria-hidden="true" />
                <input type="email" autoComplete="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} className="gc-input w-full pl-10 pr-3 py-3 text-sm text-[#f2f0ea]" placeholder="you@example.com" />
              </div>
            </label>
            <label className="block">
              <span className="block text-[10px] tracking-widest text-[#8b93a3] mb-2">PASSWORD</span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b93a3]" aria-hidden="true" />
                <input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} className="gc-input w-full pl-10 pr-3 py-3 text-sm text-[#f2f0ea]" placeholder="At least 12 characters" />
              </div>
            </label>
            <button type="submit" className="gc-btn w-full py-3 text-sm" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> CREATING...</> : "CREATE ACCOUNT"}
            </button>
          </form>
          <a href={`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`} className="gc-glass mt-5 w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm"><GoogleIcon className="w-5 h-5" /> CONTINUE WITH GOOGLE</a>
          <p className="text-xs text-[#8b93a3] mt-6 text-center">
            Already registered?{" "}
            <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="text-[#ff9b50] hover:underline">Log in</Link>
          </p>
        </div>
      </main>
    </Shell>
  );
}
