# Island Sim

A small 3D life sim: a castaway lives on an island and decides for herself
what to do, based on her needs, personality and memories. You just watch.

She gathers branches and vines in the forest and stones in the rocky area,
crafts tools at the campfire (a stone axe to fell trees, a pick to mine
boulders, a fishing rod, a hammock, a drum…), and builds bigger things on
site (a garden, a drying rack, a dock, stone walls, a hearth, a lookout, a
canoe). Felled trees leave stumps until she replants them, and without wood
the fire dies and she can't cook her catch. As her crafting improves she makes
furniture (a chair by the fire, a table, a bed frame, a shelf for her shells, a
rocking chair on the lookout) and the camp starts to feel like home.

Once her tools pile up she may build a tool shed: they hang on its back wall
from then on, and there's room to stockpile half as much again. Later on she
can tear down her shelter and build a lodge with a bedroom, a
living room and a kitchen, then furnish it (a real bed, a sofa, a wood stove
for cooking when the campfire is out). Chickens and sheep roam the island
from day one, but they're no use to her until she fences off her home and
builds a coop: then she herds them in one by one, collects eggs for omelettes
and shears the sheep for wool (a blanket, a sweater for rainy days). Her
pond sits at the foot of a hill on a headland on the far side, fed by a
waterfall from a spring on the hilltop, with berry bushes around it.

Every castaway is different. Besides her two traits she has her own taste
(cosy comforts, practical things, animals, gardening, the sea, making things,
adventure) and one dream she's set on. Taste only tilts the odds: an animal
lover will probably fence in the chickens early, but may still build a lodge
later. There's usually more than one way to get what she needs: fishing with
a rod or wading in with a spear, a fish trap, a rain barrel instead of the
walk to the pond, a treehouse, rabbits to hunt with a spear or catch in
snares at the warren deep in the forest, and for a skilled builder a houseboat
moored at the dock. Even the colours differ per island (the tarp
on her shelter, her bedding, the hammock, roofs, the wood). The diary hints
at who she is, so you find out by watching.

The island has seasons, 12 days each, starting at a random one. Spring
makes everything grow and breed, summer brings hot days and good fishing,
autumn turns the forest gold with mushrooms under the trees and more storms,
and winter is cold: little grows, the fire burns faster, and she's glad of a
warm bed, a blanket, a sweater and a big woodpile. Islands differ in more
small ways too: how rainy they are, how many chickens and sheep live there,
whether a dog ever turns up, what washed ashore with her, her favourite dish
and a quirk or two (an early riser, a night owl, a collector, seasick…). And
she's only human: a goal that never gets started may be dropped for a while.

Every island also has its own handful of events on random days: a shipwreck
to salvage, a turtle nest to guard until the hatchlings run for the sea, a
hurt seagull to nurse (it may stay), a drought, a landslide in the rocks, a
treasure map in a bottle, a sprained ankle. There's clay at the pond's edge:
with a kiln she fires pots (food keeps longer), a water jug, roof tiles that
storms can't tear off, and a bread oven for pies. And each island allows only
a couple of rare projects: a beehive, a sundial, a shell mosaic or a
bathhouse by the pond.

The island also changes simply because she lives there: her feet wear paths
into the grass where she walks most (they grow over again if she stops),
buildings weather (wood greys, stone gathers moss, the tarp fades; a repair
freshens them up), and wildflowers spread around her camp a little more each
spring. She walks around things now (the fire, trees, walls, the fence via
its gates) instead of through them. Sound is generated in the browser (waves,
wind, rain, the fire, birds, crickets, footsteps, chopping, her drum); turn it
on with the Sound button.

Nature carries on around her: the forest seeds itself and creeps towards
the camp wherever she doesn't chop, chicks hatch and lambs are born in spring,
and songbirds move in as the island stays green. Some mornings are misty, a
rainbow can follow a shower, fireflies come out on summer nights and leaves
drift down in autumn. Besides the work, she has little joys: stacking stones
on the beach, sandcastles, lying in the grass watching clouds, picking a
bouquet for her table, whittling small wooden animals, and hanging lanterns
along her most-worn paths. Tap anything on the island (a building, a tree, an
animal, something she made) to see a little card with its story.

A stray dog may wash ashore and, if she earns its trust, follows her
everywhere. Storms strip the berry bushes and can damage her buildings until
she repairs them; on hot days she cools off in the sea. Crabs, gulls and
jumping fish keep her company too. What she'll want to make next is never
listed: it depends on how her life goes.

Progress is saved in the browser (localStorage), so a refresh continues the
same life. "Start over on a new island" at the bottom of the Diary resets it.

Built with [Vite](https://vite.dev), TypeScript and [three.js](https://threejs.org).

## Run locally

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173/IslandSim/).

Other scripts:

- `npm run build` type-checks and builds the site into `dist/`
- `npm run preview` serves the built `dist/` folder locally
- `npm run simulate` runs the sim without graphics for many islands and prints
  how their lives went (deaths, what got built, harvests, favourite activities)
  and how different the islands turned out from each other.
  Use it after changing any numbers to check the balance:
  `npm run simulate -- 50 30` (50 islands × 30 days).

## Project layout

```
public/models/Casual_Female.gltf   her model + all animation clips
src/
  main.ts          wires everything together and runs the game loop
  config/
    animations.ts  sim animation names → clip names in the model
  sim/             the simulation: plain TypeScript, no three.js or DOM
    state.ts       the single state object (S) and the hooks the sim calls out through
    island.ts      island shape, height function and fixed spots (fire, spring, …)
    needs.ts       needs decay, health, new day, death
    decide.ts      utility AI that picks her next task
    tasks.ts       what each task consists of (walk, sit, gather …)
    runner.ts      plays out the current task step by step
    skills.ts      XP and level-ups
    plans.ts       everything she can craft or build: costs, when she wants it, progress
    resources.ts   forest regrowth, fallen branches, loose stones, fish going off
    garden.ts      garden beds growing, drying out, ripening, rotting
    weather.ts     rain showers, storms (with damage) and hot days
    taste.ts       her leanings and dream: what kind of life she tends towards
    seasons.ts     the four seasons and what each changes
    events.ts      the island's own events (shipwreck, turtles, drought…)
    pathing.ts     walking around obstacles (A* when the straight line is blocked)
    paths.ts       trodden paths: where her feet wear the grass
    companion.ts   the stray dog and its trust
    animals.ts     chickens and sheep: laying eggs, growing wool, who to herd next
    memory.ts      what she likes/dislikes and the daily diary recap
    thoughts.ts    what she says
    persist.ts     turning state into saveable JSON and back
  world/           three.js scene: stage (renderer/camera), terrain, water,
                   sky (lights, day/night, lightning), rain, props, forest &
                   boulders, buildings (incl. the lodge, fence and coop),
                   crafted items & furniture, the dog, livestock, rabbits,
                   wildlife, seasonal colours, event objects, trodden
                   paths, wildflowers, atmosphere (mist, rainbow, fireflies,
                   leaves, songbirds), traces of her hobbies, tap-to-look
  audio/           sound effects and ambience, generated with the Web Audio API
  character/       loading the model, playing animations, moving the body,
                   tools in her hand
  save.ts          localStorage save/load and the island's layout seed
  ui/              observer panel, HUD (clock/speed/follow/sound), thought bubble,
                   the tap-to-look info card
scripts/
  simulate.ts      headless balance check (npm run simulate)
```

The sim never imports three.js or touches the page. It reports what should
happen (play an animation, she spoke, she died) through
`hooks` in `sim/state.ts`, and `main.ts` connects those hooks to the 3D
world and the UI. That keeps the game rules testable and lets you change
how things look without touching them.

## Testing ideas quickly

Under `npm run dev` (never in the published build) the browser console has:

- `__S` — the whole sim state, e.g. `__S.needs.food = 5`, `__S.projects.dock.done = true`
- `__give('axe')` — give her a crafted item
- `__startTask('chop')` — make her start a task now

## Deploying

`.github/workflows/deploy.yml` builds every pull request and deploys `main`
to GitHub Pages at https://iejenn.github.io/IslandSim/.

One-time setup: in the repo on GitHub go to **Settings → Pages** and set
**Source** to **GitHub Actions**.

If the repo is ever renamed, update `base` in `vite.config.ts` to match.
