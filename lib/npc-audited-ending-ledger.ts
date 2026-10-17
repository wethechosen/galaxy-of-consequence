/** Audited sandbox outcomes, NOT a claim that these saves have been migrated to hosted production. */
export const NPC_VERIFIED_LOCAL_ENDINGS = Object.freeze({
  "bren-varo": Object.freeze({
    status:"goal_complete",
    source:"isolated-NVIDIA-live-playthrough",
    location:"Socorro - Shelter Beta entrance",
    goal:"Have the dangerous public shelter wayfinding fault fixed or made safely inaccessible, and verify civilians can reach the shelter without entering restricted hangars.",
    evidenceRevision:11,
    turnCount:7,
    evidenceTurnIds:[
      "npc-real-bren-varo-t001",
      "npc-real-bren-varo-t004",
      "npc-real-bren-varo-t005",
      "npc-real-bren-varo-t006",
      "npc-real-bren-varo-t007",
    ],
    evidenceDigest:"cdbd077a0cc85224dedb681f1e9985488e7df6ef7e5867968cfd446cb08722b1",
    reviewedAt:"2026-10-16",
    outcome:"Authorized work order completed, warning observed, and civilian route to Shelter Beta walked without entering restricted Hangar 7-B.",
    hostedSaveMigrated:false,
  }),
});
export function npcVerifiedLocalEnding(id:string) {
  return NPC_VERIFIED_LOCAL_ENDINGS[id as keyof typeof NPC_VERIFIED_LOCAL_ENDINGS]??null;
}
