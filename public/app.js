'use strict';

const API = 'http://localhost:3355/api';

// ── State ─────────────────────────────────────────────────
let state = {
  prompts: [],
  folders: [],
  tags: [],
  currentPrompt: null,
  currentView: 'list',
  activeFolder: null,
  activeTag: null,
  searchQuery: '',
};

// ── Init ───────────────────────────────────────────────────
async function init() {
  await loadData();
  render();
  bindEvents();
}

// ── Data ──────────────────────────────────────────────────
async function loadData() {
  try {
    const [prompts, folders, tags] = await Promise.all([
      fetch(`${API}/prompts`).then(r => r.json()),
      fetch(`${API}/folders`).then(r => r.json()),
      fetch(`${API}/tags`).then(r => r.json()),
    ]);
    state.prompts = prompts;
    state.folders = folders;
    state.tags = tags;
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}

// ── Render ────────────────────────────────────────────────
function render() {
  renderSidebar();
  renderPromptList();
}

function renderSidebar() {
  // Folders
  const folderList = document.getElementById('folder-list');
  folderList.innerHTML = `
    <li class="${!state.activeFolder ? 'active' : ''}" data-folder="">📁 All</li>
    ${state.folders.map(f => `
      <li class="${state.activeFolder === f.name ? 'active' : ''}" data-folder="${f.name}">📂 ${escapeHtml(f.name)}</li>
    `).join('')}
  `;

  // Tags
  const tagList = document.getElementById('tag-list');
  tagList.innerHTML = state.tags.map(t => `
    <li class="${state.activeTag === t.name ? 'active' : ''}" data-tag="${escapeHtml(t.name)}">#${escapeHtml(t.name)}</li>
  `).join('');

  // Folder dropdown in editor
  const folderSelect = document.getElementById('prompt-folder');
  if (folderSelect) {
    folderSelect.innerHTML = state.folders.map(f => `<option value="${escapeHtml(f.name)}">${escapeHtml(f.name)}</option>`).join('');
  }
}

function renderPromptList() {
  const listTitle = document.getElementById('list-title');
  let title = 'All Prompts';
  if (state.activeFolder) title = `📂 ${state.activeFolder}`;
  if (state.activeTag) title = `#${state.activeTag}`;
  if (state.searchQuery) title = `🔍 "${state.searchQuery}"`;
  listTitle.textContent = title;

  const grid = document.getElementById('prompt-list');
  if (state.prompts.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-dim)">No prompts yet. Click "+ New Prompt" to create one!</div>';
    return;
  }

  grid.innerHTML = state.prompts.map(p => `
    <div class="prompt-card" data-id="${p.id}">
      <div class="prompt-card-title">${escapeHtml(p.title)}</div>
      <div class="prompt-card-desc">${escapeHtml(p.description || 'No description')}</div>
      ${p.folder ? `<span class="prompt-card-folder">${escapeHtml(p.folder)}</span>` : ''}
      ${(p.tags || []).slice(0, 3).map(t => `<span class="prompt-card-tag">#${escapeHtml(t)}</span>`).join('')}
    </div>
  `).join('');
}

function renderTagSelector(selectedTags) {
  const selector = document.getElementById('tag-selector');
  if (!selector) return;
  selector.innerHTML = state.tags.map(t => `
    <span class="tag-chip ${(selectedTags || []).includes(t.name) ? 'selected' : ''}" data-tag="${escapeHtml(t.name)}">
      #${escapeHtml(t.name)}
    </span>
  `).join('');
}

function renderVariableInputs() {
  const container = document.getElementById('variable-inputs');
  const content = document.getElementById('prompt-content').value;
  const vars = extractVariables(content);
  const countEl = document.getElementById('variable-count');
  countEl.textContent = vars.length > 0 ? `${vars.length} var${vars.length > 1 ? 's' : ''}` : '';

  if (vars.length === 0) {
    container.innerHTML = '<div style="font-size:12px;color:var(--text-dim);padding:10px 14px">No variables detected. Use {{variable}} syntax in your prompt.</div>';
    return;
  }

  container.innerHTML = vars.map(v => `
    <div class="var-input-row">
      <label>{{${escapeHtml(v)}}}</label>
      <input type="text" data-var="${escapeHtml(v)}" placeholder="Value for ${escapeHtml(v)}...">
    </div>
  `).join('');

  // Live preview on input
  container.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', updatePreview);
  });
}

function updatePreview() {
  const content = document.getElementById('prompt-content').value;
  const vars = extractVariables(content);
  let result = content;
  vars.forEach(v => {
    const input = document.querySelector(`input[data-var="${v}"]`);
    const value = input ? input.value : '';
    result = result.replace(new RegExp('\\{\\{' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}\\}', 'g'), value);
  });
  document.getElementById('preview-content').textContent = result;
}

function extractVariables(content) {
  const matches = content.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -2)))];
}

function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const el = document.getElementById(`view-${view}`);
  if (el) el.classList.remove('hidden');

  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`.nav-tab[data-view="${view}"]`);
  if (tab) tab.classList.add('active');

  state.currentView = view;
}

// ── Editor ────────────────────────────────────────────────
async function openEditor(id) {
  const res = await fetch(`${API}/prompts/${id}`);
  if (!res.ok) return;
  const prompt = await res.json();
  state.currentPrompt = prompt;

  document.getElementById('prompt-title').value = prompt.title;
  document.getElementById('prompt-description').value = prompt.description || '';
  document.getElementById('prompt-folder').value = prompt.folder || 'default';
  document.getElementById('prompt-content').value = prompt.content;

  renderTagSelector(prompt.tags);
  renderVariableInputs();
  updatePreview();
  showView('editor');
}

async function newPrompt() {
  state.currentPrompt = { id: null, title: '', description: '', content: '', folder: 'default', tags: [] };
  document.getElementById('prompt-title').value = '';
  document.getElementById('prompt-description').value = '';
  document.getElementById('prompt-folder').value = 'default';
  document.getElementById('prompt-content').value = '';
  renderTagSelector([]);
  renderVariableInputs();
  updatePreview();
  showView('editor');
}

async function savePrompt() {
  const payload = {
    title: document.getElementById('prompt-title').value,
    description: document.getElementById('prompt-description').value,
    folder: document.getElementById('prompt-folder').value,
    content: document.getElementById('prompt-content').value,
    tags: getSelectedTags(),
  };

  if (!payload.title || !payload.content) {
    alert('Title and content are required');
    return;
  }

  let res;
  if (state.currentPrompt && state.currentPrompt.id) {
    res = await fetch(`${API}/prompts/${state.currentPrompt.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    res = await fetch(`${API}/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  if (res.ok) {
    await loadData();
    render();
    showView('list');
  } else {
    alert('Failed to save prompt');
  }
}

async function copyPrompt() {
  const content = document.getElementById('prompt-content').value;
  const vars = extractVariables(content);
  const variables = {};
  vars.forEach(v => {
    const input = document.querySelector(`input[data-var="${v}"]`);
    variables[v] = input ? input.value : '';
  });

  let res;
  if (state.currentPrompt && state.currentPrompt.id) {
    res = await fetch(`${API}/prompts/${state.currentPrompt.id}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables }),
    });
  } else {
    // Substitute directly
    let result = content;
    for (const [k, v] of Object.entries(variables)) {
      result = result.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), v);
    }
    res = { ok: true, json: () => Promise.resolve({ content: result }) };
  }

  if (res.ok) {
    const data = await res.json();
    await navigator.clipboard.writeText(data.content);
    document.getElementById('copy-preview').textContent = data.content;
    document.getElementById('copy-modal').classList.remove('hidden');
  }
}

async function deletePrompt() {
  if (!state.currentPrompt || !state.currentPrompt.id) return;
  if (!confirm(`Delete "${state.currentPrompt.title}"?`)) return;

  const res = await fetch(`${API}/prompts/${state.currentPrompt.id}`, { method: 'DELETE' });
  if (res.ok) {
    await loadData();
    render();
    showView('list');
  }
}

function getSelectedTags() {
  const chips = document.querySelectorAll('.tag-chip.selected');
  return Array.from(chips).map(c => c.dataset.tag);
}

// ── Version History ────────────────────────────────────────
async function showVersions(promptId) {
  const res = await fetch(`${API}/prompts/${promptId}/versions`);
  if (!res.ok) return;
  const versions = await res.json();

  const container = document.getElementById('version-list');
  container.innerHTML = versions.map(v => `
    <div class="version-item">
      <div class="version-item-header">
        <span class="version-item-time">${new Date(v.created_at).toLocaleString()}</span>
      </div>
      <pre class="version-item-content">${escapeHtml(v.content)}</pre>
    </div>
  `).join('');

  showView('versions');
}

// ── Import / Export ────────────────────────────────────────
async function exportPrompts() {
  const res = await fetch(`${API}/export`, { method: 'POST' });
  if (!res.ok) return;
  const data = await res.json();

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prompt-hub-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importPrompts() {
  const fileInput = document.getElementById('import-file');
  const file = fileInput.files[0];
  if (!file) return;

  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    document.getElementById('import-status').textContent = '❌ Invalid JSON file';
    return;
  }

  const prompts = data.prompts || data;
  if (!Array.isArray(prompts)) {
    document.getElementById('import-status').textContent = '❌ Expected array of prompts';
    return;
  }

  const res = await fetch(`${API}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompts }),
  });

  if (res.ok) {
    const result = await res.json();
    document.getElementById('import-status').textContent = `✅ Imported ${result.imported} prompts`;
    await loadData();
    render();
  } else {
    document.getElementById('import-status').textContent = '❌ Import failed';
  }
}

// ── Helpers ────────────────────────────────────────────────
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function filterPrompts() {
  const q = state.searchQuery.toLowerCase();
  return state.prompts.filter(p => {
    const matchFolder = !state.activeFolder || p.folder === state.activeFolder;
    const matchTag = !state.activeTag || (p.tags && p.tags.includes(state.activeTag));
    const matchSearch = !q ||
      p.title.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q));
    return matchFolder && matchTag && matchSearch;
  });
}

// Override renderPromptList to use filterPrompts
const _origRenderList = renderPromptList;
renderPromptList = function() {
  const listTitle = document.getElementById('list-title');
  let title = 'All Prompts';
  if (state.activeFolder) title = `📂 ${state.activeFolder}`;
  if (state.activeTag) title = `#${state.activeTag}`;
  if (state.searchQuery) title = `🔍 "${state.searchQuery}"`;
  if (listTitle) listTitle.textContent = title;

  const grid = document.getElementById('prompt-list');
  const filtered = filterPrompts();
  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-dim)">No prompts found.</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="prompt-card" data-id="${p.id}">
      <div class="prompt-card-title">${escapeHtml(p.title)}</div>
      <div class="prompt-card-desc">${escapeHtml(p.description || 'No description')}</div>
      ${p.folder ? `<span class="prompt-card-folder">${escapeHtml(p.folder)}</span>` : ''}
      ${(p.tags || []).slice(0, 3).map(t => `<span class="prompt-card-tag">#${escapeHtml(t)}</span>`).join('')}
    </div>
  `).join('');
};

// ── Events ────────────────────────────────────────────────
function bindEvents() {
  // Search
  document.getElementById('search').addEventListener('input', e => {
    state.searchQuery = e.target.value;
    state.activeFolder = null;
    state.activeTag = null;
    renderSidebar();
    renderPromptList();
  });

  // Folder nav
  document.getElementById('folder-list').addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    state.activeFolder = li.dataset.folder || null;
    state.activeTag = null;
    state.searchQuery = '';
    document.getElementById('search').value = '';
    render();
  });

  // Tag nav
  document.getElementById('tag-list').addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    state.activeTag = li.dataset.tag || null;
    state.activeFolder = null;
    state.searchQuery = '';
    document.getElementById('search').value = '';
    render();
  });

  // New folder
  document.getElementById('btn-add-folder').addEventListener('click', async () => {
    const input = document.getElementById('new-folder-input');
    const name = input.value.trim();
    if (!name) return;
    await fetch(`${API}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    input.value = '';
    await loadData();
    render();
  });

  // Prompt cards
  document.getElementById('prompt-list').addEventListener('click', e => {
    const card = e.target.closest('.prompt-card');
    if (card) openEditor(parseInt(card.dataset.id));
  });

  // Editor buttons
  document.getElementById('btn-new').addEventListener('click', newPrompt);
  document.getElementById('btn-new-main').addEventListener('click', newPrompt);
  document.getElementById('btn-save').addEventListener('click', savePrompt);
  document.getElementById('btn-copy').addEventListener('click', copyPrompt);
  document.getElementById('btn-delete').addEventListener('click', deletePrompt);
  document.getElementById('btn-back').addEventListener('click', () => showView('list'));
  document.getElementById('btn-back-versions').addEventListener('click', () => {
    state.currentPrompt ? openEditor(state.currentPrompt.id) : showView('list');
  });
  document.getElementById('btn-back-ie').addEventListener('click', () => showView('list'));

  // Content changes → update variable inputs
  document.getElementById('prompt-content').addEventListener('input', () => {
    renderVariableInputs();
    updatePreview();
  });

  // Tag selector
  document.getElementById('tag-selector').addEventListener('click', e => {
    const chip = e.target.closest('.tag-chip');
    if (chip) chip.classList.toggle('selected');
  });

  // New tag from input
  document.getElementById('new-tag-input').addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      const name = e.target.value.trim();
      if (!name) return;
      await fetch(`${API}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      e.target.value = '';
      await loadData();
      renderTagSelector(getSelectedTags());
    }
  });

  // Bottom nav
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  });

  // Copy modal
  document.getElementById('copy-modal-close').addEventListener('click', () => {
    document.getElementById('copy-modal').classList.add('hidden');
  });

  // Import / Export
  document.getElementById('btn-export').addEventListener('click', exportPrompts);
  document.getElementById('btn-import').addEventListener('click', importPrompts);
}

// Start
init();
