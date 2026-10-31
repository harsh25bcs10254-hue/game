# The Shadow Architect

A self-contained 2D browser puzzle adventure about shaping paths with light and shadow. Built with HTML, CSS, JavaScript and Canvas 2D. No external assets, paid APIs, build step or runtime dependencies are required.

## Run the game

**Quickest:** open `index.html` in Chrome or another modern desktop browser.

**Local server:** install Node.js 18 or newer, open a terminal in this folder, then run:

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:4173>.

## Controls

| Action | Input |
|---|---|
| Move left / right | `A` / `D` or `←` / `→` |
| Jump | `Space` or `W` / `↑` |
| Move a lantern | Click and drag its glowing orb |
| Select a rotatable sculpture | Click the sculpture |
| Rotate selected sculpture | `Q` / `E` |
| Show / hide a cryptic field note | `H` |
| Restart the current chamber | `R` |
| Pause / resume | `Esc` or `P` |
| Advance tutorial / chamber | `Enter` |

The controls are also introduced in the in-game Field Notes tutorial and in the footer below the game canvas.

## The three chambers

### 1. The Gallery of First Light
Learn to read a projection. Move the first lantern and watch how the monolith's shadow shifts across the broken gallery. The room's faded relief and field note are clues, not a route marker.

### 2. The Twin-Lantern Vault
Two separate silhouettes must be brought into alignment. Each lantern affects only its own shadow, so changing one source cannot solve both halves of the crossing.

### 3. The Observatory of Silence
Combine position and orientation. The tall idol's narrow silhouette is not wide enough to satisfy the final seal; select it and rotate it, then find the correct position for the high lantern.

## Design principles

- Tutorials teach the rules of light, occlusion, projection and rotation without drawing puzzle solutions.
- There are no dotted solution paths or highlighted target coordinates.
- Players infer the answer from the visible shadow, room architecture, faded murals and optional field notes (`H`).
- A chamber's threshold stays sealed until its shadow arrangement is correct.
- The three chambers grow from one movable light, to two independent lights, to a combined light-position and object-orientation puzzle.

## Progress and accessibility

- Progress is saved locally in the browser using `localStorage` when available.
- `R` returns the player to the chamber checkpoint. Current lantern positions and statue orientation are retained so you can retry the jump without losing a puzzle arrangement.
- The canvas scales responsively to the browser window. A desktop keyboard and mouse are recommended.
- Sound effects are synthesized locally with Web Audio. Use the `SOUND ON/OFF` control in the top bar to mute them.

## Tests

Run the bundled deterministic Canvas sandbox checks with:

```bash
npm test
```

The test harness exercises the tutorial flow, pointer dragging, puzzle-gate conditions, Q/E rotation, chamber completion, the ending screen, Canvas drawing calls, and keyboard-only platform traversal through all three chambers. It uses a mocked DOM/Canvas host and does not require network access.

For a syntax-only check:

```bash
npm run check
```

## Project files

- `index.html` — game page and shell.
- `styles.css` — responsive frame and page styling.
- `game.js` — rendering, physics, input, puzzle logic, sound and progress saving.
- `server.js` — tiny dependency-free local development server.
- `sandbox-test.js` — deterministic sandbox test runner.
# game
