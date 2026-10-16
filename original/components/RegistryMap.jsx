import { GALAXY_LOCATIONS } from "@/original/lib/galaxyLocations";

export function RegistryMap({ currentLocation = "", onSelect }) {
  return <section className="mt-6" aria-label="Interactive system registry">
    <h2 className="gc-display text-xl text-[#f2f0ea]">SYSTEM DIRECTORY</h2>
    <p className="text-xs text-[#8b93a3] mt-2">Schematic index, not physical coordinates or a hyperspace route. Select a world to inspect its history, surface conditions, and passage options.</p>
    <svg viewBox={`0 0 1100 ${Math.ceil(GALAXY_LOCATIONS.length / 5) * 110 + 20}`} className="w-full mt-4 rounded-xl border border-white/10 bg-[#0b0d18]" role="group" aria-label="150 ABY planetary directory">
      {GALAXY_LOCATIONS.map((place, index) => {
        const x = 25 + index % 5 * 220, y = 25 + Math.floor(index / 5) * 110;
        const here = currentLocation.toLowerCase().startsWith(place.name.toLowerCase() + " —");
        const destroyed = place.worldStatus.condition.startsWith("Destroyed");
        return <g key={place.id} role="button" tabIndex={0} aria-label={`Inspect ${place.name}: ${place.worldStatus.condition}`} onClick={() => onSelect(place)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(place); } }} style={{ cursor: "pointer" }}>
          <rect x={x} y={y} width="200" height="88" rx="8" fill={here ? "#123039" : "#141521"} stroke={here ? "#22e5c5" : "#343345"}/>
          <circle cx={x + 17} cy={y + 22} r="5" fill={destroyed ? "#ed4968" : "#22d3ee"}/>
          <text x={x + 31} y={y + 27} fill="#f2f0ea" fontSize="15">{place.name}</text>
          <text x={x + 12} y={y + 48} fill="#a9adb8" fontSize="11">{place.region}</text>
          <text x={x + 12} y={y + 68} fill={destroyed ? "#ed4968" : "#22e5c5"} fontSize="10">{here ? "CURRENT POSITION" : place.worldStatus.condition}</text>
        </g>;
      })}
    </svg>
  </section>;
}
