# Repository Guidelines

## Project Structure

- `src/` holds the SolidJS app, with `components/`, `routes/`, and `lib/` (db, repositories, services, hooks).
- `public/` contains static assets; `dist/` is build output.
- Root config includes `vite.config.ts`, `tsconfig*.json`, `biome.json`, and `prettier.config.cjs`.

## Architecture Overview

Lifetrack follows a strict layering rule: UI → Hooks → Services → Repositories → Database. Higher layers call lower ones only. Keep parsing/business logic in services, data access in repositories, and UI logic in components.

## Build, Test, and Development Commands

- `npm run dev`: start Vite dev server.
- `npm run build`: type-check and build production assets to `dist/`.
- `npm run preview`: serve the production build locally.
- `npm run lint`: run Biome lints.
- `npm run format`: run Biome and Prettier formatting.
- `npm run format:check`: verify formatting in CI.
- Testing is not wired yet; if you add tests, introduce a `test` script (Vitest is the intended runner).

## Coding Style & Naming Conventions

- TypeScript strict mode; SolidJS reactivity rules apply (do not destructure props, call signals as functions).
- Follow the formatter output (Biome + Prettier with Tailwind plugin) rather than hand-formatting.
- Naming: `PascalCase` components, `useX` hooks, `*Service` services, `*Repository` repositories, `SCREAMING_SNAKE` constants.

## Testing Guidelines

- Use Vitest and `@solidjs/testing-library` when adding tests.
- Prefer `*.test.ts`/`*.test.tsx` alongside source or under `src/__tests__/` if needed.

## Commit & Pull Request Guidelines

- No commit history yet; use clear, imperative subjects (Conventional Commits like `feat:`, `fix:` are welcome).
- PRs should include a concise summary, linked issues, and screenshots or screen recordings for UI changes.

## Security & Configuration

- CouchDB sync is configured by end users in the in-app Settings page; do not add repo-level secrets for it.
- Do not commit secrets or local databases.
