import type {DatapadSnapshot} from "./datapad-save";
/**
 * NPC intelligence and offscreen planning are private GM state. The server
 * saves the full authoritative snapshot, but ordinary player endpoints never
 * disclose these fields (even after a hosted-turn replay).
 */
export const NPC_PRIVATE_FIELDS=["rivalIntelligence","npcOffscreen","npcMechanics"] as const;
export function playerVisibleSnapshot<T extends DatapadSnapshot|null>(snapshot:T):T {
 if(!snapshot)return snapshot;
 const state={...snapshot.gameState};
 for(const field of NPC_PRIVATE_FIELDS)delete state[field];
 return {...snapshot,gameState:state} as T;
}
/**
 * Client-initiated saves may change presentation, never server-only NPC
 * intelligence. Restore from the authoritative save even for legacy catalog
 * transactions.
 */
export function preserveNpcPrivateState(established:DatapadSnapshot,submitted:DatapadSnapshot):DatapadSnapshot {
 const state={...submitted.gameState};
 for(const field of NPC_PRIVATE_FIELDS){
  if(Object.prototype.hasOwnProperty.call(established.gameState,field))
   state[field]=established.gameState[field];
  else delete state[field];
 }
 return {...submitted,gameState:state};
}
