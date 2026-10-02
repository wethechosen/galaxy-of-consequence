# Private galactic atlas

## Implemented

Import the 13 supplied originals locally:

```powershell
node scripts/import_maps.mjs "C:\Users\Passi\Downloads\Galactic Maps-20260714T144642Z-1-001\Galactic Maps"
```

The importer uses an explicit filename allowlist, preserves image bytes, hashes each
copy, and refuses to overwrite a differing existing import. Re-running with the same
files is safe. Images and the generated checksum manifest remain under the ignored
`data/maps/` directory, not `public/` or Git. No source files are changed or uploaded.
Source attribution embedded in the images is retained. Import does not establish
publication rights; do not bundle these images in a public deployment.

The Atlas tab selects charts, zooms from 100–500% of container width, and supports
native scrolling, touch swiping, and keyboard scrolling. Click a chart to select a
normalized image reference, or save a whole-chart reference with the keyboard.
References become ordinary personal journal notes, with existing event logging and
checkpoint behavior. They do not establish facts, move the player, or advance time.

All image bytes are served through the app's local-request guard using catalog IDs,
never caller-provided file paths. The image optimizer is bypassed to retain the
original chart and keep requests behind that guard. This is local-only software,
not authenticated remote hosting. Keep the server bound to loopback.

## Continuity limitations

- The population chart explicitly dates itself to circa 25 ABY.
- The PNG galaxy overview contains multiple dated annotations, including 40 ABY
  and 137 ABY. It is not a single 150 ABY snapshot.
- Regional borders and labels are reference claims, not current campaign control.
- The Sith Space chart does not establish living Sith, sovereignty, or an encounter.
- The JPG galaxy overview has a different projection. Coordinates do not transfer
  between images. These are not calibrated distance scales.
- Low-resolution source labels remain low resolution when enlarged.
- These flattened images cannot hide individual printed names. The current viewer
  is explicitly an out-of-character library, not a spoiler-filtered navigation HUD.

## Next data layer (not implemented)

Create reviewed location records with stable IDs, names/aliases, source citations,
era validity, and a separate image anchor for each chart. OCR can propose labels;
human/source review must approve spelling, identity, and coordinates. Never let OCR
or an AI silently promote a proposed label to established lore.

Create a separate route graph: reviewed endpoints, route name, governing Saga
travel references, prerequisites, and campaign-era accessibility. Never derive
hyperspace time or safe connectivity from Euclidean pixel distance alone.

Keep immutable geography/source claims separate from timeline-specific ownership,
blockades, discoveries, and hazards. Those overlays require validated events and
player-visibility filtering. Unknown/secret features must not be sent to the client.
The eventual player navigation screen should use this filtered structured layer;
it should not reveal a full source image and attempt to cover its secrets with CSS.

Future GM tools should retrieve reviewed location/route records, not reinterpret
all chart pixels every turn. Choosing a destination is an intention: only validated
travel adjudication may change location, time, fuel, credits, or campaign events.
