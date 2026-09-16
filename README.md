# pairlore

Programming tutoring marketplace frontend built with React, TypeScript, and Vite.

## Local setup

1. Install packages: `npm install`
2. Optionally copy `.env.example` to `.env` and set the future API URL.
3. Start the frontend: `npm run dev`

The frontend runs at `http://localhost:5173`.

Validate it with `npm run typecheck` and `npm run build`.

Authentication and data services are represented by frontend integration contracts in `src/services`. Connect them to a future backend by setting `VITE_API_URL`.

## Payments

Sessions are priced per hour and billed per minute, paid from multi-currency wallets, and held for
24 hours so learners can appeal before a tutor is paid. See
[docs/PAYMENTS_LEDGER_PLAN.md](docs/PAYMENTS_LEDGER_PLAN.md) for the model and
[docs/PAYMENTS_BACKEND_CONTRACT.md](docs/PAYMENTS_BACKEND_CONTRACT.md) for the endpoints.

## Deploying the frontend

Netlify builds it from `netlify.toml`: `npm run build`, publishing `dist`.

Two redirects matter. The first sends `/api/*` to the backend, which keeps the API on the same
origin as the app so the session cookie is first-party and no CORS is involved — edit the target in
`netlify.toml` to your backend, as Netlify cannot read an environment variable there. The second
serves `index.html` for every other path, without which a refresh on a deep link like
`/lesson/123/lobby` returns 404.

Leave `VITE_API_URL` unset so the app calls `/api/v1` on its own origin. With no backend reachable
the site still runs on its offline demo data, so a preview deploy is useful on its own.

Camera, microphone and screen sharing need HTTPS, which Netlify provides. Note that Netlify's proxy
does not carry WebSockets: when realtime moves to the server, it connects to the backend host
directly rather than through `/api`.
