const fs   = require('fs');
const { dataPath } = require('./paths');
const config = require('./config');
const db     = require('./database');
const levels = require('./levels');
const expl   = require('./exploitation');
const sched  = require('./scheduled-messages');
const hubInfo = require('./hub-info');

// API d'administration du dashboard (page /admin.html). Monté par dashboard.js après le contrôle de session.
const lire = (f, def) => { try { return JSON.parse(fs.readFileSync(dataPath(f), 'utf-8')); } catch { return def; } };
const SETTINGS = ['RESTART_HOUR', 'INACTIVE_DAYS', 'EXPEL_DAYS']; // INACTIVE/EXPEL : pris en compte au prochain démarrage

function mount(app, ctx) {
  const { guild, salon } = ctx;
  const wrap = fn => async (req, res) => {
    try { res.json(await fn(req, res) ?? { ok: true }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  };
  const A = '/api/admin';
  app.param('id', (req, res, next, id) => /^[w-]{1,64}$/.test(id) ? next() : res.status(400).json({ error: 'Identifiant invalide' }));

  // ── Aperçu ──
  app.get(A + '/overview', wrap(async () => {
    const g = guild(), items = s => Object.values(lire(s, {}).items || {});
    const attente = f => items(f).filter(i => i.status === 'attente').length;
    return {
      bot: ctx.client.user?.tag, ping: ctx.client.ws.ping, uptime: Math.round(process.uptime()),
      membresDiscord: g?.memberCount, stats: await db.getStats(), exploitations: expl.getAll().length,
      xpMembres: Object.keys(lire('xp.json', {})).length,
      enAttente: {
        bugs: attente('bugs.json'), suggestions: attente('suggestions.json'), mods: attente('mods-propositions.json'),
        boutique: Object.values(lire('boutique.json', {}).requests || {}).filter(r => r.status === 'pending').length,
      },
    };
  }));

  // ── Salons & rôles configurés (.env) : repère les ID cassés ──
  app.get(A + '/ids', wrap(async () => {
    const g = guild();
    return Object.keys(process.env).filter(k => /_(CHANNEL|ROLE|CATEGORY)_IDS?$/.test(k) && process.env[k]).sort().map(k => {
      const id = process.env[k].split(',')[0].trim();
      const o = g?.channels.cache.get(id) || g?.roles.cache.get(id);
      return { cle: k, id: process.env[k], nom: o?.name || null };
    });
  }));

  // ── Membres ──
  // Tous les membres (présents et partis), filtrés + paginés
  app.get(A + '/members', wrap(async req => {
    const { q = '', filtre = 'tous', page = 0 } = req.query, xp = lire('xp.json', {}), mq = q.toLowerCase();
    const ok = { tous: () => true, presents: m => m.present, absents: m => !m.present, bannis: m => m.status === 'banned', expulses: m => m.status === 'kicked',
      partis: m => m.status === 'left', avertis: m => (m.warnings || []).length > 0 }[filtre] || (() => true);
    const l = (await db.getAllMembers()).filter(ok).filter(m => !mq || m.id === mq || (m.tag || m.username || '').toLowerCase().includes(mq))
      .map(m => ({ id: m.id, tag: m.tag || m.username, status: m.status, present: m.present, joinedAt: m.joinedAt, visits: m.visits, warnings: (m.warnings || []).length,
        xp: xp[m.id]?.xp || 0, level: xp[m.id]?.level || 0 }))
      .sort((x, y) => (y.present - x.present) || (y.xp - x.xp));
    return { total: l.length, items: l.slice(page * 50, page * 50 + 50) };
  }));

  // Journal : historique de tous les membres fusionné (arrivées, départs, kicks, bans, avertissements…)
  app.get(A + '/logs', wrap(async req => {
    const { q = '', event = '', page = 0 } = req.query, mq = q.toLowerCase(), all = await db.getAllMembers(), types = new Set();
    const l = [];
    for (const m of all) for (const h of m.history || []) {
      types.add(h.event);
      if (event && h.event !== event) continue;
      if (mq && !(m.tag || m.username || '').toLowerCase().includes(mq) && m.id !== mq) continue;
      l.push({ date: h.date, event: h.event, detail: h.detail, moderator: h.moderator, id: m.id, tag: m.tag || m.username });
    }
    l.sort((x, y) => String(y.date).localeCompare(String(x.date)));
    return { total: l.length, types: [...types].sort(), items: l.slice(page * 100, page * 100 + 100) };
  }));

  app.get(A + '/members/:id', wrap(async req => ({ ...(await db.getMember(req.params.id)), xp: levels.getRang(req.params.id) })));

  app.post(A + '/members/:id/xp', wrap(async req => {
    const d = Number(req.body.delta);
    if (!Number.isInteger(d) || !d) throw new Error('Delta entier non nul requis');
    return levels.adminAjuster(req.params.id, d);
  }));
  app.post(A + '/members/:id/warn', wrap(async req => ({ warnings: await db.addWarning(req.params.id, String(req.body.reason || 'Dashboard').slice(0, 500), 'dashboard') })));
  // Kick / ban : action Discord réelle + historique en base
  for (const type of ['kick', 'ban']) app.post(A + `/members/:id/${type}`, wrap(async req => {
    const raison = String(req.body.reason || 'Dashboard').slice(0, 400), g = guild(), id = req.params.id;
    if (!/^d{17,20}$/.test(id)) throw new Error('Identifiant Discord invalide');
    const user = await ctx.client.users.fetch(id);
    if (type === 'kick') await g.members.kick(id, raison); else await g.bans.create(id, { reason: raison });
    await (type === 'kick' ? db.kickMember : db.banMember)(user, raison, 'dashboard');
  }));

  // ── XP / niveaux ──
  app.get(A + '/xp', wrap(() => ({ bareme: levels.XP, defaut: levels.XP_DEFAULTS, classement: levels.getClassement(15) })));
  app.put(A + '/xp/bareme', wrap(req => { for (const [k, v] of Object.entries(req.body)) levels.setBaremeValeur(k, Number(v)); return { bareme: levels.XP }; }));
  app.post(A + '/xp/refresh', wrap(() => levels.refreshLeaderboard()));

  // ── Boutique ──
  app.get(A + '/boutique', wrap(() => Object.entries(lire('boutique.json', {}).requests || {}).map(([reqId, r]) => ({ reqId, ...r })).reverse().slice(0, 100)));
  app.post(A + '/boutique/cooldowns', wrap(() => ({ reset: require('./boutique').resetCooldowns() })));


  // ── Base de données : tables en lecture seule (chaque fichier JSON de data/ vu comme un tableau) ──
  const TABLES = {
    membres: ['👥 Membres', 'members.json'], xp: ['🎚️ XP & niveaux', 'xp.json'], exploitations: ['🌾 Exploitations', 'exploitations.json'],
    boutique: ['🛒 Demandes boutique', 'boutique.json', 'requests'], bugs: ['🐞 Bugs', 'bugs.json', 'items'], idees: ['💡 Idées', 'suggestions.json', 'items'],
    mods: ['🛠️ Mods', 'mods-propositions.json', 'items'], invitations: ['🔗 Invitations', 'invitations.json', 'links'], vocaux: ['🔊 Salons vocaux', 'tempvoice.json', 'channels'],
  };
  const lignes = k => {
    const [, f, sous] = TABLES[k]; let d = lire(f, {}); if (sous) d = d[sous] || {};
    return Object.entries(d).map(([cle, v]) => (v && typeof v === 'object' && !Array.isArray(v)) ? { _id: cle, ...v } : { _id: cle, valeur: v });
  };
  app.get(A + '/db', wrap(() => Object.entries(TABLES).map(([k, [nom]]) => ({ k, nom, n: lignes(k).length }))));
  app.get(A + '/db/:t', wrap(req => { if (!Object.hasOwn(TABLES, req.params.t)) throw new Error('Table inconnue'); return lignes(req.params.t); }));

  // ── Bugs / propositions (lecture : les décisions se prennent par boutons dans Discord) ──
  const liste = f => wrap(() => Object.entries(lire(f, {}).items || {}).map(([n, i]) => ({ n, ...i })).reverse());
  app.get(A + '/bugs', liste('bugs.json'));
  app.get(A + '/suggestions', liste('suggestions.json'));
  app.get(A + '/mods', liste('mods-propositions.json'));
  const sugg = require('./suggestions');
  app.delete(A + '/suggestions/:n', wrap(req => sugg.jeu.supprimer(ctx.client, req.params.n)));
  app.delete(A + '/mods/:n', wrap(req => sugg.mods.supprimer(ctx.client, req.params.n)));

  // ── FS25 : données des exploitations (activités, équipe, produits) ──
  app.get(A + '/fs25', wrap(() => {
    const l = expl.getAll().filter(e => e.nom), par = {};
    for (const e of l) for (const a of [e.activitePrincipale, e.activiteSecondaire, e.activiteSupplementaire]) if (a) par[a] = (par[a] || 0) + 1;
    return { exploitations: l, activites: Object.entries(par).sort((x, y) => y[1] - x[1]),
      totaux: { exploitations: l.length, ouvriers: l.reduce((n, e) => n + (e.ouvriers || []).length, 0),
        coExploitants: l.reduce((n, e) => n + (e.coExploitants || []).length, 0), produits: l.reduce((n, e) => n + (e.produits || []).length, 0) } };
  }));

  // ── Exploitations ──
  app.get(A + '/exploitations', wrap(() => expl.getAll()));
  app.delete(A + '/exploitations/:id', wrap(req => { expl.deleteExploitation(req.params.id); }));

  // ── Rôles du HUB communautaire (bouton « 🎭 Rôles ») ──
  app.get(A + '/roles', wrap(() => {
    const g = guild(), roles = require('./roles');
    return {
      boutons: roles.listRoleButtons().map(b => ({ ...b, nom: g?.roles.cache.get(b.roleId)?.name || null })),
      roles: [...(g?.roles.cache.values() || [])].filter(r => r.id !== g.id && !r.managed).sort((x, y) => y.position - x.position).map(r => ({ id: r.id, name: r.name })),
    };
  }));
  app.put(A + '/roles', wrap(req => {
    const g = guild(), l = req.body.boutons;
    if (!Array.isArray(l) || l.length > 25) throw new Error('25 boutons maximum');
    const vus = new Set(), propres = l.map(b => {
      if (!g.roles.cache.has(b.roleId)) throw new Error('Rôle introuvable : ' + b.roleId);
      if (vus.has(b.roleId)) throw new Error('Rôle en double : ' + g.roles.cache.get(b.roleId).name);
      vus.add(b.roleId);
      const label = String(b.label || '').trim().slice(0, 80);
      if (!label) throw new Error('Nom de bouton vide');
      return { roleId: b.roleId, label, emoji: String(b.emoji || '').trim().slice(0, 40), style: ['Primary', 'Secondary', 'Success', 'Danger'].includes(b.style) ? b.style : 'Secondary' };
    });
    require('./roles').setRoleButtons(propres);
  }));

  // ── HUB d'information ──
  app.get(A + '/hubinfo', wrap(() => hubInfo.get()));
  app.put(A + '/hubinfo', wrap(req => hubInfo.set(req.body)));
  app.post(A + '/hubinfo/publier', wrap(async () => { // reposte tout le HUB (info + exploitants)
    const hub = require('./hub'), ch = await salon(hub.HUB_CHANNEL);
    if (!ch) throw new Error('Salon du HUB introuvable');
    await hub.postHub(ch);
  }));

  // ── Messages récurrents ──
  app.get(A + '/scheduled', wrap(() => sched.getAll()));
  app.post(A + '/scheduled', wrap(req => sched.create(req.body)));
  app.put(A + '/scheduled/:id', wrap(req => sched.update(req.params.id, req.body, ctx.client) || Promise.reject(new Error('Introuvable'))));
  app.delete(A + '/scheduled/:id', wrap(req => { sched.remove(req.params.id); }));
  app.post(A + '/scheduled/:id/send', wrap(req => sched.sendNow(req.params.id, ctx.client)));

  // ── Réglages ──
  app.get(A + '/settings', wrap(() => { const c = config.get(); return Object.fromEntries(SETTINGS.map(k => [k, c[k]])); }));
  app.put(A + '/settings', wrap(req => {
    const n = {};
    for (const k of SETTINGS) if (k in req.body) n[k] = req.body[k] === '' ? '' : Number(req.body[k]);
    if (Object.values(n).some(v => v !== '' && !Number.isFinite(v))) throw new Error('Valeurs numériques requises');
    config.set(n); return n;
  }));

  // ── Actions ──
  const actions = {
    maintenance: () => require('./dailytasks').runDaily(ctx.client),
    anniversaires: () => require('./birthday').updateBirthdayChannel(ctx.client),
    nettoyage: () => require('./nettoyage').nettoyerTout(ctx.client),
    redemarrer: () => { setTimeout(() => require('./restart').redemarrer('dashboard'), 500); },
  };
  app.post(A + '/action/:nom', wrap(async req => {
    const a = actions[req.params.nom]; if (!a) throw new Error('Action inconnue');
    await a();
  }));
}

module.exports = { mount };
