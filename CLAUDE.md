# CLAUDE.md — PromptHub-Local

## Project Conventions

### Commit Format (Conventional Commits)
- `feat: ...` — new feature
- `fix: ...` — bug fix
- `docs: ...` — documentation
- `refactor: ...` — code restructure
- `chore: ...` — tooling, deps

## Tech Stack
- Electron 29 + Express 4 + better-sqlite3 + marked
- Vanilla JS frontend (no framework)
- Dark theme (CSS variables)

## Commands
```bash
npm install
npm start      # Launch Electron app
npm run server # Run API server only
```

## Key Files
- `main.js` — Electron app entry, spawns server + creates BrowserWindow
- `server.js` — Express REST API (port 3355)
- `database.js` — SQLite singleton with schema init + seed data
- `public/app.js` — Frontend SPA logic

## Database Location
`~/.prompt-hub/prompthub.db` (auto-created on first run)

## Development Notes
- Frontend loads from `public/` and calls `localhost:3355`
- Use `better-sqlite3` (synchronous, no ORM)
- Always test with `npm run server` first, then `npm start`
