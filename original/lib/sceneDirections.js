// Suggestions are possible attempts, never discoveries, rewards or resolved actions.
export function sceneDirections({ state = {}, character = {}, scene = "", action = "", result = "" } = {}) {
  const combat = state.combat;
  if (combat?.status === "active") {
    if (combat.activeSide !== "player") return ["Review the encounter before declaring your next action.", "Ask the GM about the visible battlefield."];
    const actions = combat.playerActions || {};
    const player = (combat.combatants || []).find((combatant) => combatant.side === "player");
    if (player && (Number(player.hp) <= 0 || Number(player.conditionTrack) >= 5)) return ["Ask the GM about the encounter while I am unable to act."];
    const enemies = (combat.combatants || []).filter((npc) => npc.side === "opposition" && Number(npc.hp) > 0 && Number(npc.conditionTrack || 0) < 5 && !(npc.cover === "total" && (!npc.coverAgainst?.length || npc.coverAgainst.includes(player?.id))));
    const enemy = enemies[0];
    const availableSwift = [actions.swift, actions.move, actions.standard].reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
    const canMove = Number(actions.move) > 0 || Number(actions.standard) > 0;
    const choices = [];
    if (actions.standard && enemy && !player?.defenseBonus) choices.push(`Attempt an attack against ${enemy.name}${enemies.length > 1 ? " or another visible opponent" : ""}.`);
    if (canMove) choices.push("Reposition toward visible cover or a defensible angle.");
    if (availableSwift && !player?.persistentCondition && Number(player?.conditionTrack ?? character?.conditionTrack ?? state.conditionTrack ?? 0) > 0) choices.push("Begin recovery on the Condition Track with consecutive swift actions.");
    if (availableSwift && !player?.secondWindUsedInEncounter && player?.secondWindLastDay !== (combat.resourceDay || "campaign-day-1") && Number(state.health ?? player?.hp) > 0 && Number(state.health ?? player?.hp) <= Math.floor(Number(player?.maxHp || character?.maxHitPoints || character?.maxHp || 0) / 2)) choices.push("Catch a second wind if the encounter rules and daily use permit it.");
    if (actions.standard) choices.push("Take total defense and give up attacks until my next turn.");
    if (availableSwift >= 2 && enemy) choices.push(`Aim at ${enemy.name} for a later ranged attack.`);
    if (canMove) choices.push("Attempt to withdraw toward a visible escape route.");
    choices.push("Assess the opposition's visible stance.");
    return [...choices.slice(0, 3), "End my turn."];
  }
  // Do not turn negated scenery into an available interactable.
  const visibleScene = `${scene} ${result}`.split(/(?<=[.!?])\s+/).filter((line) => !/\b(?:no|not|without|absent)\b/i.test(line)).join(" ");
  const evidence = `${state.location || ""} ${visibleScene}`;
  const context = `${evidence} ${action} ${result}`;
  const currentResidence = (state.properties || []).find(holding => holding.location === state.location && /lease|home|residence|apartment/i.test(holding.type || holding.name || ""));
  // The player's current intent wins over incidental lodging words in an old
  // scene. Owning accommodation is not a reason to keep shopping for it.
  const forceIntent = /\bmeditat\w*|\b(?:focus|reach out|draw on|use)\b.*\b(?:force|anger|dark[ -]?side|sensation)\b/i.test(action);
  if (forceIntent) return [
    "Describe the sensation I am trying to understand without assuming its source.",
    "Choose whether to approach that sensation calmly or draw on the anger I have declared.",
    "Stop the attempt and examine the visible surroundings instead.",
    "Review which Force techniques my recorded build actually permits.",
  ];
  if (currentResidence) return [
    "Inspect my recorded residence and check its entrances.",
    "Rest here for eight uninterrupted hours if the scene is safe.",
    "Review my possessions and the facilities actually installed here.",
    "Leave my residence and choose where to go next.",
  ];
  // A broad market location does not establish a clothing seller or a guesthouse.
  // Only the visible scene establishes whom or what the player can approach.
  const lodging = /\b(?:guesthouse|lodging|shelter|housing|accommodation|inn|hotel|rent|rental|lease|landlord)\b/i;
  const lodgingContext = lodging.test(`${action} ${result}`) || lodging.test(evidence);
  if (lodgingContext) {
    const lodgingContact = lodging.test(evidence) && /\b(?:clerk|desk|receptionist|innkeeper|proprietor|landlord|broker|host)\b/i.test(visibleScene);
    return [
      lodgingContact ? "Ask about the full monthly rate, deposit, and lodging terms." : "Look for posted lodging rates, rental notices, or contact details.",
      lodgingContact ? "Ask whether I may inspect the accommodation before deciding." : "Check publicly available information about the accommodation.",
      "Review my budget before making a lodging offer.",
      "Look for other lodging options nearby.",
    ];
  }
  if (/\b(?:vendor|merchant|shopkeeper|seller)\b/i.test(visibleScene)) {
    const clothing = /\b(?:clothing|robe|tunic|suit|garment)\b/i.test(visibleScene);
    return [
      clothing ? "Ask the seller about the displayed clothing and its prices." : "Ask the seller what goods are available and what they cost.",
      "Ask to inspect an offered item before deciding whether to buy.",
      "Compare the quoted cost with my available credits.",
      "Ask the seller about payment and collection terms.",
    ];
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
  if (/market|shop|exchange/i.test(evidence)) choices.push("Look for public stall signs and price lists before choosing where to approach.");
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
      "[Dark-side temptation] Describe how I choose to use my anger; resolve only that declared intent.",
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
  const texts = options.map((option) => typeof option === "string" ? option : option?.text).filter((text) => typeof text === "string" && text.trim());
  return !texts.length || texts.every((text) => /immediate surroundings|specific declared action|withdraw or wait|examine the immediate route|continue moving(?: through| along)? the route|stop and listen before moving/i.test(text));
}

// Authored options have already passed the GM pipeline's validation. Keep their
// scene-specific detail; only missing/generic menus or active combat need a fallback.
export function currentPlayerOptions({ options = [], ...context } = {}) {
  if (context.state?.combat?.status !== "active" && !genericDirections(options)) return options;
  return sceneDirections(context).map((text, index) => ({ label: String.fromCharCode(65 + index), text }));
}

export function sceneAtmosphere(location = "") {
  if (/coruscant.*(?:lower|substructure|1313|sublevel)/i.test(location)) return "Far above, Coruscant's traffic is reduced to a distant vibration. Here, recycled air moves through old durasteel infrastructure; the machinery's uneven hum makes the quiet between sounds conspicuous. Your next approach is yours to choose.";
  if (/bunker|hideout/i.test(location)) return "The enclosed space holds the muted sounds of the city beyond it. Worn surfaces and close sightlines make even a small movement noticeable. Nothing here reveals its history merely because you have arrived.";
  if (/market|exchange/i.test(location)) return "Commerce moves around you in prices, requests and competing voices. What you can buy depends on the goods actually available, your funds and local restrictions—not on a promise of success.";
  return "The immediate space remains open to your attention. Take in the visible layout and nearby activity before choosing an approach; concealed details still require investigation.";
}
