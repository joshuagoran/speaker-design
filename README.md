# SpeakNow

Plan DIY speakers, from one box to a room full of stacks.

- **Speaker:** design one cabinet: its drivers, chambers, and crossovers. See its response, maximum output, and 3D view.
- **Stack:** put speakers on top of or beside each other, and set the crossovers between them.
- **Space:** place stacks in a room or outdoors, and see the coverage and the amp power.
- **Cutlist:** get the panels and the sheet layout for a speaker or a stack.

Speaker and Stack each have an optimizer.

All results come from models, not measurements. Use them to compare designs and to find a bad alignment before you cut wood. Measure the prototype before you trust a number.

## Run it

You need Node `^22.18.0 || ^24.11.0 || >=26`.

```sh
pnpm install
pnpm start            # dev server at http://localhost:5173/
pnpm exec vp check    # format, lint, and type check
pnpm test             # tests
```

`package.json` lists the other scripts.

## Build and deploy

`pnpm run build` builds `dist/site/`. The app is one self-contained page: nothing loads from a CDN, so it works offline.

A push to `main` deploys the site to GitHub Pages. `build/serve.sh` builds the page and serves it at `http://127.0.0.1:8901/site/`.

## Saving

On GitHub Pages, people sign in with Google to save speakers, stacks, and spaces in Firestore. The dev server and local builds cannot save. The page says so.

One-time Firebase setup:

1. In the [Firebase console](https://console.firebase.google.com), create a project on the free plan.
2. Add a web app. Copy its config into `src/components/saved-configs/firebaseConfig.ts`. These values are public.
3. Create a Firestore database in production mode.
4. Turn on Google sign-in. Add `<user>.github.io` to the authorized domains.
5. Paste `firestore.rules` into the Firestore rules, and publish them. Each user can read and write only their own designs.
6. In the GitHub repo, set **Settings → Pages → Source** to GitHub Actions.

## Tests

CI runs the unit tests, the phone layout check, and the 3D checks.
