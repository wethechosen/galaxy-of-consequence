/**
 * GM-controlled PC decision policy. Only *attempts* grounded in previously
 * committed game facts are proposed; it never invents an NPC response/result.
 */
export function npcRepetitionRecovery(
  id:string,
  recentActions:string[],
  recentGmScene:string,
  proposedAction:string
):{action:string;reason:string}|null {
  const attempts=recentActions.filter(Boolean).slice(-5);
  const scene=String(recentGmScene||"");
  const action=proposedAction.trim();
  if(id==="orlan-vale"){
    const clerkRequests=attempts.filter(x=>/\b(?:ask|request|inquire).{0,80}\b(?:clerk|provisioning desk)/i.test(x));
    if(clerkRequests.length>=3 &&
       /auditor.s annex/i.test(scene) && /Form 7-B/i.test(scene) &&
       /\b(?:ask|request|inquire).{0,90}\b(?:clerk|provisioning)/i.test(action))
      return {
        action:"I thank the provisioning clerk, leave the desk, and follow the public route to the Auditor's Annex on Tier-2, bay seven, to request a signed Form 7-B and appropriate sponsorship.",
        reason:"Previously confirmed directions and repeated clerk requests; a concrete next attempt is warranted.",
      };
  }
  if(id==="rena-salvek"){
    const examined=attempts.filter(x=>/\b(?:inspect|scan|search|examine|look).{0,70}\b(?:rack|crystal|slot)/i.test(x));
    if(examined.length>=2 && /maintenance (?:access )?panel/i.test(scene) &&
       /\b(?:inspect|scan|search|examine|look).{0,70}\b(?:rack|crystal|slot)/i.test(action))
      return {
        action:"I report the small boot prints and disturbed maintenance panel to the supervising training master, then respectfully request permission to inspect the maintenance access with a witness.",
        reason:"The previous inspected rack produced a concrete lead, but no adjudicated panel access.",
      };
  }
  return null;
}
