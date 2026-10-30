# Island Sim: notes for working on this repo

- Work on a feature branch and open a PR; the owner merges (never push to main).
- **Every update that ships must add an entry at the top of `src/ui/updates.ts`**
  ("What's new" on the start menu) with the next version number: a minor bump
  (1.3 → 1.4) for new content, a patch bump (1.4 → 1.4.1) for small fixes.
  The menu shows the newest version as the current one.
- Balance check after sim changes: `npm run simulate -- 20 60` (watch for deaths).
- Comment briefly on why things change, and match the surrounding code style.
