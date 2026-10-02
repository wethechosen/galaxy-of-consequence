export interface SceneBrief { location: string; scene: string; playerAction: string; knownFacts: string[]; knownPeople: string[]; }
export interface GmProposal { narration: string; suggestions: string[]; requiresRules: boolean; citedFactIds: string[]; }
export interface GmProvider { propose(brief: SceneBrief): Promise<unknown>; }
export function validateProposal(raw: unknown, allowedFactIds: Set<string>): GmProposal {
  if (!raw || typeof raw !== "object") throw new Error("Invalid GM response");
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).some(key => !["narration", "suggestions", "requiresRules", "citedFactIds"].includes(key))) throw new Error("Unauthorized GM fields");
  if (typeof value.narration !== "string" || !value.narration.trim() || value.narration.length > 8000) throw new Error("Invalid narration");
  if (typeof value.requiresRules !== "boolean") throw new Error("Missing rules decision");
  if (!Array.isArray(value.suggestions) || value.suggestions.length > 4 || value.suggestions.some(s => typeof s !== "string" || s.length > 300)) throw new Error("Invalid suggestions");
  if (!Array.isArray(value.citedFactIds) || value.citedFactIds.some(id => typeof id !== "string" || !allowedFactIds.has(id))) throw new Error("Unapproved source claim");
  return value as unknown as GmProposal;
}
// Development fixture only: it never reads or updates the real campaign.
export class TestGmProvider implements GmProvider {
  async propose(brief: SceneBrief): Promise<GmProposal> {
    return { narration: `TEST SCENE — ${brief.scene}\n\nYour intention was received: “${brief.playerAction}”. This is an interface preview; no action, roll, expenditure or world event has occurred.`, suggestions: ["Describe what you want to learn", "Ask for a recap", "Try another intention"], requiresRules: false, citedFactIds: [] };
  }
}
export async function previewTurn(action: string) {
  return validateProposal(await new TestGmProvider().propose({ location: "Development scene", scene: "A quiet docking lounge provides a neutral test setting.", playerAction: action, knownFacts: [], knownPeople: [] }), new Set());
}
