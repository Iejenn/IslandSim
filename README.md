# Island Sim

A small 3D life sim: a castaway lives on an island and decides for herself
what to do, based on her needs, personality and memories. Over the days she
sets herself goals, chops wood, builds (a garden, a drying rack, a dock, walls
for her shelter), grows food, gets caught in the rain and slowly makes the
island her home. When she wishes for something, you can make it appear.
What she might wish for is never listed: it depends on how her life goes.

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
  `npm run simulate -- 50 30` (50 islands × 30 days), add `nogifts` to never grant wishes.

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
    gifts.ts       gifts, when each becomes wishable, and granting
    projects.ts    things she builds: goals, wood, progress, the dock surface
    garden.ts      garden beds growing, drying out, ripening, rotting
    weather.ts     rain showers
    memory.ts      what she likes/dislikes and the daily diary recap
    thoughts.ts    what she says
  world/           three.js scene: stage (renderer/camera), terrain, water,
                   sky (lights, day/night), rain, props, buildings, gift models
  character/       loading the model, playing animations, moving the body
  ui/              observer panel, HUD (clock/speed/follow), thought bubble
scripts/
  simulate.ts      headless balance check (npm run simulate)
```

The sim never imports three.js or touches the page. It reports what should
happen (play an animation, a gift arrived, she spoke, she died) through
`hooks` in `sim/state.ts`, and `main.ts` connects those hooks to the 3D
world and the UI. That keeps the game rules testable and lets you change
how things look without touching them.

## Deploying

`.github/workflows/deploy.yml` builds every pull request and deploys `main`
to GitHub Pages at https://iejenn.github.io/IslandSim/.

One-time setup: in the repo on GitHub go to **Settings → Pages** and set
**Source** to **GitHub Actions**.

If the repo is ever renamed, update `base` in `vite.config.ts` to match.
