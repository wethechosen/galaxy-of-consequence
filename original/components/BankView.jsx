import { useState } from "react";
import { Link } from "react-router-dom";
import { useGame } from "@/original/lib/GameContext";
import { GlassCard } from "./GalaxyUI";
import { advancementGate } from "@/original/lib/sagaAdvancement";

export function BankView() {
  const { character, gameState, transferBankCredits, sending, saveReady, saveError, turnError } = useGame();
  const [amount, setAmount] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const value = Number(amount);
  const valid = Number.isSafeInteger(value) && value > 0;
  const credits = Number(gameState.credits || 0), deposited = Number(gameState.bankCredits || 0);
  const disabled = advancementGate(character || {}).blocked || sending || !saveReady || Boolean(saveError) || !valid;
  async function transfer(action) {
    setConfirmation("");
    if (await transferBankCredits(action, value)) {
      setConfirmation(`${value.toLocaleString()} credits ${action === "deposit" ? "deposited" : "withdrawn"}. Both balances are saved.`);
      setAmount("");
    }
  }
  return <div className="p-5 md:p-6 space-y-5">
    <div><p className="text-xs tracking-widest text-[#22e5c5]">PERSONAL BANKING</p><h2 className="gc-display text-2xl text-[#f2f0ea] mt-2">Credits & deposits</h2><p className="text-sm text-[#a9adb8] mt-2">Move your existing galactic credits between your spending balance and deposited funds. A transfer does not advance the story.</p></div>
    <div className="grid sm:grid-cols-2 gap-3">
      <GlassCard className="p-5"><p className="text-xs text-[#a9adb8]">SPENDABLE</p><p className="text-2xl text-[#22e5c5] mt-2">{credits.toLocaleString()} cr</p></GlassCard>
      <GlassCard className="p-5"><p className="text-xs text-[#a9adb8]">DEPOSITED</p><p className="text-2xl text-[#22e5c5] mt-2">{deposited.toLocaleString()} cr</p></GlassCard>
    </div>
    <p className="text-sm text-[#a9adb8]">Total galactic funds: <strong className="text-[#f2f0ea]">{(credits + deposited).toLocaleString()} cr</strong>. Depositing changes the split, not your total wealth.</p>
    <GlassCard className="p-5 max-w-xl">
      <label htmlFor="bank-transfer-amount" className="text-sm text-[#f2f0ea]">Amount in galactic credits</label>
      <input id="bank-transfer-amount" type="number" inputMode="numeric" min="1" step="1" value={amount} onChange={event => setAmount(event.target.value)} className="gc-input w-full p-3 mt-2" placeholder="Enter a whole-credit amount" />
      <div className="flex flex-wrap gap-3 mt-4"><button disabled={disabled || value > credits} onClick={() => transfer("deposit")} className="gc-btn px-4 py-2 text-xs disabled:opacity-30">DEPOSIT</button><button disabled={disabled || value > deposited} onClick={() => transfer("withdraw")} className="gc-btn px-4 py-2 text-xs disabled:opacity-30">WITHDRAW</button></div>
      {amount && !valid && <p role="alert" className="text-sm text-[#ffad76] mt-3">Use a positive whole-credit amount.</p>}
      {valid && value > credits && value > deposited && <p className="text-sm text-[#ffad76] mt-3">Neither balance covers that transfer.</p>}
      {confirmation && <p role="status" className="text-sm text-[#22e5c5] mt-3">{confirmation}</p>}
      {(turnError || saveError) && <p role="alert" className="text-sm text-[#ffad76] mt-3">{turnError || saveError}</p>}
      <p className="text-xs text-[#8b93a3] mt-4">Underworld credits remain separate. Deposits do not convert funds, earn automatic interest, or create new credits.</p>
    </GlassCard>
    <section><h3 className="text-xs tracking-widest text-[#a9adb8] mb-3">RECENT TRANSFERS</h3><div className="space-y-2">{(gameState.bankTransactions || []).slice(-10).reverse().map(entry => <div key={entry.transactionId} className="rounded-xl bg-white/5 p-3 text-sm text-[#c7c4bc]"><span className="capitalize">{entry.action}</span> · {Number(entry.amount).toLocaleString()} cr <span className="text-[#8b93a3]">· {new Date(entry.committedAt).toLocaleString()}</span></div>)}{!(gameState.bankTransactions || []).length && <p className="text-sm text-[#8b93a3]">No deposits or withdrawals recorded yet. Existing credits remain spendable until you deposit them.</p>}</div></section>
    <Link to="/exchanges" className="inline-block text-sm text-[#22d3ee] underline">Stocks, bonds, and galactic exchanges →</Link>
  </div>;
}
