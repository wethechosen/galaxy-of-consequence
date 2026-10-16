import { describe, expect, it } from "vitest";
import { getWorldEvent, buildNewsFeeds } from "../original/lib/regionalNews";

describe("regional public news", () => {
  it("keeps local, regional, and galactic reports distinct and refreshes from new saved reports", () => {
    const state = {location:"Taris — Market District",publicNews:[
      {location:"Taris",headline:"Port notice",facts:"Local dock notice",ts:1},
      {location:"Outer Rim",headline:"Regional advisory",facts:"Regional report",ts:2},
      {location:"Galactic",headline:"Galactic bulletin",facts:"Public galactic statement",ts:3},
      {location:"Coruscant",headline:"Wrong planet",facts:"A local Core report",ts:4},
    ]};
    expect(buildNewsFeeds(state).map(feed => feed.headline)).toEqual(["Port notice","Regional advisory","Galactic bulletin"]);
    expect(buildNewsFeeds({...state,publicNews:[...state.publicNews,{location:"Taris",headline:"Updated notice",facts:"A later notice",ts:5} ]})[0].headline).toBe("Updated notice");
  });
  it("never substitutes unrelated planetary news for Taris", () => {
    const event = getWorldEvent({name:"Taris",region:"Outer Rim"}, {}, 0);
    expect(event.location).toBe("Taris");
    expect(event.headline).toContain("NO NEW VERIFIED");
    expect(event.status).not.toContain("LIVE");
  });
  it("selects distinct dispatches for distinct desks", () => {
    const place = {name:"Coruscant"};
    expect(getWorldEvent(place, {}, 0).id).not.toBe(getWorldEvent(place, {}, 1).id);
  });
  it("prioritizes saved local reports and excludes unrelated reports", () => {
    const news = {publicNews:[{location:"Coruscant",headline:"Core report",facts:"Core"},{location:"Taris — port",headline:"Port closure",facts:"Dock six closed",source:"Port authority"}]};
    const event = getWorldEvent({name:"Taris"}, news);
    expect(event.headline).toBe("Port closure");
    expect(event.status).toBe("SAVED PUBLIC DISPATCH");
  });
});
