import { GALAXY_LOCATIONS } from "./galaxyLocations";

const key = value => String(value || "").trim().toLowerCase();
export function currentTerritory(location) {
  return GALAXY_LOCATIONS.find(place => key(location) === key(place.name) || key(location).startsWith(key(place.name) + " —") || key(location).startsWith(key(place.name) + ","))
    || { name: String(location || "Unestablished location").split(" — ")[0], region: "Unestablished region" };
}

export function territoryReports(place, state, scope = "local") {
  const news = Array.isArray(state?.publicNews) ? state.publicNews : [];
  return news.filter(report => {
    if (!report || !report.headline || !report.facts || report.visibility === "private") return false;
    const location = key(report.location);
    if (scope === "galactic") return ["galactic", "galaxy", "galaxy-wide"].includes(location);
    const local = currentTerritory(report.location);
    if (scope === "regional") return location === key(place.region) || (local.region && local.region !== "Unestablished region" && key(local.region) === key(place.region) && key(local.name) !== key(place.name));
    return key(local.name) === key(place.name);
  }).sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
}

export function getWorldEvent(place, state = {}, feedIndex = 0) {
  const scope = ["local", "regional", "galactic"][feedIndex] || "local";
  const report = territoryReports(place, state, scope)[0];
  const territory = scope === "local" ? place.name : scope === "regional" ? place.region || "Unestablished region" : "Galactic wire";
  return report ? { ...report, status: "SAVED PUBLIC DISPATCH", angle: { holonet: "", coruscant: "", galactic: "" } } : {
    id: `empty:${scope}:${territory}`, location: territory,
    headline: `${String(territory).toUpperCase()} — NO NEW VERIFIED DISPATCH`,
    facts: "No public transmission is recorded for this territory. New committed reports appear here as the campaign advances.",
    status: "AWAITING PUBLIC REPORT", angle: { holonet: "", coruscant: "", galactic: "" },
  };
}

export function buildNewsFeeds(state) {
  const place = currentTerritory(state.location);
  return [
    { id: "local", name: `${place.name} Local Wire`, subtitle: "PLANETARY DISPATCH", accent: "#4fd8e8" },
    { id: "regional", name: `${place.region || "Regional"} Service`, subtitle: "TERRITORIAL WIRE", accent: "#ff7a1a" },
    { id: "galactic", name: "HoloNet Galactic News", subtitle: "GALAXY-WIDE DISPATCH", accent: "#c48cff" },
  ].map((feed, index) => {
    const event = getWorldEvent(place, state, index);
    return { ...feed, ...event, copy: event.facts, publishedAt: event.ts };
  });
}
