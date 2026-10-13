import { GlassCard } from "./GalaxyUI";
import { buildAssetLedger } from "@/original/lib/assetLedger";

const credits = amount => amount === null ? "Not recorded" : amount.toLocaleString() + " cr";

export default function AssetLedgerPanel({ gameState }) {
  const ledger = buildAssetLedger(gameState);
  return (
    <GlassCard className="p-5 mt-4" >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] tracking-[0.2em] text-[#22e5c5]">SAVED ASSET LEDGER</p>
          <h2 className="text-lg text-[#f2f0ea] mt-1">Financial position & recorded holdings</h2>
        </div>
        <span className="text-[9px] uppercase tracking-widest text-[#8b93a3]">Read only · confirmed save</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["SPENDABLE", ledger.balances.spendable],
          ["DEPOSITED", ledger.balances.deposited],
          ["TOTAL GALACTIC FUNDS", ledger.balances.totalGalactic],
          ["PHYSICAL CHIPS · SEPARATE", ledger.balances.underworld],
        ].map(([name, value]) => (
          <div className="rounded-xl border border-white/10 p-3 bg-white/[.025]" key={name}>
            <p className="text-[9px] tracking-widest text-[#8b93a3]">{name}</p>
            <strong className="block mt-2 text-sm text-[#f2f0ea]">{credits(value)}</strong>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#8b93a3] mt-3">Deposits are included once in electronic funds. Physical galactic credit chips are shown separately; the inventory chip record represents the same cash, not additional funds.</p>

      <section className="mt-5" aria-label="Recorded asset holdings">
        <h3 className="text-[10px] tracking-widest text-[#22e5c5] mb-2">HOLDINGS & ACCESS · {ledger.holdings.length} ENTRIES</h3>
        {ledger.holdings.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {ledger.holdings.map(asset => (
              <div className="border border-white/10 rounded-xl p-3" key={asset.category + ":" + asset.id}>
                <p className="text-sm text-[#f2f0ea]">{asset.name}</p>
                <p className="text-[10px] text-[#8b93a3] mt-1 uppercase tracking-wider">{asset.category} · {asset.status}</p>
                <p className="text-xs text-[#c7c4bc] mt-2">{asset.location}</p>
                {asset.status === "leasehold" ? (
                  <p className="text-xs text-[#a9adb8] mt-2">Tenancy only · rent {credits(asset.rentCredits)} · landlord-held deposit {credits(asset.depositCredits)}</p>
                ) : <p className="text-xs text-[#a9adb8] mt-2">Recorded basis: {credits(asset.basisCredits)} · not a current market valuation</p>}
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-[#8b93a3]">No recorded properties, vessels or investment positions.</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2 mt-5">
        <section aria-label="Saved purchase receipts">
          <h3 className="text-[10px] tracking-widest text-[#22e5c5] mb-2">MERCHANT RECEIPTS</h3>
          {ledger.purchases.length ? ledger.purchases.map(entry => (
            <div key={entry.id} className="border-b border-white/10 py-2 last:border-b-0">
              <p className="text-sm text-[#d7d4cc]">{entry.seller} · {credits(entry.amountCredits)}</p>
              <p className="text-xs text-[#8b93a3] mt-1">{entry.items.map(item => item.name + " ×" + item.quantity).join(", ") || "No itemization recorded"}{entry.lease ? " · includes tenancy terms" : ""}</p>
            </div>
          )) : <p className="text-xs text-[#8b93a3]">No completed merchant receipts recorded.</p>}
        </section>
        <section aria-label="Saved bank transactions">
          <h3 className="text-[10px] tracking-widest text-[#22e5c5] mb-2">BANK TRANSFERS</h3>
          {ledger.transfers.length ? ledger.transfers.map(entry => (
            <div key={entry.id} className="border-b border-white/10 py-2 last:border-b-0">
              <p className="text-sm text-[#d7d4cc] capitalize">{entry.action} · {credits(entry.amountCredits)}</p>
              {entry.committedAt && <p className="text-xs text-[#8b93a3] mt-1">{entry.committedAt}</p>}
            </div>
          )) : <p className="text-xs text-[#8b93a3]">No bank transfers recorded.</p>}
        </section>
      </div>
      <p className="text-xs text-[#8b93a3] mt-4 border-t border-white/10 pt-3">{ledger.valuationStatus} Suspected inheritance remains a claim, not available capital. This panel never grants assets or changes campaign state.</p>
    </GlassCard>
  );
}
