# PromptHub-Local

Local AI prompt library manager — organize, tag, search, and version your prompts.

## Overview
Standalone Electron desktop app for managing AI prompts locally. Built with Electron + Express + SQLite + vanilla JS.

## Architecture
- **Runtime**: Electron + Express + SQLite + vanilla JS
- **Port**: 3355
- **Database**: `~/.prompt-hub/prompthub.db` (SQLite with WAL mode)
- **Frontend**: Vanilla JS/HTML/CSS, dark mode default

## Features

### Prompt Management
- CRUD operations for prompts (title, description, content)
- Folders for organizing prompts
- Tags (many-to-many) for cross-cutting categorization
- Full-text search across title, description, content, tags
- Auto-seeded with 5 starter templates on first run

### Variable System
- Detect `{{variable}}` placeholders in prompt content
- Fill variables before copying to clipboard
- Live preview of substituted content

### Version History
- Auto-save version when prompt content changes
- Browse and compare past versions

### Import / Export
- Export all prompts as JSON
- Import prompts from JSON file

## Database Schema
```sql
folders: id, name, created_at
prompts: id, title, description, content, folder, created_at, updated_at
tags: id, name
prompt_tags: prompt_id, tag_id
prompt_versions: id, prompt_id, content, created_at
```

## REST API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/prompts | List (supports ?search=, ?folder=, ?tag=) |
| POST | /api/prompts | Create prompt |
| GET | /api/prompts/:id | Get prompt |
| PUT | /api/prompts/:id | Update (auto-saves version) |
| DELETE | /api/prompts/:id | Delete prompt |
| GET | /api/prompts/:id/versions | Version history |
| GET | /api/prompts/:id/versions/:vid | Specific version |
| POST | /api/prompts/:id/copy | Copy with variable substitution |
| GET | /api/tags | List tags |
| POST | /api/tags | Create tag |
| DELETE | /api/tags/:id | Delete tag |
| GET | /api/folders | List folders |
| POST | /api/folders | Create folder |
| POST | /api/import | Import prompts from JSON |
| POST | /api/export | Export prompts as JSON |

## File Structure
```
prompt-hub-desktop/
├── package.json
├── main.js           # Electron entry
├── server.js         # Express REST API
├── database.js       # SQLite singleton + schema
├── SPEC.md
├── CLAUDE.md
├── .gitignore
└── public/
    ├── index.html    # Main UI
    ├── styles.css    # Dark theme styling
    └── app.js       # Frontend logic
```
