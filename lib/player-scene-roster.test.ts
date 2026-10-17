import { describe, expect, it } from "vitest";
import { recordVisibleSceneNpcs, sceneNpcRoster, sceneNpcSheets, publicPcSheet } from "./player-scene-roster";

describe("room-specific NPC visibility and public player sheets", () => {
  const location="Bonadan — Nuvorren Design House front counter";
  it("only places named, visibly present characters in the Players room",()=>{
    const changed=recordVisibleSceneNpcs({location,contacts:[]},
      "## LOCATION\n"+location+"\n\n## SCENE\nThe clerk Tremel puts his datapad aside and replies that commission appointments require a deposit.\n\n## GAMEPLAY RESULT\nThe clerk offers the intake sheet.",
      "room-t1");
    const present=sceneNpcRoster(changed);
    expect(present.map(x=>x.name)).toEqual(["Tremel"]);
    expect(present[0].role).toBe("clerk");
  });
  it("retains a witnessed, titled captain as one NPC across repeated conversations",()=>{
    const scene="## SCENE\nCaptain Vell stands at the public counter and answers the traveler's inquiry.\n\n## GAMEPLAY RESULT\nCaptain Vell points to the public registry.";
    const first=recordVisibleSceneNpcs({location,sceneNpcs:[{name:"Captain Vell",role:"transit captain",location}]},scene,"titled-1");
    expect(sceneNpcRoster(first).map(n=>n.name)).toEqual(["Captain Vell"]);
    const second=recordVisibleSceneNpcs(first,scene,"titled-2");
    expect(sceneNpcRoster(second).map(n=>n.name)).toEqual(["Captain Vell"]);
    const withoutWitness=recordVisibleSceneNpcs({location,contacts:[{name:"Captain Vell",role:"captain"}]},
      "## SCENE\nA datapad displays a message from Captain Vell, sent months ago. Nobody is present.\n\n## GAMEPLAY RESULT\nYou read the old dispatch.","remote-message");
    expect(sceneNpcRoster(withoutWitness)).toEqual([]);
  });
  it("does not show a contact in the room merely for knowing their name or comlink",()=>{
    const state={location,contacts:[{name:"Jax",role:"captain",channel:"npc:existing"}]};
    expect(sceneNpcRoster(state)).toEqual([]);
    const changed=recordVisibleSceneNpcs(state,
      "## SCENE\nA datapad reminds you about a message received from Jax years ago. No one else is visible.\n\n## GAMEPLAY RESULT\nYou read the note.",
      "room-t2");
    expect(sceneNpcRoster(changed)).toEqual([]);
  });
  it("clears earlier scene participants when changing rooms and new scene has no actor",()=>{
    const older=recordVisibleSceneNpcs({location},
      "## SCENE\nCaptain Jax stands before you.\n\n## GAMEPLAY RESULT\nJax speaks.",
      "room-t3");
    expect(sceneNpcRoster(older).map(x=>x.name)).toContain("Jax");
    const moved=recordVisibleSceneNpcs({...older,location:"Bonadan — public transport terminal"},
      "## SCENE\nAn empty terminal platform lies ahead.\n\n## GAMEPLAY RESULT\nThe terminal is empty.",
      "room-t4");
    expect(sceneNpcRoster(moved)).toEqual([]);
  });
  it("recognizes a named NPC in the latest committed scene of an older save",()=>{
    const scene="## LOCATION\n"+location+"\n\n## SCENE\nThe clerk Tremel speaks across the desk.\n\n## GAMEPLAY RESULT\nThe clerk answers.";
    const snapshot={character:{name:"Dmir"},gameState:{location},messages:[
      {role:"assistant",content:scene,turnId:"legacy-t1",provider:"nvidia"},
    ],comms:[],settings:{}} as any;
    expect(sceneNpcSheets(snapshot).map(n=>n.name)).toEqual(["Tremel"]);
    snapshot.gameState.location="Bonadan — a different storefront";
    expect(sceneNpcSheets(snapshot)).toEqual([]);
  });
  it("filters out living parent apparitions in the current era",()=>{
    const state={location,sceneNpcs:[{name:"Maera Holloràn",role:"parent"}]};
    expect(sceneNpcRoster(state)).toEqual([]);
  });
  it("does not share private bank balances, faction secrets or hidden goals in character sheets",()=>{
    const publicSheet=publicPcSheet({
      name:"D'mir Holloran",species:"Human",level:3,credits:628450006,
      inventory:[{name:"Secret Sith holocron"}],background:"GM secret prison archive",goal:"GM mystery",
      imageHeadshot:"",talents:"Resilience",feats:"Toughness",
    },"self-1",false);
    expect(publicSheet.name).toBe("D'mir Holloran");
    expect(publicSheet.level).toBe(3);
    expect(publicSheet).not.toHaveProperty("credits");
    expect(publicSheet).not.toHaveProperty("inventory");
    expect(publicSheet).not.toHaveProperty("goal");
    expect(publicSheet.background).toBe("");
  });
});
