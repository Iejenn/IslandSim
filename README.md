# Island Sim

A small 3D life sim: a castaway lives on an island, decides for herself what
to do based on her needs and personality, and you can drop gifts from the sky.

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
    gifts.ts       gifts, wishes and granting
    thoughts.ts    what she says
  world/           three.js scene: stage (renderer/camera), terrain, water,
                   sky (lights, day/night), props, gift models
  character/       loading the model, playing animations, moving the body
  ui/              observer panel, HUD (clock/speed/follow), thought bubble
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
