import {it,expect} from "vitest";
import {ALL_NPC_TEST_ROSTER} from "./npc-test-roster";
import {NPC_ULTIMATE_ARCS,NPC_ULTIMATE_ARC_VERSION} from "./npc-ultimate-arcs";
import {NPC_HISTORICAL_TIERS} from "./npc-historical-baselines";
it("assigns a distinct endgame objective to all 34 independently played characters",()=>{
  const subjects=ALL_NPC_TEST_ROSTER.filter(n=>n.id!=="kelvek");
  expect(subjects).toHaveLength(34);
  expect(Object.keys(NPC_ULTIMATE_ARCS)).toHaveLength(34);
  for(const npc of subjects){
    expect(typeof NPC_ULTIMATE_ARCS[npc.id]).toBe("string");
    expect(NPC_ULTIMATE_ARCS[npc.id].length).toBeGreaterThan(60);
    expect(NPC_ULTIMATE_ARCS[npc.id]).not.toBe(npc.objective);
  }
  expect(NPC_ULTIMATE_ARC_VERSION).toBe("150aby-longarc-v1");
});
it("keeps historical experience separate from live-earned XP and protects future rank claims",()=>{
  expect(NPC_HISTORICAL_TIERS["darth-korvalis"].level).toBe(12);
  expect(NPC_HISTORICAL_TIERS["nir-varek"].level).toBe(11);
  expect(NPC_HISTORICAL_TIERS["jaed-sultar"].level).toBe(9);
  expect(NPC_HISTORICAL_TIERS["aliya-fel"]).toBeUndefined();
  expect(NPC_HISTORICAL_TIERS["aliyah-fel"].level).toBe(8);
  expect(Object.keys(NPC_HISTORICAL_TIERS)).toHaveLength(17);
});
