import {describe,it,expect} from "vitest";
import {accountStore,type Account} from "./accounts";
import {readDatapad} from "./datapad-save";
import {runGmTurn} from "./gm";
import {hasAuditedNpcUltimateCompletion} from "./npc-ultimate-verification";
import {NPC_ULTIMATE_ARCS} from "./npc-ultimate-arcs";
const enabled=process.env.GOC_VERIFY_BREN==="1";
const step=Number(process.env.GOC_BREN_STEP||4);
const actions:Record<number,string>={
4:"I approach the public Socorro transit control desk with the recorded ROUTE_OVERFLOW_07 diagnostic evidence for Shelter Beta. I formally request an authorized maintenance work order to disable the dangerous direction marker or repair it, with a logged safety notice to keep civilians away from restricted Hangar 7-B until the route is verified.",
5:"I return to the public transit concourse and examine the Shelter Beta route display for an officially posted warning or safe alternate route associated with Work Order 7-Beta-9, remaining entirely outside Hangar 7-B restricted access.",
6:"I request the public status of Work Order 7-Beta-9 from the authorized maintenance desk and ask whether the unsafe Shelter Beta vector has been repaired or disabled, and whether the corrected directions passed the supervisor's safety check.",
7:"If authorized staff have actually confirmed a safe public route, I follow that posted civilian route on foot from the concourse to the shelter entrance, avoiding the restricted hangar entirely, and record any remaining defect; otherwise I remain at the public waiting area for clearance.",
8:"I submit my actual public-route observations to the transit control desk and request documented work-order closure only if the erroneous vector has been made safe, the public warning handled, and the civilian route verified to reach the shelter without entering a restricted hangar.",
};
const action=actions[step];
describe.skipIf(!enabled)("real Bren Varo long-goal resolution",()=>{
  it("advances only the next committed PC action, preserving GM outcome",async()=>{
    expect(process.env.CAMPAIGN_DB_PATH).toMatch(/npc-autoplay-150\.sqlite$/);
    expect(action).toBeDefined();
    const db=accountStore();
    const actor=db.prepare("SELECT id,username,displayName,role FROM accounts WHERE username=?").get("npc-autoplay-bren-varo") as Account|undefined;
    expect(actor).toBeTruthy();
    const saved=readDatapad(actor!,null,db);
    const turnId="npc-real-bren-varo-t"+String(step).padStart(3,"0");
    const priorEvents=(Array.isArray(saved.snapshot?.gameState.turnEvents)?saved.snapshot.gameState.turnEvents:[]) as Array<{turnId?:string}>;
    const existing=priorEvents.find(e=>e.turnId===turnId);
    if(existing){console.info("BREN_CONFIRMED_EXISTING_TURN",JSON.stringify(existing));return;}
    const receipt=await runGmTurn(actor!,{revision:saved.revision,turnId,action});
    expect(receipt.receipt.status).toBe("committed");
    const after=readDatapad(actor!,null,db);
    expect(after.revision).toBe(receipt.revision);
    const afterEvents=(Array.isArray(after.snapshot?.gameState.turnEvents)?after.snapshot.gameState.turnEvents:[]) as Array<{turnId?:string}>;
    expect(afterEvents.some(e=>e.turnId===turnId)).toBe(true);
    console.info("BREN_REAL_TURN",JSON.stringify({step,revision:after.revision,narration:receipt.narration,complete:hasAuditedNpcUltimateCompletion(after.snapshot,NPC_ULTIMATE_ARCS["bren-varo"])}));
  },600000);
});
