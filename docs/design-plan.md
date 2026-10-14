# Design plan — the flooding valley (CLAUDE_FAS.md §10)

## What makes this page about rivers, not about research sites

The page is a survey of one storm: rain read from the dataset falls on the
headwaters, and the reader watches the water arrive at the outlet four days
later — the delay a forecast has to learn — on terrain, gauges and a timeline
drawn the way hydrographers draw them.

## The storm

Not a synthetic pulse. `generate_data.py` picks a real event from basin_01's
`timeseries.csv`: the storm with the largest upstream rainfall that is
upstream-dominated (at least half its rain on the four highest main-stem
reaches) and is followed by ≥130 dry hours, so the outlet's response is not
mixed with the next storm. That rule selects hours 58–198 of the record: rain on
the headwaters at hours 12–40, the headwater gauge peaking at hour ~27, the
outlet flat until ~60 and peaking at ~108. Every number the hero shows —
rain per cross-section per hour, water depth, discharge, velocity — is that
event, exported to `network.ts` as `stormEvent`.

## Terrain derivation

`src/lib/terrain.ts` already derives the valley deterministically from node
positions (bed elevation blended along the reaches, walls rising with distance,
seeded relief suppressed on the floor). Added: a carved channel. Within each
reach's half-width (from `channel_width_m`) the bed is lowered by a bank
height; out to ~3 half-widths the ground stays a near-flat floodplain before
the valley walls rise. Contour isolines stay on the surface, low contrast.
The printed contour field on the paper sections reads the same function.

## Water shader

One plane over the terrain, one `ShaderMaterial`, no textures.

- Per vertex, baked once: terrain height, the thalweg (bed) height of the
  nearest channel point, the two cross-sections either side of it and the
  fraction between, the downstream direction of that reach, and distance from
  the channel centre.
- Per frame, on the CPU: 28 stage values (dataset depth at the current hour,
  vertically exaggerated and labelled so) and 28 velocities → two uniform arrays.
- Vertex shader: water surface = thalweg + interpolated stage. Depth = surface −
  terrain, passed as a varying.
- Fragment: `discard` where depth ≤ 0 — the shoreline is exact, and a higher
  stage floods the floodplain along the real contours. Colour is the existing
  bathymetric ramp w1→w5 by depth, with exponential absorption. Normals come
  from two procedural ripple samples scrolled along the reach direction at
  speeds scaled by the dataset velocity and by distance from mid-channel, blended
  across two phases (the standard flow-map trick) so they never stretch.
  Fresnel mixes in a sky tint at grazing angles. Foam: a soft fringe where
  depth is small, and streaks where velocity is high.
- Low tier: no flow map, one ripple sample, no foam.

## Rain

Instanced points over the catchment, each drop belonging to the nearest
cross-section and drawn only while that cross-section's precipitation (same
series the model trained on) is non-zero, with density proportional to it.
Drops are thin vertical streaks in foam colour, not glowing particles. Count:
1.5k / 4k / 8k by tier.

## Gauges

Four stilling-well towers — a concrete well, a small hut, a banded staff plate
in the water — at the gauged cross-sections, each with a live readout styled as a
gauge board (stage in metres, discharge). The other 24 cross-sections are drawn
as survey section lines across the channel with no number. Four towers with
numbers against twenty-four bare lines is the problem statement.

## The timeline

Across the bottom of the hero, drawn as a hydrologist plots an event: rainfall
bars hanging from the top (a hyetograph), the four gauges' stage traces below,
hours along the axis. The storm's rain peak and the outlet's stage peak are
marked, with a dimension line between them reading the lag in hours. A
vertical "now" line is the thumb. Native range input underneath for keyboard,
drag and tap; a live region announces hour, rain upstream and outlet stage.
Auto-plays once (~14 s), then stops and hands over.

## The morph (Act 3)

SVG plan view of the same basin, driven by one progress value. 0: banks drawn as
a filled channel of true relative width over the contour field, towers at the
gauges, section lines across. Then banks fade, the channel narrows to its
centreline, section lines shrink to points — the nodes — towers become filled
nodes, reaches become arrowed edges, and finally the 2–3-hop message edges
appear. Plays once on scroll into view; a replay button; reduced motion shows the
before and after side by side.

## Checked against the banned list

| Risk | What generic would look like | What I did instead |
|---|---|---|
| Rain | floating glowing particles | data-driven streaks, only where and when the dataset rains |
| Timeline | a generic progress slider | a hyetograph and stage traces with the lag dimensioned |
| Gauge readouts | floating glass labels | gauge boards: square, hairline-bordered, numerals in Plex Mono |
| Glossary tooltips | frosted cards with soft shadow | a survey-label: paper-inset ground, hairline rule, square corners |
| Morph | particles reassembling | banks fade, channel collapses to centreline, towers become nodes |
| Bloom | glow on everything | none on the water; foam is the only white |

## Content system

`src/data/glossary.ts` defines each term once. Copy marks terms as
`[[term]]`; a renderer turns them into keyboard-focusable dotted-underline
buttons with a one-sentence tooltip. `src/data/claims.ts` holds every technical
claim as `{ plain, technical, status, terms }`; status must equal the weakest
status of the metrics the claim cites, and a test enforces it. A `Claim`
component renders the plain line above, in the display face, and the
technical line beneath, in the data face, with its status rule.

## Page structure

Act 1 hero → Act 2 Problem (why it is hard) → Act 3 Approach with the morph,
then Attention → Dataset → Act 4 Verdict, Findings, Results → Rigour, footer.
