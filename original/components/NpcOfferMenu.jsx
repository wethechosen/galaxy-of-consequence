import { useMemo, useState } from "react";
import { GlassCard } from "./GalaxyUI";

/** Read-only projection of GM-committed quotes. The server alone completes payment. */
export function NpcOfferMenu({ gameState = {}, character = {}, onChoose, onAccept, disabled = false }) {
  const offers = useMemo(() => (Array.isArray(gameState.tradeOffers) ? gameState.tradeOffers : [])
    .filter(offer => offer && offer.status === "open" && offer.location === gameState.location)
    .filter(offer => !Array.isArray(gameState.tradeReceipts) || !gameState.tradeReceipts.some(receipt => receipt.offerId === offer.id))
    .slice(-60), [gameState]);
  const [selectedId, setSelectedId] = useState("");
  if (!offers.length) return null;
  const selected = offers.find(offer => offer.id === selectedId) || offers[offers.length - 1];
  const service = selected.service || null;
  const flags = Array.isArray(gameState.flags) ? gameState.flags : [];
  const hasFlag = !service?.requiredFlag || flags.some(flag =>
    String(typeof flag === "object" ? flag?.name || flag?.id || flag?.flag : flag).toLowerCase() === service.requiredFlag.toLowerCase());
  const levelReady = !service?.minLevel || Number(character.level || 0) >= service.minLevel;
  const affordable = Number(gameState.credits || 0) >= Number(selected.totalCredits);
  const ready = levelReady && hasFlag && affordable;
  const name = service?.title || (selected.items || []).map(item => `${item.name} ×${item.qty}`).join(" · ");
  const commit = `I accept offer ID ${selected.id}: ${selected.sellerName}'s offer for ${name} at ${Number(selected.totalCredits).toLocaleString("en-US")} credits. Complete only this specific saved offer, subject to current availability and requirements.`;
  return <section aria-label="NPC goods and services" className="max-w-4xl rounded-2xl border border-[#22e5c5]/25 bg-[#10141d] p-4 space-y-3">
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="text-[10px] tracking-[0.18em] text-[#22e5c5]">NPC OFFERS · CURRENT LOCATION</p>
        <h3 className="mt-1 text-base text-[#f2f0ea] font-semibold">Goods & services available to discuss</h3></div>
      <span className="text-xs text-[#8b93a3]">{offers.length} saved {offers.length === 1 ? "offer" : "offers"}</span>
    </header>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Select offer">
      {offers.map(offer => <button type="button" key={offer.id} onClick={() => setSelectedId(offer.id)}
        aria-pressed={selected.id === offer.id} className={`rounded-xl border px-3 py-2 text-left text-xs ${selected.id === offer.id ? "border-[#22e5c5] bg-[#22e5c5]/10 text-[#22e5c5]" : "border-white/10 text-[#a9adb8]"}`}>
        <span className="block font-semibold">{offer.sellerName}</span>
        <span className="block mt-1">{offer.service?.title || (offer.items || []).map(item => item.name).join(", ")}</span>
      </button>)}
    </div>
    <GlassCard className="p-4 space-y-3">
      <div className="flex flex-wrap justify-between gap-3"><div>
        <p className="text-xs text-[#8b93a3]">{service?.kind?.toUpperCase() || "MERCHANDISE"} · {selected.sellerName}</p>
        <h4 className="font-semibold mt-1 text-[#f2f0ea]">{name}</h4></div>
        <strong className="text-[#22e5c5]">{Number(selected.totalCredits).toLocaleString("en-US")} cr</strong></div>
      {service ? <dl className="grid gap-2 text-xs text-[#c7c4bc] sm:grid-cols-2">
        {service.details && <div><dt className="text-[#8b93a3]">Terms</dt><dd>{service.details}</dd></div>}
        {service.origin && <div><dt className="text-[#8b93a3]">Origin</dt><dd>{service.origin}</dd></div>}
        {service.destination && <div><dt className="text-[#8b93a3]">Destination</dt><dd>{service.destination}</dd></div>}
        {service.departure && <div><dt className="text-[#8b93a3]">Departure / appointment</dt><dd>{service.departure}</dd></div>}
        {service.durationMinutes && <div><dt className="text-[#8b93a3]">Duration</dt><dd>{service.durationMinutes.toLocaleString()} minutes</dd></div>}
      </dl> : <ul className="text-sm text-[#c7c4bc] space-y-1">{(selected.items || []).map((item,i)=><li key={i}>{item.name} ×{item.qty}</li>)}</ul>}
      {selected.priceSource && <p className="text-xs text-[#8b93a3]">Price reference: {selected.priceSource}</p>}
      {!levelReady && <p className="text-xs text-[#ffad76]">Requires Level {service.minLevel}.</p>}
      {!hasFlag && <p className="text-xs text-[#ffad76]">Requires {service.requiredFlag}.</p>}
      {!affordable && <p className="text-xs text-[#ffad76]">Insufficient spendable credits.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => onChoose?.(`I ask ${selected.sellerName} to explain the current terms, availability, and restrictions for ${name}.`)}
          className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#f2f0ea] disabled:opacity-30">ASK ABOUT TERMS</button>
        <button type="button" disabled={disabled} onClick={() => onChoose?.(`I negotiate with ${selected.sellerName} about ${name}, priced at ${selected.totalCredits} credits.`)}
          className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#f2f0ea] disabled:opacity-30">NEGOTIATE</button>
        <button type="button" disabled={disabled || !ready} onClick={() => onAccept?.(commit)}
          className="gc-btn px-3 py-2 text-xs disabled:opacity-30">{service ? "BOOK / HIRE" : "ACCEPT OFFER"}</button>
      </div>
      <p className="text-[11px] text-[#8b93a3]">Selecting, inspecting, and negotiating do not charge credits. Acceptance is resolved through the GM with the exact saved offer ID; a service booking does not begin travel or complete the service.</p>
    </GlassCard>
  </section>;
}
