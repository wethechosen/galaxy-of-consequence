import { useState } from "react";
import { useGame } from "@/original/lib/GameContext";
import { getMarket, getTradeAccess, getSellQuote } from "@/original/lib/marketCatalog";
import { GlassCard } from "./GalaxyUI";

export function MarketplaceView({ setTab }) {
  const { character, gameState, buyMarketGood, sellMarketGood, sendTurn, sending, saveReady, saveError, turnError } = useGame();
  const [venue, setVenue] = useState("bazaar");
  const [pending, setPending] = useState("");
  const [receipt, setReceipt] = useState("");
  const market = getMarket(gameState.location, character?.level || 1, gameState);
  const selected = market.merchants.find(merchant => merchant.kind === venue) || market.merchants[0];
  const locked = sending || Boolean(pending) || !saveReady || Boolean(saveError);
  async function buy(good) {
    setPending(good.id); setReceipt("");
    try { if (await buyMarketGood(good)) setReceipt(`${good.name} purchased for ${good.price.toLocaleString()} credits. ${good.ownership === "property" ? "The deed is in Properties." : good.ownership === "vehicle" ? "Your vehicle is in Hangar Bay, held at this location." : "Your inventory and spending balance are updated."}`); }
    finally { setPending(""); }
  }
  async function sell(item) {
    const quote = getSellQuote(item, gameState.location);
    setPending(item.id); setReceipt("");
    try { if (await sellMarketGood(item)) setReceipt(`One ${item.name} sold for ${quote.price.toLocaleString()} credits. Inventory and balance updated.`); }
    finally { setPending(""); }
  }
  return <div className="p-5 md:p-6 space-y-5">
    <header className="flex flex-wrap justify-between gap-4"><div><p className="text-xs tracking-widest text-[#22e5c5]">{market.area.planet} · {market.area.district}</p><h2 className="gc-display text-2xl text-[#f2f0ea] mt-2">{market.area.name}</h2><p className="text-sm text-[#a9adb8] mt-2 max-w-2xl">{market.area.note}</p></div><p className="text-xs text-[#8b93a3]">SPENDABLE<br/><strong className="text-lg text-[#22e5c5]">{Number(gameState.credits).toLocaleString()} cr</strong></p></header>
    <nav aria-label="Local merchant categories" className="flex flex-wrap gap-2">{market.merchants.map(merchant => <button key={merchant.id} onClick={() => setVenue(merchant.kind)} aria-pressed={selected.id === merchant.id} className={`rounded-xl border px-3 py-2 text-sm ${selected.id === merchant.id ? "border-[#22e5c5] text-[#22e5c5] bg-white/10" : "border-white/10 text-[#a9adb8]"}`}>{merchant.name}</button>)}</nav>
    <p className="text-sm text-[#a9adb8]">{selected.description}. Listings stay local; browsing does not move your character.</p>
    {(turnError || saveError) && <p role="alert" className="text-sm text-[#ffad76]">{turnError || saveError}</p>}
    {receipt && <p role="status" className="rounded-xl border border-[#22e5c5]/30 p-4 text-sm text-[#22e5c5]">{receipt}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{market.goods.filter(good => good.merchantId === selected.id).map(good => {
      const access = getTradeAccess(gameState.location, character, gameState, good);
      return <GlassCard key={good.id} className="p-4"><p className="text-xs tracking-widest text-[#8b93a3]">{good.category}</p><h3 className="text-[#f2f0ea] font-semibold mt-2">{good.name}</h3><p className="text-xs text-[#a9adb8] mt-2">{selected.name} · {good.legality}</p><div className="flex flex-wrap justify-between items-center gap-3 mt-4"><strong className="text-[#22e5c5]">{good.price.toLocaleString()} cr</strong><button disabled={locked || !access.direct} title={access.reason} onClick={() => buy(good)} className="gc-btn px-3 py-2 text-xs disabled:opacity-30">{pending === good.id ? "CONFIRMING…" : access.owned ? "OWNED" : "BUY"}</button></div>{!access.direct && <p className="text-xs text-[#e5a26f] mt-3">{access.reason}</p>}</GlassCard>;
    })}</div>
    {market.offers.length > 0 && <section><h3 className="text-xs tracking-widest text-[#22e5c5] mb-3">OFFERS FROM YOUR CURRENT SCENE</h3><div className="grid gap-3 sm:grid-cols-2">{market.offers.map(offer => <GlassCard key={offer.id} className="p-4"><h4 className="text-[#f2f0ea] font-semibold">{offer.sellerName}</h4><p className="text-sm text-[#a9adb8] mt-2">{(offer.items || []).map(item => `${item.name} ×${item.qty}`).join(" · ")}</p><p className="text-[#22e5c5] mt-2">{Number(offer.totalCredits).toLocaleString()} cr</p><button disabled={locked} className="gc-btn px-3 py-2 text-xs mt-3 disabled:opacity-30" onClick={async () => { setPending(offer.id); try { if (await sendTurn(`I accept ${offer.sellerName}'s offer for ${(offer.items || []).map(item => item.name).join(" and ")} at ${offer.totalCredits} credits.`)) setTab("play"); } finally { setPending(""); } }}>ACCEPT THIS OFFER</button></GlassCard>)}</div></section>}
    <section><h3 className="text-xs tracking-widest text-[#22e5c5] mb-3">SELL COMMON SUPPLIES</h3><div className="space-y-2">{(gameState.inventory || []).map(item => { const quote = getSellQuote(item, gameState.location); return quote ? <div key={item.id} className="rounded-xl bg-white/5 p-3 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-[#f2f0ea]">{item.name} ×{item.qty}</span><button disabled={locked || !market.area.available} onClick={() => sell(item)} className="gc-btn px-3 py-2 text-xs disabled:opacity-30">SELL ONE · {quote.price.toLocaleString()} cr</button></div> : null; })}</div></section>
    <p className="text-xs text-[#8b93a3]">These are local campaign listings. Rare goods, negotiated terms, lodging conversations, and other requests remain available through Play. Buying never equips gear, moves you into a home, or drives a vehicle for you.</p>
  </div>;
}
