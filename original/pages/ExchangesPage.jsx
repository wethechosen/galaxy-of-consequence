import { Activity, Landmark, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useGame } from "@/original/lib/GameContext";
import { Shell, TopBar, GlassCard } from "@/original/components/GalaxyUI";
import { EXCHANGE_TICKER, IGFED, getExchange, getSecuritiesForExchange } from "@/original/lib/marketCatalog";

export default function ExchangesPage() {
  const { character, gameState } = useGame();
  const currentExchange = getExchange(gameState.location);
  const [selectedExchangeId, setSelectedExchangeId] = useState(currentExchange.id === "regional" ? EXCHANGE_TICKER[0].id : currentExchange.id);
  const [tickerTime, setTickerTime] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setTickerTime(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const selectedExchange = EXCHANGE_TICKER.find((exchange) => exchange.id === selectedExchangeId) || EXCHANGE_TICKER[0];
  const securities = getSecuritiesForExchange(selectedExchange.id, tickerTime, gameState);

  return (
    <Shell>
      <TopBar character={character} gameState={gameState} />
      <main className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full">
        <div className="mb-8">
          <p className="text-[10px] tracking-[0.3em] text-[#22e5c5] mb-2">GALACTIC COMMERCE // 150 ABY</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="gc-display text-3xl font-bold text-[#f2f0ea]">EXCHANGES</h1>
              <p className="text-sm text-[#a9adb8] mt-2 max-w-2xl">A current market brief covering recognized exchange desks, regional liquidity, and the monetary authority that gives the galactic credit its common footing.</p>
            </div>
            <div className="text-right text-xs text-[#a9adb8]">CURRENT MARKET<br /><strong className="text-[#22e5c5]">{currentExchange.name}</strong></div>
          </div>
        </div>

        <GlassCard className="p-5 mb-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] tracking-[0.2em] text-[#22e5c5]">GALACTIC SECURITIES TICKER</p>
              <h2 className="gc-display text-xl font-bold text-[#f2f0ea] mt-1">{selectedExchange.name.toUpperCase()}</h2>
            </div>
            <div className="text-right text-[10px] tracking-widest text-[#5c6370]">REFRESHES EVERY 30 SECONDS<br /><span className="text-[#8b93a3]">LOCAL MARKET TIME {new Date(tickerTime).toLocaleTimeString()}</span></div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[860px] grid grid-cols-[1.5fr_.65fr_.7fr_1fr_.8fr_.8fr] gap-3 px-3 py-2 text-[9px] tracking-widest text-[#5c6370] border-b border-white/10">
              <span>INSTRUMENT</span><span>TYPE</span><span>DESK</span><span>SECTOR</span><span>LAST</span><span>MOVE</span>
            </div>
            {securities.map((security) => (
              <div key={security.symbol} className="min-w-[860px] grid grid-cols-[1.5fr_.65fr_.7fr_1fr_.8fr_.8fr] gap-3 items-center px-3 py-3 text-xs border-b border-white/5 last:border-0">
                <div><strong className="text-[#f2f0ea]">{security.symbol}</strong><span className="text-[#8b93a3] ml-2">{security.name}</span></div>
                <span className="text-[#a9adb8]">{security.instrument === "bond" ? `BOND${security.coupon ? ` ${security.coupon}%` : ""}` : "STOCK"}</span>
                <span className="text-[#a9adb8]">{security.exchange.toUpperCase()}</span>
                <span className="text-[#a9adb8]">{security.sector}</span>
                <span className="text-[#f2f0ea]">{security.price.toFixed(2)} cr</span>
                <span className={security.rising ? "text-[#22e5c5]" : "text-[#e23b3b]"}>{security.rising ? "▲" : "▼"} {security.change >= 0 ? "+" : ""}{security.change.toFixed(2)}%</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#5c6370] mt-4">Ticker values are simulated in-universe quotations for the campaign. They reflect market pressure and local ledger conditions; they are not player-owned securities and do not create holdings or guaranteed returns.</p>
        </GlassCard>

        <GlassCard className="p-5 mb-6 border-l-2 border-[#22e5c5]">
          <div className="flex items-start gap-4">
            <Landmark className="text-[#22e5c5] shrink-0 mt-1" size={22} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-[10px] tracking-[0.2em] text-[#22e5c5]">{IGFED.status}</p><h2 className="gc-display text-2xl font-bold text-[#f2f0ea] mt-1">{IGFED.name} <span className="text-[#8b93a3]">({IGFED.abbreviation})</span></h2></div>
                <div className="text-right text-xs text-[#a9adb8]">RESERVE GUIDANCE<br /><strong className="text-[#f2f0ea]">{IGFED.reserveRate}</strong></div>
              </div>
              <p className="text-sm text-[#c7c4bc] leading-relaxed mt-4">{IGFED.mandate}</p>
              <p className="text-xs text-[#8b93a3] mt-3">{IGFED.bulletin}</p>
              <div className="grid gap-2 sm:grid-cols-3 mt-4">{IGFED.notices.map((notice) => <div key={notice} className="rounded-lg bg-white/5 p-3 text-xs text-[#a9adb8]">{notice}</div>)}</div>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-4 md:grid-cols-2">
          {EXCHANGE_TICKER.map((exchange) => {
            const rising = exchange.signal === "▲";
            const Trend = rising ? TrendingUp : TrendingDown;
            return (
              <button type="button" key={exchange.id} onClick={() => setSelectedExchangeId(exchange.id)} className="text-left">
              <GlassCard className={`p-5 h-full transition-all hover:border-[#22e5c5]/60 ${exchange.id === selectedExchange.id ? "border border-[#22e5c5]/70 shadow-[0_0_20px_rgba(34,229,197,.12)]" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-[10px] tracking-[0.2em] text-[#8b93a3]">RECOGNIZED DESK</p><h2 className="text-lg font-semibold text-[#f2f0ea] mt-1">{exchange.name}</h2></div>
                  <div className={`flex items-center gap-1 text-sm font-bold ${rising ? "text-[#22e5c5]" : "text-[#e23b3b]"}`}><Trend size={15} />{exchange.change}</div>
                </div>
                <p className="text-sm text-[#a9adb8] leading-relaxed mt-4">{exchange.note}</p>
                <div className="flex items-center gap-2 mt-5 text-[10px] tracking-widest text-[#5c6370]"><Activity size={13} /> QUOTES FOLLOW GALACTIC CONDITIONS</div>
                <div className="mt-5 text-[10px] tracking-widest text-[#22e5c5]">{exchange.id === selectedExchange.id ? "DESK SELECTED — VIEWING LISTINGS" : "SELECT DESK TO VIEW LISTINGS"}</div>
              </GlassCard>
              </button>
            );
          })}
        </div>

        <GlassCard className="p-5 mt-6">
          <div className="flex items-center gap-2 text-[#ff7a1a]"><ShieldAlert size={17} /><p className="text-[10px] tracking-[0.2em]">SETTLEMENT WARNING</p></div>
          <p className="text-sm text-[#a9adb8] leading-relaxed mt-3">These quotations are market intelligence, not a promise of profit. Sanctions, route closures, counterfeit currency, faction pressure, identity checks, debt, and local spreads can change the going rate. Restricted and illicit markets are not IGFED-cleared and require an earned contact and explicit Game Master adjudication.</p>
          <p className="text-xs text-[#5c6370] mt-3">Credit standard: {IGFED.creditStandard}.</p>
        </GlassCard>
      </main>
    </Shell>
  );
}
