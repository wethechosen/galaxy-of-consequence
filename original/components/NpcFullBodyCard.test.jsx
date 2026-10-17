import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import NpcFullBodyCard from "./NpcFullBodyCard";

const playableIds = [
  "jena-lorr","orlan-vale","ari-vess","mirren-sol","torin-kade",
  "lenna-fen","tesa-norr","bren-varo","sorin-pell","calen-vardex",
];

describe("individual NPC full-body studies", () => {
  it("renders ten distinct provisional costumes without D'mir or Kelvek", () => {
    expect(new Set(playableIds).size).toBe(10);
    for (const id of playableIds) {
      const rendered = renderToStaticMarkup(<NpcFullBodyCard id={id} name={id} />);
      expect(rendered).toContain("viewBox=\"0 0 220 420\"");
      expect(rendered).toContain("Provisional full-body clothing concept");
      expect(rendered).toContain("COSTUME STUDY");
      expect(rendered).not.toContain("NaN");
    }
    expect(playableIds).not.toContain("kelvek");
    expect(playableIds).not.toContain("dmir-holloran");
  });
});
