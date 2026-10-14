import { describe, expect, it } from "vitest";
import { getWorldEvent } from "../original/pages/Home";

describe("regional public news", () => {
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
