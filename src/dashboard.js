const express = require('express');
const session = require('express-session');
const fetch   = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path    = require('path');
const config  = require('./config');
const db      = require('./database');

const OWNER_IDS = ['231500104844967937', '1487197600452055040'];

let _client = null;
function setClient(c) { _client = c; }

function createDashboard() {
  const app = express();
  const cfg = config.get();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'dashboard', 'dist')));
  app.use(session({
    secret: cfg.DASHBOARD_SECRET || 'damocles-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  }));

  // ── Auth Discord OAuth ────────────────────────────────────────────────────
  app.get('/auth/login', (req, res) => {
    const params = new URLSearchParams({
      client_id: cfg.CLIENT_ID,
      redirect_uri: process.env.DASHBOARD_URL + '/auth/callback',
      response_type: 'code',
      scope: 'identify',
    });
    res.redirect('https://discord.com/api/oauth2/authorize?' + params.toString());
  });

  app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/?error=no_code');

    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.CLIENT_ID,
          client_secret: cfg.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: process.env.DASHBOARD_URL + '/auth/callback',
        }),
      });

      const tokenData = await tokenRes.json();
      const userRes   = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: 'Bearer ' + tokenData.access_token },
      });
      const user = await userRes.json();

      if (!OWNER_IDS.includes(user.id)) {
        return res.redirect('/?error=unauthorized');
      }

      req.session.user = { id: user.id, username: user.username, avatar: user.avatar };
      res.redirect('/dashboard');
    } catch (err) {
      console.error('Auth error:', err);
      res.redirect('/?error=auth_failed');
    }
  });

  app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
  });

  // ── Middleware auth ───────────────────────────────────────────────────────
  function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
  }

  // ── API Stats ─────────────────────────────────────────────────────────────
  app.get('/api/stats', requireAuth, async (req, res) => {
    const stats = await db.getStats();
    const guild = _client?.guilds.cache.first();
    res.json({
      ...stats,
      guildName: guild?.name || 'Inconnu',
      memberCount: guild?.memberCount || 0,
      botOnline: !!_client?.user,
    });
  });

  // ── API Membres ───────────────────────────────────────────────────────────
  app.get('/api/members', requireAuth, async (req, res) => {
    const members = await db.getAllMembers();
    res.json(members);
  });

  app.get('/api/members/:id', requireAuth, async (req, res) => {
    const member = await db.getMember(req.params.id);
    if (!member) return res.status(404).json({ error: 'Not found' });
    res.json(member);
  });

  // ── API Actions membres ───────────────────────────────────────────────────
  app.post('/api/members/:id/ban', requireAuth, async (req, res) => {
    const { reason } = req.body;
    const guild = _client?.guilds.cache.first();
    if (!guild) return res.status(500).json({ error: 'Bot not ready' });
    try {
      await guild.members.ban(req.params.id, { reason: reason || 'Banni via dashboard' });
      const user = await _client.users.fetch(req.params.id).catch(() => null);
      if (user) await db.banMember(user, reason || 'Banni via dashboard', 'Dashboard');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/members/:id/kick', requireAuth, async (req, res) => {
    const { reason } = req.body;
    const guild = _client?.guilds.cache.first();
    if (!guild) return res.status(500).json({ error: 'Bot not ready' });
    try {
      const member = await guild.members.fetch(req.params.id).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Member not found' });
      await member.kick(reason || 'Kické via dashboard');
      await db.kickMember(member.user, reason || 'Kické via dashboard', 'Dashboard');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/members/:id/warn', requireAuth, async (req, res) => {
    const { reason } = req.body;
    const count = await db.addWarning(req.params.id, reason || 'Averti via dashboard', 'Dashboard');
    res.json({ success: true, warningCount: count });
  });

  // ── API Config ────────────────────────────────────────────────────────────
  app.get('/api/config', requireAuth, (req, res) => {
    const cfg = config.get();
    // Ne pas exposer le token
    const { DISCORD_TOKEN, DISCORD_CLIENT_SECRET, DASHBOARD_SECRET, ...safe } = cfg;
    res.json(safe);
  });

  app.post('/api/config', requireAuth, (req, res) => {
    const { DISCORD_TOKEN, DISCORD_CLIENT_SECRET, DASHBOARD_SECRET, ...safeConfig } = req.body;
    const updated = config.set(safeConfig);
    res.json({ success: true });
  });

  // ── API Tickets ──────────────────────────────────────────────────────────
  app.get('/api/tickets', requireAuth, async (req, res) => {
    const tickets = (await db.getAllMembers())
      .flatMap(m => (m.history || [])
        .filter(h => h.event === 'ticket_created' || h.event === 'ticket_taken' || h.event === 'ticket_closed')
        .map(h => ({ ...h, userId: m.id, username: m.username }))
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Grouper par ticket (salon), du plus ancien au plus récent événement
    const ticketMap = new Map();
    for (const e of tickets) {
      const key = e.channelId || e.channelName || e.userId;
      if (!ticketMap.has(key)) {
        ticketMap.set(key, {
          id: key,
          userId: e.userId,
          username: e.username,
          channelName: e.channelName,
          channelId: e.channelId,
          status: 'open',
          createdAt: null,
          takenBy: null,
          closedBy: null,
        });
      }
      const t = ticketMap.get(key);
      if (e.event === 'ticket_created') { t.status = 'open';   t.createdAt = e.date; }
      if (e.event === 'ticket_taken')   { t.status = 'taken';  t.takenBy = e.modId; }
      if (e.event === 'ticket_closed')  { t.status = 'closed'; t.closedBy = e.modId; }
      if (e.channelName) t.channelName = e.channelName;
    }

    res.json([...ticketMap.values()].reverse());
  });

  app.post('/api/tickets/publish', requireAuth, async (req, res) => {
    const guild = _client?.guilds.cache.first();
    if (!guild) return res.status(500).json({ error: 'Bot not ready' });

    const cfg = config.get();
    const channelId = cfg.TICKET_CHANNEL_ID;
    if (!channelId) return res.status(400).json({ error: 'Salon non configuré' });

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

    try {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

      const buttonStyle =
        cfg.TICKET_BUTTON_COLOR === 'Success'   ? ButtonStyle.Success   :
        cfg.TICKET_BUTTON_COLOR === 'Danger'    ? ButtonStyle.Danger    :
        cfg.TICKET_BUTTON_COLOR === 'Secondary' ? ButtonStyle.Secondary :
        ButtonStyle.Primary;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_create')
          .setLabel(cfg.TICKET_BUTTON_LABEL || '🎫 Ouvrir un ticket')
          .setStyle(buttonStyle),
      );

      await channel.send({
        embeds: [{
          description: cfg.TICKET_MESSAGE || 'Entre en contact avec le staff du serveur.',
          color: 0x5865F2,
          footer: { text: 'Damoclès Security Bot' },
        }],
        components: [row],
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tickets/:id/close', requireAuth, async (req, res) => {
    const guild = _client?.guilds.cache.first();
    if (!guild) return res.status(500).json({ error: 'Bot not ready' });
    const channel = guild.channels.cache.get(req.params.id) ||
      guild.channels.cache.find(c => c.name === req.params.id);
    if (channel) await channel.delete('Clôturé via dashboard').catch(() => {});
    res.json({ success: true });
  });

  // ── API Analyse ───────────────────────────────────────────────────────────
  app.post('/api/analyse', requireAuth, async (req, res) => {
    const guild = _client?.guilds.cache.first();
    if (!guild) return res.status(500).json({ error: 'Bot not ready' });
    try {
      const { runAuto } = require('./commands/analyse');
      const result = await runAuto(guild);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API Canaux & Rôles Discord ────────────────────────────────────────────
  app.get('/api/channels', requireAuth, (req, res) => {
    const guild = _client?.guilds.cache.first();
    if (!guild) return res.status(500).json({ error: 'Bot not ready' });
    const { ChannelType } = require('discord.js');

    // Récupérer catégories triées par position
    const categories = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position);

    // Construire la liste dans l'ordre Discord : catégorie puis ses salons
    const result = [];
    for (const [, cat] of categories) {
      const children = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText && c.parentId === cat.id && c.name.length < 40)
        .sort((a, b) => a.position - b.position);
      for (const [, ch] of children) {
        result.push({ id: ch.id, name: ch.name, category: cat.name });
      }
    }
    // Salons sans catégorie
    const orphans = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText && !c.parentId && c.name.length < 40)
      .sort((a, b) => a.position - b.position);
    for (const [, ch] of orphans) {
      result.unshift({ id: ch.id, name: ch.name, category: null });
    }

    res.json(result);
  });

  app.get('/api/categories', requireAuth, (req, res) => {
    const guild = _client?.guilds.cache.first();
    if (!guild) return res.status(500).json({ error: 'Bot not ready' });
    const { ChannelType } = require('discord.js');
    const categories = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position)
      .map(c => ({ id: c.id, name: c.name }));
    res.json(categories);
  });

  app.get('/api/roles', requireAuth, (req, res) => {
    const guild = _client?.guilds.cache.first();
    if (!guild) return res.status(500).json({ error: 'Bot not ready' });
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => ({ id: r.id, name: r.name, color: r.color }));
    res.json(roles);
  });

  // ── API Redémarrage manuel ────────────────────────────────────────────────
  app.post('/api/restart', requireAuth, (req, res) => {
    res.json({ success: true });
    // Laisse partir la réponse avant d'arrêter le bot
    setTimeout(() => require('./restart').redemarrer('manuel, par ' + req.session.user.username)
      .catch(err => console.error('⚠️ Redémarrage :', err.message)), 500);
  });

  // ── API Messages récurrents ───────────────────────────────────────────────
  const sched = require('./scheduled-messages');
  const schedInput = b => ({
    name: typeof b.name === 'string' ? b.name.slice(0, 100) : undefined,
    channelId: typeof b.channelId === 'string' ? b.channelId : undefined,
    message: typeof b.message === 'string' ? b.message.slice(0, 4000) : undefined,
    intervalMinutes: Number.isFinite(+b.intervalMinutes) && +b.intervalMinutes >= 1 ? +b.intervalMinutes : undefined,
    color: typeof b.color === 'string' && /^[0-9a-fA-F]{6}$/.test(b.color.replace('#', '')) ? b.color.replace('#', '') : undefined,
    enabled: typeof b.enabled === 'boolean' ? b.enabled : undefined,
  });

  app.get('/api/scheduled-messages', requireAuth, (req, res) => {
    res.json(sched.getAll());
  });

  app.post('/api/scheduled-messages', requireAuth, (req, res) => {
    const data = schedInput(req.body || {});
    if (!data.channelId || !data.message?.trim()) return res.status(400).json({ error: 'Salon et message obligatoires' });
    const msg = sched.create(data);
    if (msg.enabled && _client) sched.startTimer(msg, _client);
    res.json({ success: true, message: msg });
  });

  app.put('/api/scheduled-messages/:id', requireAuth, (req, res) => {
    const msg = sched.update(req.params.id, schedInput(req.body || {}), _client);
    if (!msg) return res.status(404).json({ error: 'Message introuvable' });
    res.json({ success: true, message: msg });
  });

  app.delete('/api/scheduled-messages/:id', requireAuth, (req, res) => {
    sched.remove(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/scheduled-messages/:id/send-now', requireAuth, async (req, res) => {
    if (!_client) return res.status(500).json({ error: 'Bot non connecté' });
    try { await sched.sendNow(req.params.id, _client); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── API HUB d'information ─────────────────────────────────────────────────
  const hubInfo = require('./hub-info');
  const exp     = require('./exploitation');
  const { HUB_CHANNEL, ACTIVITES } = require('./hub');

  app.get('/api/hub-info', requireAuth, (req, res) => {
    res.json(hubInfo.get());
  });

  app.post('/api/hub-info', requireAuth, (req, res) => {
    res.json(hubInfo.set(req.body || {}));
  });

  // Republie les deux HUB (information + exploitants) dans le salon du HUB
  app.post('/api/hub-info/publish', requireAuth, async (req, res) => {
    const channel = _client?.channels.cache.get(HUB_CHANNEL);
    if (!channel) return res.status(500).json({ error: 'Bot non connecté ou salon du HUB introuvable' });
    try {
      await require('./hub').postHub(channel);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API Exploitations ─────────────────────────────────────────────────────
  const nomDe = id => _client?.users.cache.get(id)?.username || null;

  app.get('/api/exploitations', requireAuth, (req, res) => {
    const list = exp.getAll().map(e => ({
      ...e,
      ownerName: nomDe(e.ownerId) || e.ownerTag,
      coNames:   (e.coExploitants || []).map((id, i) => nomDe(id) || e.coExploitantTags?.[i] || id),
      ouvNames:  (e.ouvriers || []).map((id, i) => nomDe(id) || e.ouvrierTags?.[i] || id),
    }));
    res.json({ exploitations: list, activites: ACTIVITES.map(a => a.value) });
  });

  app.patch('/api/exploitations/:id', requireAuth, (req, res) => {
    const b = req.body || {};
    const acts = ACTIVITES.map(a => a.value);
    const fields = {};
    if (typeof b.nom === 'string' && b.nom.trim()) fields.nom = b.nom.trim().slice(0, 60);
    for (const k of ['activitePrincipale', 'activiteSecondaire', 'activiteSupplementaire']) {
      if (k in b) fields[k] = acts.includes(b[k]) ? b[k] : null;
    }
    if (typeof b.recrute === 'boolean') fields.recrute = b.recrute;
    if (Number.isInteger(b.couleur) && b.couleur >= 0 && b.couleur <= 0xFFFFFF) fields.couleur = b.couleur;
    if (Array.isArray(b.produits)) fields.produits = b.produits.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim().slice(0, 100)).slice(0, 25);
    const e = exp.updateExploitation(req.params.id, fields);
    if (!e) return res.status(404).json({ error: 'Exploitation introuvable' });
    res.json(e);
  });

  app.delete('/api/exploitations/:id', requireAuth, async (req, res) => {
    const e = exp.deleteExploitation(req.params.id);
    if (!e) return res.status(404).json({ error: 'Exploitation introuvable' });
    const guild = _client?.guilds.cache.first();
    if (guild) {
      await require('./agrilog').agrilog(guild, '🗑️ Exploitation supprimée : **' + e.nom + '** (créateur <@' + e.ownerId + '>) · depuis le dashboard par ' + req.session.user.username)
        .catch(() => {});
    }
    res.json({ success: true });
  });

  // ── API Auth user ─────────────────────────────────────────────────────────
  app.get('/api/me', (req, res) => {
    if (!req.session.user) return res.json({ authenticated: false });
    res.json({ authenticated: true, user: req.session.user });
  });

  // ── Catch-all pour React ──────────────────────────────────────────────────
  app.get('*path', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dashboard', 'dist', 'index.html'));
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Dashboard disponible sur le port ' + PORT);
  });
}

module.exports = { createDashboard, setClient };