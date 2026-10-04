// Suggestions are possible attempts, never discoveries, rewards or resolved actions.
export function sceneDirections({ state = {}, character = {}, scene = "" } = {}) {
  const combat = state.combat;
  if (combat?.status === "active") {
    if (combat.activeSide !== "player") return ["Review the encounter before declaring your next action.", "Ask the GM about the visible battlefield."];
    const actions = combat.playerActions || {};
    const enemy = (combat.combatants || []).find((npc) => npc.side === "opposition" && Number(npc.hp) > 0);
    const choices = [];
    if (actions.standard && enemy) choices.push(`Attempt an attack against ${enemy.name}.`);
    if (actions.move) choices.push("Reposition toward visible cover.");
    choices.push("Assess the opposition's visible stance.", "End my turn.");
    return choices.slice(0, 4);
  }
  // Do not turn negated scenery into an available interactable.
  const evidence = `${state.location || ""} ${scene.split(/(?<=[.!?])\s+/).filter((line) => !/\b(?:no|not|without|absent)\b/i.test(line)).join(" ")}`;
  const choices = [];
  if (/terminal|console|control panel/i.test(evidence)) choices.push("Read the visible terminal display without changing its settings.");
  if (/junction|intersection|branch|fork/i.test(scene)) choices.push("Compare the visible branches before choosing one.", "Inspect the junction for signs of recent passage.");
  if (/pressure|vibration|pulse|rhythm|hum/i.test(scene)) choices.push("Compare the vibration through the floor and nearby conduits.");
  if (/hatch|door|gate|barrier|threshold/i.test(evidence)) choices.push("Examine the visible entrance before attempting to open it.");
  if (/bend|blind corner|offset passage/i.test(scene)) choices.push("Listen at the blind approach before moving past it.");
  if (/grille|vent|airflow|recycled air/i.test(scene)) choices.push("Check the accessible ventilation fittings from where you stand.");
  if (/bunker|hideout/i.test(evidence)) choices.push("Examine the bunker for signs of disturbance.");
  if (/transit|substructure|service|conduit|corridor/i.test(evidence) && choices.length < 2) choices.push("Study the route's visible layout before choosing a direction.", "Listen for nearby activity before moving farther.");
  if (/market|shop|exchange/i.test(evidence)) choices.push("Ask about the listed goods and their prices.");
  if (/infirmary|medical/i.test(evidence)) choices.push("Ask about available medical treatment.");
  const carried = (state.inventory || []).filter((item) => Number(item.qty) > 0);
  if (Number(state.health) < Number(character.maxHp || character.hitPoints || 0) && carried.some((item) => /medpac/i.test(item.name))) choices.unshift("Attempt first aid with my carried medpac.");
  const trained = Array.isArray(character.trainedSkills) ? character.trainedSkills : [];
  if (trained.some((skill) => /^use the force$/i.test(String(skill)))) choices.push("Attempt to sense my surroundings with Use the Force.");
  if (!choices.length) choices.push("Describe what I examine in the immediate area.", "Listen to the activity around me.");
  choices.push("Review my carried equipment before choosing an approach.");
  return [...new Set(choices)].slice(0, 4);
}

export function genericDirections(options = []) {
  if (!options.length) return true;
  const text = options.map((option) => typeof option === "string" ? option : option.text).join(" ");
  return /immediate surroundings|specific declared action|withdraw or wait|examine the immediate route|continue moving(?: through| along)? the route|stop and listen before moving/i.test(text);
}

export function sceneAtmosphere(location = "") {
  if (/coruscant.*(?:lower|substructure|1313|sublevel)/i.test(location)) return "Far above, Coruscant's traffic is reduced to a distant vibration. Here, recycled air moves through old durasteel infrastructure; the machinery's uneven hum makes the quiet between sounds conspicuous. Your next approach is yours to choose.";
  if (/bunker|hideout/i.test(location)) return "The enclosed space holds the muted sounds of the city beyond it. Worn surfaces and close sightlines make even a small movement noticeable. Nothing here reveals its history merely because you have arrived.";
  if (/market|exchange/i.test(location)) return "Commerce moves around you in prices, requests and competing voices. What you can buy depends on the goods actually available, your funds and local restrictions—not on a promise of success.";
  return "The immediate space remains open to your attention. Take in the visible layout and nearby activity before choosing an approach; concealed details still require investigation.";
}
