/**
 * Deterministic guard around the AI intent interpreter.
 * The AI can refine this contract but cannot convert a research, diagnostic or
 * combat declaration into an unrelated retail action.
 */
import {positiveActionText,permitsLocationChange} from "./action-intent";
import {isReadOnlyGoodsInspection} from "./goods-inspection";
import {isExplicitAttackDeclaration,isObjectAttackDeclaration} from "./gpt-turn-intent";
import {npcGameplayResult} from "./npc-decision-context";
export type ActionKind=
 "combat"|"research"|"technical"|"merchandise_inspection"|"commerce"|
 "negotiation"|"investigation"|"travel"|"dialogue"|"exploration"|"other";
export type RpgActionContract={
  version:1;kind:ActionKind;declaration:string;knownTarget:string|null;
  movementDeclared:boolean;outcomeAuthority:"server-gm-only";
  outcomeRule:string;
};
const normalize=(v:string)=>v.trim().replace(/\s+/g," ").slice(0,700);
const extractsTarget=(a:string)=>{
 const t=/\b(?:at|on|about|from|of|against|toward|towards|into|with)\s+((?:the|my|a|an)\s+[^,.;!?]{2,80})/i.exec(a)?.[1]
    ||/\b(?:database|registry|maintenance logs|medpac|clerk|ship|shelter|freighter|soil|test plots?|merchant|archive)\b/i.exec(a)?.[0];
 return t?normalize(t).slice(0,100):null;
};
export function interpretRpgActionContract(declaration:string):RpgActionContract{
 const action=normalize(positiveActionText(declaration));
 const s=action.toLowerCase();
 const combat=isExplicitAttackDeclaration(action)||isObjectAttackDeclaration(action);
 const research=/\b(?:database|public registry|records?|archive|logs?|archives?|files?|manifest|documents?|evidence|certificate|certification|identity|timestamps?|audit|cross-reference|data streams?|registrations?|provenance|surveillance)\b/i.test(s)
  && /\b(?:check|research|read|inspect|examine|verify|review|compare|cross-reference|search|query|access|analy[sz]e|investigat\w*)\b/i.test(s);
 const technical=/\b(?:diagnostic|repair|calibration|germination|soil|moisture|seed|crop|plant|pressure|test plot|medical safety|prosthesis|system test|maintenance|engine|reactor)\b/i.test(s)
  && /\b(?:test|check|inspect|examine|measure|repair|diagnos\w*|calibrat\w*|monitor|verify|plant|fix|analy[sz]e)\b/i.test(s);
 const retail=isReadOnlyGoodsInspection(action);
 const commerce=/\b(?:buy|purchase|sell|pay|price|quote|trade|merchant|vendor|seller|cost|credits|lease|rent)\b/i.test(s)&&
   /\b(?:buy|purchase|sell|pay|price|quote|trade|merchant|vendor|seller|cost|lease|rent|offer)\b/i.test(s);
 const negotiation=/\b(?:negotiate|bargain|propose|counteroffer|contract|treaty|agreement|discuss terms|mediate|parley|persuade)\b/i.test(s);
 const investigation=/\b(?:track|search|follow the trail|investigate|interview|interrogate|question|look for|locate|find|trace)\b/i.test(s);
 const dialogue=/\b(?:ask|tell|speak|talk|discuss|question|inquire|reply|respond|greet)\b/i.test(s);
 const exploration=/\b(?:explore|look|observe|survey|examine|search|scan|investigate)\b/i.test(s);
 const kind:ActionKind=combat?"combat":research?"research":technical?"technical":retail?"merchandise_inspection":
  commerce?"commerce":negotiation?"negotiation":investigation?"investigation":
  permitsLocationChange(action)?"travel":dialogue?"dialogue":exploration?"exploration":"other";
 const rule:Record<ActionKind,string>={
  combat:"Resolve only the declared combat attempt with authoritative SAGA initiative/attack rules.",
  research:"Resolve this information/research operation; a product/package inspection is NOT a valid substitute.",
  technical:"Resolve the stated test/diagnosis/repair, including its genuine measurements or complications; shopping is unrelated.",
  merchandise_inspection:"Resolve physical goods inspection without silently buying, consuming or moving ownership.",
  commerce:"Use validated prices, offers, payment and inventory changes; an offer is not ownership.",
  negotiation:"Allow the other party to respond concretely; no automatic accepted agreement.",
  investigation:"Resolve the searched lead, obstacle, encounter or clue; do not assert guilt without evidence.",
  travel:"Respect the saved location and action's traversable boundary; never teleport or invent arrival.",
  dialogue:"Give the established counterpart a specific, responsive answer or obstruction, not a static loop.",
  exploration:"Reveal only justified observations and grounded risks; do not manufacture secrets.",
  other:"Resolve the declaration as an attempt; the player never narrates GM outcomes.",
 };
 return {version:1,kind,declaration:action,knownTarget:extractsTarget(action),
  movementDeclared:permitsLocationChange(action),
  outcomeAuthority:"server-gm-only",outcomeRule:rule[kind]};
}
export function assertRpgOutcomeFocus(contract:RpgActionContract,narration:string){
 const result=npcGameplayResult(narration);
 if(!result)return;
 const genericGoods=/\b(?:examine the (?:merchandise|goods?|item)|where it is offered|visible condition, seal, label, and expiration markings|seller or display remains in place|inspection is completed without accepting an offer)\b/i.test(result);
 if((contract.kind==="research"||contract.kind==="technical")&&genericGoods)
  throw Error("Unrelated merchandise fallback for "+contract.kind+" declaration; preserve original turn and rewrite the actual requested operation.");
 if(contract.kind==="merchandise_inspection"&&/\b(?:i transfer credits|you pay|you purchase|credits are deducted)\b/i.test(result))
  throw Error("An inspection was described as a transaction; reject unearned material transfer.");
}
