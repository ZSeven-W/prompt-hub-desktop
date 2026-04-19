# PromptHub Desktop

Local-first prompt library for AI workflows.

PromptHub Desktop is an Electron app for organizing, searching, tagging, versioning, and reusing prompts without sending your library to a third-party service. It stores everything in SQLite on your machine and gives you a lightweight UI for building a serious prompt corpus.

## What it does

- Organize prompts into folders and tags
- Search across title, description, content, and tags
- Track prompt revisions automatically
- Detect and fill `{{variables}}` before copying
- Import and export your prompt library as JSON
- Keep data local with SQLite storage

## Stack

- Electron 29
- Express 4 REST API
- better-sqlite3
- Vanilla JavaScript frontend

## Quick start

```bash
npm install
npm start
```

Run only the API server:

```bash
npm run server
```

The desktop app talks to a local API on port `3355`.

## Data location

PromptHub stores its database at:

```text
~/.prompt-hub/prompthub.db
```

The database is created automatically on first launch.

## Core workflow

1. Create prompts with title, description, content, and folder
2. Add tags for reusable cross-project categorization
3. Use `{{variables}}` in prompt templates
4. Copy fully rendered prompts after filling variables
5. Revisit older prompt versions when iterating on prompts

## API surface

Main endpoints:

- `GET /api/health`
- `GET /api/prompts`
- `POST /api/prompts`
- `PUT /api/prompts/:id`
- `DELETE /api/prompts/:id`
- `GET /api/prompts/:id/versions`
- `POST /api/prompts/:id/copy`
- `GET /api/tags`
- `GET /api/folders`
- `POST /api/import`
- `POST /api/export`

## Project structure

```text
prompt-hub-desktop/
├── main.js
├── server.js
├── database.js
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── SPEC.md
└── CLAUDE.md
```

## Good fit for

- personal prompt libraries
- reusable coding prompts
- research and writing templates
- prompt ops for local AI workflows

## License

MIT
