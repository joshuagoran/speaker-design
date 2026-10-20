# SpeakNow

SpeakNow is a planner for DIY speakers and deploying them in physical space. Pages:

- **Speaker:** design one cabinet. Set its drivers, chambers, and crossovers. The page shows the response, the maximum output, and a 3D view.
- **Stack:** put speakers on top of each other or side by side. Set the crossovers between them.
- **Space:** put stacks in a room or outdoors. The page shows the coverage and the amp power.
- **Cutlist:** the page lists the panels and the sheet layout for a speaker or a stack.

The Speaker and Stack pages each have an "Optimizer", intended to adjust a given design to meet the user's chosen goals.

To date, all results are based on textbook models, not yet validated with live measurements.

## Run it

Use Node `^22.18.0 || ^24.11.0 || >=26`. `pnpm start` installs the packages, then starts the dev server. It needs the [Vite+](https://viteplus.dev) CLI (`vp`). If you do not have `vp`, run `pnpm install` one time first.

```sh
pnpm start            # dev server at http://localhost:5173/
pnpm exec vp check    # format, lint, and type check
pnpm test             # tests
```

`package.json` lists the other scripts.

## Build and deploy

`pnpm run build` builds `dist/site/`. The app is one self-contained page. It loads nothing from a CDN, so it works offline.

A push to `main` deploys the site to GitHub Pages. `build/serve.sh` builds the page and serves it at `http://127.0.0.1:8901/site/`.

## Saving

On GitHub Pages, users sign in with Google. Then they can save speakers, stacks, and spaces in Firestore. The dev server and local builds cannot save. The page tells the user.

On the Stack page, "Edit Speaker" opens a box's speaker on the Speaker page. The user's own design there stays as it was. "Save & return to Stack" saves the speaker and gives it to every box of the Stack that uses it. Signed out, only the Stack changes.

## Sharing

The Speaker, Stack, and Space pages have a Share button. It copies a link to the open design. The link holds the whole design, so it needs no account and no server. Whoever opens it sees the design in a shared view. Their own work stays as it was. Signed-in users can save a copy of a shared design as new items in their libraries.

## Tests

CI runs the unit tests, the phone layout check, the save row check, the Stack edit check, and the 3D checks.
