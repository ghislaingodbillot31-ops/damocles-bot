const express = require('express');
const session = require('express-session');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const { ChannelType } = require('discord.js');
const { panneau }  = require('./embed-format');
const { dataPath } = require('./paths');

// Dashboard Le Coin des Copains : éditeur d'embeds. Les embeds sont sauvegardés (data/embeds.json),
// modifiables à volonté, puis (re)publiés dans le salon de ton choix.
// Accès : http://localhost:<PORT> avec le mot de passe DASHBOARD_PASSWORD (.env).
const STORE_PATH = dataPath('embeds.json');

let _client = null;
function setClient(c) { _client = c; }
const guild = () => _client?.guilds.cache.get(process.env.GUILD_ID) || _client?.guilds.cache.first();

// [{ id, nom, channelId, content, largeurFixe, embed, last: { channelId, messageId, at }, updatedAt }]
let embeds = [];
try { embeds = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')); } catch {}
const save = () => { try { fs.writeFileSync(STORE_PATH, JSON.stringify(embeds, null, 2), 'utf-8'); } catch {} };
const find = id => embeds.find(e => e.id === id);

// Nettoie l'embed saisi : on ne garde que les champs renseignés (Discord refuse les valeurs vides).
function construire(e) {
  const o = {}, d = e.embed || {};
  const txt = (k, max) => d[k] && String(d[k]).trim() ? String(d[k]).trim().slice(0, max) : undefined;
  const url = k => { const v = txt(k, 500); return v && /^https?:\/\//i.test(v) ? v : undefined; };
  o.title = txt('title', 256); o.description = txt('description', 4096); o.url = url('url');
  if (/^#?[0-9a-f]{6}$/i.test(d.color || '')) o.color = parseInt(d.color.replace('#', ''), 16);
  if (txt('authorName', 256)) o.author = { name: txt('authorName', 256), icon_url: url('authorIcon') };
  if (txt('footerText', 2048)) o.footer = { text: txt('footerText', 2048), icon_url: url('footerIcon') };
  if (url('thumbnail')) o.thumbnail = { url: url('thumbnail') };
  if (url('image')) o.image = { url: url('image') };
  if (d.timestamp) o.timestamp = new Date().toISOString();
  const fields = (d.fields || []).filter(f => f.name?.trim() && f.value?.trim()).slice(0, 25)
    .map(f => ({ name: f.name.trim().slice(0, 256), value: f.value.trim().slice(0, 1024), inline: !!f.inline }));
  if (fields.length) o.fields = fields;
  const payload = { content: e.content?.trim() || undefined, embeds: [o], allowedMentions: { parse: [] } };
  return e.largeurFixe ? panneau(payload) : payload;
}

async function salon(id) {
  const g = guild();
  return g && id ? (g.channels.cache.get(id) || await g.channels.fetch(id).catch(() => null)) : null;
}

function createDashboard() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // derrière le proxy Render : vraie IP du client + cookie « secure »
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" });
    if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(session({
    secret: process.env.DASHBOARD_SECRET || crypto.randomBytes(16).toString('hex'),
    resave: false, saveUninitialized: false, name: 'sid',
    cookie: { maxAge: 24 * 3600 * 1000, httpOnly: true, sameSite: 'strict', secure: !!process.env.RENDER },
  }));
  app.use(express.static(path.join(__dirname, '..', 'web')));

  // Anti-brute-force : 5 échecs par IP => blocage 15 min (en mémoire)
  const essais = new Map(), MAX_ESSAIS = 5, BLOCAGE_MS = 15 * 60 * 1000;
  const sha = v => crypto.createHash('sha256').update(String(v)).digest();
  app.post('/api/login', (req, res) => {
    const mdp = process.env.DASHBOARD_PASSWORD;
    if (!mdp) return res.status(500).json({ error: 'DASHBOARD_PASSWORD absent du .env' });
    const e = essais.get(req.ip) || { n: 0, jusqua: 0 };
    if (e.jusqua > Date.now()) return res.status(429).json({ error: 'Trop d’essais, réessaie dans ' + Math.ceil((e.jusqua - Date.now()) / 60000) + ' min' });
    const ok = typeof req.body?.password === 'string' && crypto.timingSafeEqual(sha(req.body.password), sha(mdp));
    if (!ok) {
      e.n++; if (e.n >= MAX_ESSAIS) { e.n = 0; e.jusqua = Date.now() + BLOCAGE_MS; }
      essais.set(req.ip, e); return res.status(401).json({ error: 'Mot de passe incorrect' });
    }
    essais.delete(req.ip);
    req.session.regenerate(() => { req.session.ok = true; res.json({ ok: true }); }); // nouvel identifiant de session à la connexion
  });
  app.get('/api/me', (req, res) => res.json({ ok: !!req.session.ok }));
  app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

  app.use('/api', (req, res, next) => req.session.ok ? next() : res.status(401).json({ error: 'Non connecté' }));

  require('./admin-api').mount(app, { get client() { return _client; }, guild, salon });

  app.get('/api/channels', (req, res) => {
    const g = guild(); if (!g) return res.status(503).json({ error: 'Bot pas prêt' });
    const cats = g.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
    res.json(g.channels.cache.filter(c => c.type === ChannelType.GuildText)
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .map(c => ({ id: c.id, name: c.name, category: cats.get(c.parentId)?.name || '' })));
  });

  app.get('/api/embeds', (req, res) => res.json(embeds));

  // Création / modification (id absent = nouvel embed)
  app.post('/api/embeds', (req, res) => {
    const b = req.body || {};
    let e = b.id && find(b.id);
    if (!e) { e = { id: crypto.randomUUID(), last: null }; embeds.push(e); }
    Object.assign(e, {
      nom: String(b.nom || 'Sans titre').slice(0, 80), channelId: b.channelId || '',
      content: String(b.content || '').slice(0, 2000), largeurFixe: !!b.largeurFixe,
      embed: b.embed || {}, updatedAt: Date.now(),
    });
    save(); res.json(e);
  });

  app.delete('/api/embeds/:id', (req, res) => {
    embeds = embeds.filter(e => e.id !== req.params.id); save(); res.json({ ok: true });
  });

  // Publie (ou republie) : mode « new » = nouveau message + suppression de l'ancien, « edit » = modifie l'ancien en place.
  app.post('/api/embeds/:id/send', async (req, res) => {
    const e = find(req.params.id);
    if (!e) return res.status(404).json({ error: 'Embed introuvable (enregistre-le d\'abord)' });
    try {
      const ch = await salon(e.channelId);
      if (!ch) return res.status(400).json({ error: 'Choisis un salon' });
      const payload = construire(e);
      const ancien = e.last && await salon(e.last.channelId).then(c => c?.messages.fetch(e.last.messageId).catch(() => null));
      let msg;
      if (req.body.mode === 'edit') {
        if (!ancien) return res.status(400).json({ error: 'Aucun message existant à modifier : publie-le d\'abord' });
        msg = await ancien.edit(payload);
      } else {
        msg = await ch.send(payload);
        if (ancien) await ancien.delete().catch(() => {});
      }
      e.last = { channelId: msg.channelId, messageId: msg.id, at: Date.now() };
      save(); res.json(e);
    } catch (err) {
      res.status(400).json({ error: err.rawError?.errors ? JSON.stringify(err.rawError.errors) : err.message });
    }
  });

  const PORT = process.env.PORT || 3000, HOST = process.env.DASHBOARD_HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1'); // Render exige un port ouvert sur 0.0.0.0, sinon le service est arrêté (502)
  app.listen(PORT, HOST, () => console.log('🌐 Dashboard : http://' + (HOST === '127.0.0.1' ? 'localhost' : HOST) + ':' + PORT));
}

module.exports = { createDashboard, setClient };
