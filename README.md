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

Later on she can tear down her shelter and build a lodge with a bedroom, a
living room and a kitchen, then furnish it (a real bed, a sofa, a wood stove
for cooking when the campfire is out). Chickens and sheep roam the island
from day one, but they're no use to her until she fences off her home and
builds a coop: then she herds them in one by one, collects eggs for omelettes
and shears the sheep for wool (a blanket, a sweater for rainy days). Her
spring sits on a headland on the far side, ringed by berry bushes.

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
  how their lives went (deaths, what got built, harvests, favourite activities).
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
    companion.ts   the stray dog and its trust
    animals.ts     chickens and sheep: laying eggs, growing wool, who to herd next
    memory.ts      what she likes/dislikes and the daily diary recap
    thoughts.ts    what she says
    persist.ts     turning state into saveable JSON and back
  world/           three.js scene: stage (renderer/camera), terrain, water,
                   sky (lights, day/night, lightning), rain, props, forest &
                   boulders, buildings (incl. the lodge, fence and coop),
                   crafted items & furniture, the dog, livestock, wildlife
  character/       loading the model, playing animations, moving the body,
                   tools in her hand
  save.ts          localStorage save/load and the island's layout seed
  ui/              observer panel, HUD (clock/speed/follow), thought bubble
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
