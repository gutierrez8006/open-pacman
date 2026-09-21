# AGENTS.md

## Overview
Vanilla JS + HTML + CSS Pac-Man clone. No build system, no `package.json`, no tests, no linter. Run by opening `src/index.html` directly in a browser (maze, game, render, main are loaded as plain `<script>` tags).

## Script-load order is a hard dependency
Files communicate through `window.*` globals, not ES modules. `index.html` loads them in this exact order — each file reads globals defined by the previous one:
1. `js/maze.js` → defines `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`
2. `js/game.js` → defines `createGame`, `update`, `DIRS`
3. `js/render.js` → defines `draw`
4. `js/main.js` → drive loop/keyboard/pause (entrypoint)

New JS files must be added to `index.html` in the correct position, after whatever globals they depend on. Keep exposing cross-file values on `window`.

## Maze data
- `maze.js` defines `MAZE_STR` as 31 strings × 28 chars (readable) parsed into a numeric grid: `#`=1 wall, `.`=2 dot, `-`=3 door, space=0 empty. Edit the layout via `MAZE_STR`, not by hand-editing numbers.
- `MAZE` (in memory) is **pristine and never mutated**. `createGame()` (game.js) copies it per game into `game.grid` (`MAZE.map(row => row.slice())`) so dots can be eaten and games restarted. Never mutate `MAZE`.
- Coords are cell `(x, y)`, origin top-left, `x∈[0,27]`, `y∈[0,30]`. Tunnel wrap row is `TUNNEL_ROW` (14).

## Movement model
- Position is fractional cells/frame. `PACMAN_SPEED = 0.125` (1/8) and `GHOST_SPEED = 0.1` (1/10) are deliberate: `aligned()` snaps the actor to a cell center every 8/10 frames. Keep new speeds as divisors of 1 or alignment/wall-turning logic breaks.
- Ghosts: `kind: 'hunter'` greedily chases pacman (Manhattan distance); `kind: 'random'` wanders. Ghosts pass through the door (`3`); pacman does not — see `isWall`.

## Language and style
- README, UI text ("GANASTE", "PERDISTE", "Reiniciar") and code comments are **Spanish**. Match that in new user-facing text and comments.
- Code style is distinctive: spaces inside parens and brackets (`grid[ y ][ x ]`, `if ( !dir )`), single quotes, semicolons. Mimic it.

## Spec-driven workflow (how this repo operates)
- The project exists to practice spec-driven development (see README). Uses two repo-local skills at `.agents/skills/spec` and `.agents/skills/spec-impl` (locked via `skills-lock.json` from `klerith/fernando-skills`).
- New features go through `/spec` FIRST (writes `specs/NN-slug.md`, creates `specs/.spec-config.yml` if missing, state defaults to `Draft` — never auto-approve). The user sets state to `Approved` after reviewing.
- Only then run `/spec-impl NN-slug`. It requires an "Approved"-meaning status, creates/switches to branch `spec-NN-slug` (unless `AutoCreateBranch: false`), and implements step by step with pauses after each step. Never commit without explicit instruction.
- `specs/` directory does not exist yet and will be created by `/spec`.