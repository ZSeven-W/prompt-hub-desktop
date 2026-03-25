'use strict';

const express = require('express');
const { getDb } = require('./database');
const marked = require('marked');

const app = express();
const PORT = 3355;
const BASE = `http://localhost:${PORT}`;

app.use(express.json());
app.use(express.static(__dirname + '/public'));

// ── Helpers ───────────────────────────────────────────────
function extractVariables(content) {
  const matches = content.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -2)))];
}

function substituteVariables(content, variables) {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), value || '');
  }
  return result;
}

function enrichPrompt(row) {
  const db = getDb();
  const tags = db.prepare(`
    SELECT t.name FROM tags t
    JOIN prompt_tags pt ON pt.tag_id = t.id
    WHERE pt.prompt_id = ?
  `).all(row.id).map(r => r.name);

  return { ...row, tags, variables: extractVariables(row.content) };
}

// ── Health ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Prompts ──────────────────────────────────────────────
app.get('/api/prompts', (req, res) => {
  const db = getDb();
  const { search, folder, tag } = req.query;

  let sql = 'SELECT * FROM prompts WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (title LIKE ? OR description LIKE ? OR content LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (folder) {
    sql += ' AND folder = ?';
    params.push(folder);
  }

  let rows = db.prepare(sql).all(...params);

  if (tag) {
    rows = rows.filter(row => {
      const tags = db.prepare(`
        SELECT t.name FROM tags t
        JOIN prompt_tags pt ON pt.tag_id = t.id
        WHERE pt.prompt_id = ?
      `).all(row.id).map(r => r.name);
      return tags.includes(tag);
    });
  }

  res.json(rows.map(enrichPrompt));
});

app.post('/api/prompts', (req, res) => {
  const db = getDb();
  const { title, description, content, folder, tags } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }

  const result = db.prepare(`
    INSERT INTO prompts (title, description, content, folder)
    VALUES (?, ?, ?, ?)
  `).run(title, description || '', content, folder || 'default');

  const promptId = result.lastInsertRowid;

  if (tags && tags.length) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const insertPT = db.prepare('INSERT OR IGNORE INTO prompt_tags VALUES (?, ?)');
    const getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');
    const addTags = db.transaction(() => {
      for (const name of tags) {
        insertTag.run(name);
        const tag = getTagId.get(name);
        insertPT.run(promptId, tag.id);
      }
    });
    addTags();
  }

  // Initial version
  db.prepare('INSERT INTO prompt_versions (prompt_id, content) VALUES (?, ?)').run(promptId, content);

  const row = db.prepare('SELECT * FROM prompts WHERE id = ?').get(promptId);
  res.status(201).json(enrichPrompt(row));
});

app.get('/api/prompts/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM prompts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(enrichPrompt(row));
});

app.put('/api/prompts/:id', (req, res) => {
  const db = getDb();
  const { title, description, content, folder, tags } = req.body;
  const existing = db.prepare('SELECT * FROM prompts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  // Save version if content changed
  if (content && content !== existing.content) {
    db.prepare('INSERT INTO prompt_versions (prompt_id, content) VALUES (?, ?)').run(existing.id, existing.content);
  }

  db.prepare(`
    UPDATE prompts SET title=COALESCE(?,title), description=COALESCE(?,description),
    content=COALESCE(?,content), folder=COALESCE(?,folder), updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(title, description, content, folder, req.params.id);

  if (tags !== undefined) {
    db.prepare('DELETE FROM prompt_tags WHERE prompt_id = ?').run(req.params.id);
    if (tags.length) {
      const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
      const insertPT = db.prepare('INSERT OR IGNORE INTO prompt_tags VALUES (?, ?)');
      const getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');
      const updateTags = db.transaction(() => {
        for (const name of tags) {
          insertTag.run(name);
          const tag = getTagId.get(name);
          insertPT.run(existing.id, tag.id);
        }
      });
      updateTags();
    }
  }

  const row = db.prepare('SELECT * FROM prompts WHERE id = ?').get(req.params.id);
  res.json(enrichPrompt(row));
});

app.delete('/api/prompts/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM prompts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM prompts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Versions ──────────────────────────────────────────────
app.get('/api/prompts/:id/versions', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(rows);
});

app.get('/api/prompts/:id/versions/:vid', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM prompt_versions WHERE id = ? AND prompt_id = ?').get(req.params.vid, req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// ── Copy with variable substitution ──────────────────────
app.post('/api/prompts/:id/copy', (req, res) => {
  const db = getDb();
  const { variables } = req.body;
  const row = db.prepare('SELECT * FROM prompts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const substituted = substituteVariables(row.content, variables || {});
  res.json({ content: substituted, variables: extractVariables(substituted) });
});

// ── Tags ──────────────────────────────────────────────────
app.get('/api/tags', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM tags ORDER BY name').all();
  res.json(rows);
});

app.post('/api/tags', (req, res) => {
  const db = getDb();
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
  const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
  res.status(201).json(existing);
});

app.delete('/api/tags/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Folders ───────────────────────────────────────────────
app.get('/api/folders', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM folders ORDER BY name').all();
  res.json(rows);
});

app.post('/api/folders', (req, res) => {
  const db = getDb();
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = db.prepare('INSERT OR IGNORE INTO folders (name) VALUES (?)').run(name);
  const existing = db.prepare('SELECT * FROM folders WHERE name = ?').get(name);
  res.status(201).json(existing);
});

// ── Import / Export ──────────────────────────────────────
app.post('/api/import', (req, res) => {
  const db = getDb();
  const { prompts } = req.body;
  if (!Array.isArray(prompts)) return res.status(400).json({ error: 'prompts array required' });

  const insertPrompt = db.prepare(`
    INSERT INTO prompts (title, description, content, folder)
    VALUES (@title, @description, @content, @folder)
  `);

  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const insertPT = db.prepare('INSERT OR IGNORE INTO prompt_tags VALUES (?, ?)');
  const getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');

  const imported = [];
  const importAll = db.transaction(() => {
    for (const p of prompts) {
      const result = insertPrompt.run({
        title: p.title || 'Untitled',
        description: p.description || '',
        content: p.content || '',
        folder: p.folder || 'default'
      });
      const pid = result.lastInsertRowid;
      if (p.tags && p.tags.length) {
        for (const tagName of p.tags) {
          insertTag.run(tagName);
          const tag = getTagId.get(tagName);
          insertPT.run(pid, tag.id);
        }
      }
      db.prepare('INSERT INTO prompt_versions (prompt_id, content) VALUES (?, ?)').run(pid, p.content || '');
      imported.push(pid);
    }
  });

  importAll();
  res.status(201).json({ imported: imported.length, ids: imported });
});

app.post('/api/export', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM prompts ORDER BY updated_at DESC').all();
  const enriched = rows.map(enrichPrompt);
  res.json({ prompts: enriched });
});

// ── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PromptHub API running on ${BASE}`);
});
