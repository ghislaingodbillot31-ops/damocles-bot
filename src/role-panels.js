const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const DATA_PATH = path.join(__dirname, '..', 'data', 'role-panels.json');

function load() {
  if (!fs.existsSync(DATA_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')); }
  catch { return []; }
}

function save(panels) {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(panels, null, 2), 'utf-8');
}

function newId() { return crypto.randomBytes(8).toString('hex'); }

function getAll()    { return load(); }
function getById(id) { return load().find(p => p.id === id) || null; }

function create(data) {
  const panels = load();
  const panel = {
    id:          newId(),
    name:        data.name || 'Panneau sans nom',
    channelId:   data.channelId,
    title:       data.title || '',
    description: data.description || '',
    imageFile:   data.imageFile || null,
    color:       data.color || '5865F2',
    buttons:     data.buttons || [],
    createdAt:   new Date().toISOString(),
    publishedAt: null,
    messageId:   null,
  };
  panels.push(panel);
  save(panels);
  return panel;
}

function update(id, data) {
  const panels = load();
  const idx = panels.findIndex(p => p.id === id);
  if (idx === -1) return null;
  panels[idx] = { ...panels[idx], ...data, id };
  save(panels);
  return panels[idx];
}

function remove(id) {
  save(load().filter(p => p.id !== id));
}

function markPublished(id, messageId) {
  return update(id, { publishedAt: new Date().toISOString(), messageId });
}

module.exports = { getAll, getById, create, update, remove, markPublished };
