import { Link } from "react-router-dom";

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-[#a9adb8]" style={{ background: "#07060b" }}>
      <div className="text-center">
        <p className="gc-display text-xs tracking-[0.25em] mb-3" style={{ color: "var(--sig)" }}>SIGNAL LOST</p>
        <p className="text-sm tracking-widest mb-5">404 — that page isn't in this galaxy.</p>
        <Link to="/" className="gc-btn px-4 py-2 text-xs">RETURN HOME</Link>
      </div>
    </div>
  );
}
