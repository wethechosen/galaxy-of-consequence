// Suggestions are possible attempts, never discoveries, rewards or resolved actions.
export function sceneDirections({ state = {}, character = {}, scene = "", action = "", result = "" } = {}) {
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
  const context = `${evidence} ${action} ${result}`;
  // The immediate social scene wins over an old Force-route summary.
  if (/market|shop|bazaar|vendor|store/i.test(String(state.location || "")) && /vendor|merchant|clothing|robe|tunic|suit|buy|purchase|price|pay|rest|shelter|lodging|room/i.test(`${action} ${result}`)) {
    const quoted = (state.tradeOffers || []).filter(offer => offer.status === "open" && offer.location === state.location);
    return [...new Set([
      ...(/guesthouse|lodging|rest|shelter|room/i.test(`${action} ${result}`) ? ["Ask the guesthouse desk about paid lodging and its terms."] : []),
      ...(quoted.length ? [`Consider ${quoted[0].items.map(item => item.name).join(" and ")} at the quoted price.`] : ["Ask the merchant to show suitable clothing and quote its price."]),
      "Inspect the offered clothing before deciding whether to buy.",
      "Ask another stall about a thick black robe.",
      "Ask about local food and shelter.",
    ])].slice(0, 4);
  }
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
  const trainedInForce = trained.some((skill) => /^use the force$/i.test(String(skill)));
  const forcePressure = /\b(?:dark[ -]?side|force|sith|vergence|pressure|pull|presence|jedi temple)\b/i.test(context);
  const failedAttempt = /\b(?:failure|failed|refused|cannot|could not|does not open|remains locked)\b/i.test(result);
  if (forcePressure) {
    const moralChoices = [
      "[Restraint] Study the pull without feeding it, comparing it to the physical route.",
      "[Dark-side temptation] Let anger sharpen the attempt, accepting that the GM may impose a moral cost.",
      trainedInForce
        ? "[Force] Reach out with Use the Force and test the presence directly."
        : "[Pragmatic] Map the sensation against airflow, vibration, and the structure around me.",
    ];
    return [
      ...(failedAttempt ? ["Change my method and work from the new obstacle instead of repeating the same attempt."] : []),
      ...moralChoices,
      ...choices,
    ].filter((choice, index, all) => all.indexOf(choice) === index).slice(0, 4);
  } else if (trainedInForce) choices.push("Attempt to sense my surroundings with Use the Force.");
  if (failedAttempt) {
    choices.unshift("Change my method and work from the new obstacle instead of repeating the same attempt.");
  }
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
