import { useState } from "react";
import { useGame, MODEL_OPTIONS } from "@/original/lib/GameContext";

export default function RequireApiKey({ children }) {
  const { apiKey, saveApiKey, model, saveModel } = useGame();
  const [val, setVal] = useState("");

  if (apiKey) return children;

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="gc-glass rounded-2xl p-8 max-w-md w-full">
        <p className="gc-display font-bold text-lg mb-1" style={{ color: "var(--sig)" }}>GALAXY OF CONSEQUENCE</p>
        <p className="text-[#a9adb8] text-sm mb-5">
          Enter your own Anthropic API key to connect the Game Master — it's stored only in this browser's local storage and sent directly to Anthropic's API from your device.
        </p>
        <label className="block text-sm mb-3">
          <span className="block text-[10px] tracking-widest text-[#8b93a3] mb-1">ANTHROPIC API KEY</span>
          <input
            type="password"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="sk-ant-..."
            className="gc-input w-full px-3 py-2.5 text-sm text-[#f2f0ea]"
          />
        </label>
        <label className="block text-sm mb-5">
          <span className="block text-[10px] tracking-widest text-[#8b93a3] mb-1">MODEL</span>
          <select value={model} onChange={(e) => saveModel(e.target.value)} className="gc-input w-full px-3 py-2.5 text-sm text-[#f2f0ea]">
            {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <button onClick={() => val.trim() && saveApiKey(val.trim())} className="gc-btn w-full py-2.5 text-sm">CONNECT</button>
        <p className="text-[11px] text-[#5c6370] mt-4 leading-relaxed">
          Security note: this stores your key in plain local storage and calls the API directly from the browser. Fine for personal/single-user use; don't put this in front of public traffic without a backend proxy in front of your key.
        </p>
      </div>
    </div>
  );
}
