'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DB_DIR = path.join(os.homedir(), '.prompt-hub');
const DB_PATH = path.join(DB_DIR, 'prompthub.db');

let db = null;

function getDb() {
  if (db) return db;

  fs.mkdirSync(DB_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema();
  seedData();

  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      content TEXT NOT NULL,
      folder TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_tags (
      prompt_id INTEGER,
      tag_id INTEGER,
      PRIMARY KEY (prompt_id, tag_id),
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompts_folder ON prompts(folder);
    CREATE INDEX IF NOT EXISTS idx_prompts_title ON prompts(title);
    CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt ON prompt_versions(prompt_id);
  `);

  // Ensure default folder exists
  db.prepare('INSERT OR IGNORE INTO folders (name) VALUES (?)').run('default');
}

function seedData() {
  const count = db.prepare('SELECT COUNT(*) as n FROM prompts').get();
  if (count.n > 0) return;

  const templates = [
    {
      title: 'Code Review Assistant',
      description: 'Review code changes and provide constructive feedback',
      content: 'You are an expert code reviewer. Review the following code changes and provide:\n1. Potential bugs or issues\n2. Performance concerns\n3. Code quality suggestions\n4. Security considerations\n\nCode:\n{{code}}',
      folder: 'development',
      tags: ['code-review', 'development'],
      variables: { code: 'Paste your code here' }
    },
    {
      title: 'Meeting Summary Generator',
      description: 'Summarize meeting notes into key points and action items',
      content: 'Summarize the following meeting notes into:\n1. Key discussion points\n2. Decisions made\n3. Action items with owners\n4. Follow-up topics\n\nMeeting notes:\n{{notes}}',
      folder: 'productivity',
      tags: ['summarize', 'meetings'],
      variables: { notes: 'Paste meeting notes here' }
    },
    {
      title: 'Git Commit Message Generator',
      description: 'Generate conventional commit messages from diff',
      content: 'Generate a conventional commit message for the following changes:\n\nDiff:\n{{diff}}\n\nFormat: type(scope): description\nTypes: feat, fix, docs, style, refactor, test, chore',
      folder: 'development',
      tags: ['git', 'development', 'automation'],
      variables: { diff: 'Paste git diff here' }
    },
    {
      title: 'README Builder',
      description: 'Generate a well-structured README for a project',
      content: 'Generate a README.md for this project:\n\nProject name: {{name}}\nDescription: {{description}}\nTech stack: {{stack}}\nFeatures: {{features}}',
      folder: 'development',
      tags: ['documentation', 'project'],
      variables: { name: 'Project name', description: 'Brief description', stack: 'e.g. Node.js, React, PostgreSQL', features: 'List main features' }
    },
    {
      title: 'SQL Query Builder',
      description: 'Generate SQL queries from natural language descriptions',
      content: 'Generate a SQL query for the following request:\n\nDatabase schema:\n{{schema}}\n\nRequest: {{request}}\n\nProvide the SQL and explain how it works.',
      folder: 'development',
      tags: ['sql', 'database', 'development'],
      variables: { schema: 'Table definitions', request: 'What you want to query' }
    }
  ];

  const insertPrompt = db.prepare(`
    INSERT INTO prompts (title, description, content, folder)
    VALUES (@title, @description, @content, @folder)
  `);

  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const insertPromptTag = db.prepare('INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)');
  const getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');

  const insertMany = db.transaction(() => {
    for (const t of templates) {
      const result = insertPrompt.run(t);
      const promptId = result.lastInsertRowid;
      for (const tagName of t.tags) {
        insertTag.run(tagName);
        const tag = getTagId.get(tagName);
        insertPromptTag.run(promptId, tag.id);
      }
    }
  });

  insertMany();
}

module.exports = { getDb };
