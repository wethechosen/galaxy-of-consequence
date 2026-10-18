import {describe,it,expect} from "vitest";
import {advanceJediInstitution,jediInstitutionGmContext,emptyJediInstitutionState} from "./jedi-institution-scheduler";
import {playerVisibleSnapshot,preserveNpcPrivateState,NPC_PRIVATE_FIELDS} from "./npc-private-state";
import {factionGmContext} from "./faction-strategy-150aby";
import type {DatapadSnapshot} from "./datapad-save";
type S={gameState:Record<string,unknown>};
const t=(id:string)=>({turnId:id,changes:{},action:"Player interaction unrelated to the Jedi"});
const base=():S=>({gameState:{campaignTimeMinutes:100,location:"Bonadan",credits:500,health:24,
  turnEvents:[t("before")],inventory:[]}});
const next=(prior:S,turn:string,minute:number):S=>{
 const saved: S={gameState:{...prior.gameState,campaignTimeMinutes:minute,
   turnEvents:[...(prior.gameState.turnEvents as unknown[]),t(turn)]}};
 saved.gameState.jediInstitution=advanceJediInstitution(prior,saved,turn);
 return saved;
};
describe("Jedi institutional planning runs on authoritative time, without simulating invented outcomes",()=>{
 it("does not seed plans without a committed turn or by replaying an old turn",()=>{
   const initial=base();
   expect(advanceJediInstitution(initial,initial,"uncommitted")).toBeNull();
   const first=next(initial,"turn-1",120);
   expect(advanceJediInstitution(first,first,"turn-1")).toEqual(first.gameState.jediInstitution);
 });
 it("does not inject the 150 ABY restored Order into an explicitly earlier-era save",()=>{
   const original=base();original.gameState.campaignYearABY=139;
   const later: S={gameState:{...original.gameState,campaignTimeMinutes:250,turnEvents:[...(original.gameState.turnEvents as unknown[]),t("old-era")]}};
   expect(advanceJediInstitution(original,later,"old-era")).toBeNull();
   const missingYear:S=structuredClone(later);
   delete missingYear.gameState.campaignYearABY;
   expect(advanceJediInstitution(original,missingYear,"old-era")).toBeNull();
 });
 it("initializes all six work programs in the current era without retroactive missions",()=>{
   const a=next(base(),"turn-1",200);
   const x=a.gameState.jediInstitution as ReturnType<typeof emptyJediInstitutionState>;
   expect(x.version).toBe(1);
   expect(x.foundedAtMinute).toBe(200);
   expect(x.programs).toHaveLength(6);
   expect(new Set(x.programs.map(p=>p.mandateId)).size).toBe(6);
   expect(x.programs.every(p=>p.stage==="preparing"&&p.dueAtMinute>200&&p.result==="unadjudicated")).toBe(true);
   expect(a.gameState.credits).toBe(500);
   expect(a.gameState.health).toBe(24);
   expect(a.gameState).not.toHaveProperty("jediCouncilAppointments");
   expect(a.gameState).not.toHaveProperty("troopsMoved");
 });
 it("matures at the scheduled fictional minute but never marks success",()=>{
   const a=next(base(),"a",100);
   const early=next(a,"early",1540);
   expect((early.gameState.jediInstitution as any).programs.filter((p:any)=>p.stage==="awaiting_gm")).toHaveLength(1);
   const later=next(early,"later",10200);
   const ops=(later.gameState.jediInstitution as any).programs;
   expect(ops).toHaveLength(6);
   expect(ops.every((p:any)=>p.stage==="awaiting_gm"&&p.result==="unadjudicated")).toBe(true);
   expect(jediInstitutionGmContext(later).reviewReady).toBe(6);
   expect(jediInstitutionGmContext(later).proposals.every((p:any)=>p.outcome==="unadjudicated")).toBe(true);
 });
 it("cannot advance backward or accept corrupted program IDs",()=>{
   const a=next(base(),"a",120);
   expect(()=>next(a,"backward",110)).toThrow(/backward/i);
   const corrupt: S=structuredClone(a);
   (corrupt.gameState.jediInstitution as any).programs[0].mandateId="secret-exterminate-all-sith";
   expect(()=>next(corrupt,"forged",150)).toThrow(/canon charter/);
   const forgedDue: S=structuredClone(a);
   (forgedDue.gameState.jediInstitution as any).programs[0].dueAtMinute+=9999;
   expect(()=>next(forgedDue,"forged-due",150)).toThrow(/canon charter/);
   const forgedId: S=structuredClone(a);
   (forgedId.gameState.jediInstitution as any).programs[0].id="jedi:fake-victory";
   expect(()=>next(forgedId,"forged-id",150)).toThrow(/canon charter/);
 });
 it("private institutional plans cannot be read or modified by ordinary player saves",()=>{
   expect(NPC_PRIVATE_FIELDS).toContain("jediInstitution");
   const a=next(base(),"a",120);
   const snapshot:DatapadSnapshot={character:{name:"Tester"},gameState:a.gameState,
     settings:{},messages:[],comms:[]};
   expect(playerVisibleSnapshot(snapshot)?.gameState).not.toHaveProperty("jediInstitution");
   const altered:DatapadSnapshot=structuredClone(snapshot);
   altered.gameState.jediInstitution={version:1,factionId:"new-jedi-order",programs:[],lastMinute:999999};
   expect(preserveNpcPrivateState(snapshot,altered).gameState.jediInstitution).toEqual(snapshot.gameState.jediInstitution);
 });
 it("only provides live Jedi status when actually relevant to a player inquiry",()=>{
   const a=next(base(),"a",120);
   const generic=factionGmContext(a,"How do I book a bespoke tailor appointment?");
   expect(generic.factions).toHaveLength(0);
   const matching=factionGmContext(a,"What is the New Jedi Order doing in the galaxy?");
   expect(matching.jediRecovery?.currentInstitutionalPlans.active).toBe(true);
   expect(matching.jediRecovery?.currentInstitutionalPlans.proposals).toHaveLength(6);
   expect(matching.proposals).toHaveLength(0); // no competing generic Jedi plan
   expect(JSON.stringify(generic)).not.toContain("jediInstitution");
 });
});
