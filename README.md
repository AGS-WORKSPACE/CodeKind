# codekind

Programming tutoring marketplace frontend built with React, TypeScript, and Vite.

## Local setup

1. Install packages: `npm install`
2. Optionally copy `.env.example` to `.env` and set the future API URL.
3. Start the frontend: `npm run dev`

The frontend runs at `http://localhost:5173`.

Validate it with `npm run typecheck` and `npm run build`.

Authentication and data services are represented by frontend integration contracts in `src/services`. Connect them to a future backend by setting `VITE_API_URL`.
