import React, { useState } from "react";
import { currentTradeOffers } from "@/lib/conversation-trade";

/**
 * A single contextual offer surface shared with the authoritative GM ledger.
 * Nothing here mutates state: choosing an offer sends a natural-language
 * declaration through the same turn resolver used by ordinary dialogue.
 */
export function NpcOfferMenu({ gameState, onAction, disabled = false }) {
  const [expanded, setExpanded] = useState(null);
  const offers = currentTradeOffers(gameState || {});
  if (!offers.length) return null;
  return <section aria-label="Offers from NPCs in this scene" className="rounded-xl border border-[#22e5c5]/30 bg-[#0a1119]/95 p-3 space-y-3">
    <div>
      <h3 className="text-xs tracking-widest text-[#22e5c5]">AVAILABLE NPC OFFERS</h3>
      <p className="text-xs text-[#a9adb8] mt-1">Terms from characters at your current location. Browsing does not purchase, reserve, or spend credits.</p>
    </div>
    {offers.map(offer => <div key={offer.id} className="rounded-xl border border-white/10 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div><strong className="text-[#f2f0ea] text-sm">{offer.sellerName}</strong>
          <div className="text-xs text-[#a9adb8]">{offer.sellerSpecies || "NPC"} · {offer.items.map(item => `${item.name} ×${item.qty}`).join(", ")}</div>
        </div>
        <strong className="text-[#22e5c5] text-sm whitespace-nowrap">{Number(offer.totalCredits).toLocaleString()} cr</strong>
      </div>
      {expanded === offer.id && <div className="text-xs text-[#a9adb8] space-y-1">
        {offer.items.map((item, index) => <p key={index}>{item.name} · Quantity {item.qty}</p>)}
        {offer.priceComponents?.map((part, index) => <p key={index}>{part.label}: {Number(part.credits).toLocaleString()} cr</p>)}
        {offer.lease && <p>Lease: {offer.lease.termMonths} months · {offer.lease.propertyName} · {offer.lease.propertyLocation}</p>}
        <p>Any additional legal, access, or scheduling requirements are resolved by the GM, not this display.</p>
      </div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setExpanded(expanded === offer.id ? null : offer.id)} className="border border-white/20 rounded-lg px-3 py-1.5 text-xs text-[#d7d4cc]">TERMS</button>
        <button type="button" disabled={disabled} onClick={() => onAction(`I ask ${offer.sellerName} about the terms, stock, schedule and any access requirements for offer ${offer.id}. I am not accepting or paying yet.`)} className="border border-white/20 rounded-lg px-3 py-1.5 text-xs text-[#d7d4cc] disabled:opacity-40">ASK</button>
        <button type="button" disabled={disabled} onClick={() => onAction(`I negotiate with ${offer.sellerName} over offer ${offer.id}, priced at ${offer.totalCredits} credits. Do not complete a purchase without my acceptance.`)} className="border border-white/20 rounded-lg px-3 py-1.5 text-xs text-[#d7d4cc] disabled:opacity-40">NEGOTIATE</button>
        <button type="button" disabled={disabled} onClick={() => onAction(`I accept ${offer.sellerName}'s offer ${offer.id} for ${offer.items.map(item => item.name).join(" and ")} at ${offer.totalCredits} credits.`)} className="gc-btn px-3 py-1.5 text-xs disabled:opacity-40">ACCEPT OFFER</button>
      </div>
    </div>)}
  </section>;
}
