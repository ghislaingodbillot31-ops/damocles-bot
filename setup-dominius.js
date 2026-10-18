// Crée la structure du serveur de jeu (rôles, catégories, salons) et écrit nouveau-serveur.env
// (+ VERIF_MODE=code) (ID à coller dans Render > Environment de la 2e instance).
//   node serveurs/dominius/setup-dominius.js          → aperçu, ne crée rien
//   node serveurs/dominius/setup-dominius.js --go     → crée tout (refuse si le serveur contient déjà des salons)
//   node serveurs/dominius/setup-dominius.js --go --force → supprime d'abord les salons existants
//   node serveurs/dominius/setup-dominius.js --go --en    → ajoute seulement la catégorie ENGLISH (n'efface rien)
// Lit .env.nouveau : DISCORD_TOKEN, GUILD_ID, NOUVEAU_NOM
const fs = require('fs');
const path = require('path');
const here = f => path.join(__dirname, f);
const dotenv = require('dotenv');
const { Client, GatewayIntentBits, ChannelType: T, PermissionFlagsBits: P } = require('discord.js');

const GO = process.argv.includes('--go'), FORCE = process.argv.includes('--force'), EN = process.argv.includes('--en');
const env = dotenv.parse(fs.readFileSync(here('.env.nouveau')));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Rôles (key = variable d'env si le bot en a besoin) ───────────────────────
const ROLES = [
  { n: '⚙️ Administrateur',    c: 0xE74C3C, hoist: true, admin: true, staff: true },
  { n: '🛡️ Modérateurs',       c: 0xE67E22, hoist: true, staff: true, perms: [P.ManageMessages, P.KickMembers, P.BanMembers, P.ModerateMembers], key: 'TICKET_SUPPORT_ROLE_ID' },
  { n: '💎 Donateur',          c: 0xF1C40F, hoist: true },
  { n: '🧪 Beta testeur',      c: 0x9B59B6, hoist: true, membre: true },
  { n: '🔍 Vérification',      c: 0x95A5A6, key: 'VERIFICATION_ROLE_ID' },
  { n: '👥 Membre',            c: 0x2ECC71, membre: true, key: 'MEMBRE_ROLE_ID' },
];

// ── Salons. acces : public (lecture seule pour tous) | membre | lecture (membres, lecture seule) | staff
const CATS = [
  { n: '🔐 ACCUEIL', acces: 'verif', salons: [
    { n: '⛔・ne-pas-écrire', t: 'ANTI-SPAM : tout message ici = bannissement automatique', key: 'ANTISPAM_CHANNEL_ID', piege: true },
    { n: '🔍・vérification', t: 'Tape le code affiché pour accéder au serveur', key: 'VERIFICATION_CHANNEL_ID' },
  ]},
  { n: '📌 INFOS', acces: 'lecture', salons: [
    { n: '📜・règlement', t: 'Règlement du serveur', key: 'REGLEMENT_CHANNEL_ID' },
    { n: '👋・bienvenue', t: 'Arrivées et départs', key: 'WELCOME_CHANNEL_ID' },
    { n: '📢・annonces', t: 'Annonces officielles' },
  ]},
  { n: '🇫🇷 FRANÇAIS', acces: 'membre', salons: [
    { n: '💬・général-fr', t: 'Discussion en français' },
    { n: '📰・actualités', t: 'Mises à jour et news du jeu', lecture: true },
    { n: '🔄・patch-notes', t: 'Notes de version', lecture: true },
  ]},
  { n: '📚 TUTORIEL', acces: 'lecture', salons: [
    { n: '👋・introduction', t: 'Présentation du jeu et de son but' },
    { n: '🚀・bien-démarrer', t: 'Les premiers pas pour un nouveau joueur' },
    { n: '🎮・commandes', t: 'Contrôles et commandes en jeu' },
    { n: '💰・économie', t: 'Ressources, argent et progression' },
    { n: '⚔️・combat', t: 'Fonctionnement du combat' },
    { n: '🗺️・monde-et-modes', t: 'Carte, zones et modes de jeu' },
    { n: '❓・faq', t: 'Questions fréquentes' },
  ]},
  { n: '💬 COMMUNAUTÉ', acces: 'membre', salons: [
    { n: '💬・général', key: 'CHAT_CHANNEL_ID' },
    { n: '🎮・discussion-jeu' },
    { n: '🗺️・guides-astuces' },
    { n: '🤣・memes' },
    { n: '🎵・musique' },
    { n: '🤖・commandes-bot' },
    { n: '🎂・anniversaires', key: 'BIRTHDAY_CHANNEL_ID' },
    { n: '🔗・invitations', t: 'Génère ton lien d\'invitation (7 jours)', lecture: true, key: 'INVITE_HUB_CHANNEL_ID' },
    { n: '🏆・classements', key: 'LEVELUP_CHANNEL_ID' },
    { n: '👹・roles', key: 'ROLES_CHANNEL_ID' },
  ]},
  { n: '📸 MÉDIAS', acces: 'membre', salons: [
    { n: '📸・screenshots', t: 'Vos meilleures captures' },
    { n: '🎬・vidéos', t: 'Clips et vidéos' },
    { n: '🎨・fan-art' },
  ]},
  { n: '🐞 BUGS & SIGNALEMENTS', acces: 'membre', salons: [
    { n: '📋・liste-de-bugs', t: 'Liste des bugs déjà identifiés', lecture: true },
    { n: '🐞・report-bug', t: 'Un post par bug : titre clair, étapes pour le reproduire, capture ou vidéo, version du jeu', type: T.GuildForum },
    { n: '🚨・report-joueur', t: 'Signaler un comportement (preuves obligatoires)', type: T.GuildForum },
    { n: '💡・suggestions', t: 'Idées pour le jeu', key: 'SUGG_CHANNEL_ID' },
  ]},
  { n: '🇬🇧 ENGLISH', acces: 'membre', en: true, salons: [
    { n: '📢・announcements-en', t: 'Official announcements (English)', lecture: true },
    { n: '💬・general-en', t: 'English-speaking chat' },
  ]},
  { n: '🔊 VOCAUX', acces: 'membre', key: 'VOICE_CATEGORY_ID', salons: [
    { n: '➕-créer-un-salon', t: 'Bouton pour créer ton salon vocal', key: 'TEMPVOICE_PANEL_CHANNEL_ID' },
    { n: '🔊 Lobby', voice: true },
    { n: '🎮 Partie 1', voice: true },
    { n: '🎮 Partie 2', voice: true },
    { n: '😴 AFK', voice: true },
  ]},
  { n: '📖 TEXTUEL 📖', acces: 'membre', key: 'TEXT_CATEGORY_ID', salons: [] },
  { n: '🎫 SUPPORT', acces: 'lecture', key: 'TICKET_CATEGORY_ID', salons: [
    { n: '📩・ouvrir-ticket', key: ['TICKET_CHANNEL_ID', 'TICKET_LOG_CHANNEL_ID'] },
  ]},
  { n: '📊 STAFF', acces: 'staff', salons: [
    { n: '🔑・staff-info', t: 'Liens utiles et accès (staff uniquement)' },
    { n: '💬・staff-général' },
    { n: '📋・staff-logs', key: ['DAMOCLES_LOG_CHANNEL_ID', 'LOG_CHANNEL_ID'] },
    { n: '🖥️・bot-status', t: 'État du bot', key: 'STATUS_CHANNEL_ID' },
    { n: '⚠️・staff-alertes' },
    { n: '🛠️・staff-commandes' },
  ]},
];

const keys = k => [].concat(k || []);

(async () => {
  console.log('Rôles : ' + ROLES.map(r => r.n).join(', '));
  for (const c of CATS) console.log('\n' + c.n + ' [' + c.acces + ']\n' + c.salons.map(s => '   ' + s.n + (s.type === T.GuildForum ? ' (forum)' : '')).join('\n'));
  if (!GO) return console.log('\nAperçu seulement. Relance avec --go pour créer.');

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const prete = new Promise(r => client.once('clientReady', r));
  await client.login(env.DISCORD_TOKEN); await prete;
  const D = client.guilds.cache.get(env.GUILD_ID);
  if (!D) throw new Error('Serveur introuvable : le bot est-il invité ?');
  await D.channels.fetch();
  if (D.channels.cache.size && !FORCE && !EN) {
    console.log('\nSalons existants :', D.channels.cache.map(c => c.name).join(', '));
    throw new Error('Le serveur n\'est pas vide. Ajoute --force pour les supprimer.');
  }
  if (!EN) for (const c of D.channels.cache.values()) { await c.delete('setup').catch(() => {}); await sleep(300); }
  if (env.NOUVEAU_NOM && !EN) await D.setName(env.NOUVEAU_NOM);

  await D.roles.fetch();
  for (const r of D.roles.cache.values()) {
    if (!EN && r.id !== D.id && !r.managed && !ROLES.some(x => x.n === r.name)) { await r.delete('setup').catch(() => {}); await sleep(300); }
  }
  const out = {}, id = {};
  for (const r of ROLES) {
    await D.roles.fetch();
    const n = D.roles.cache.find(x => x.name === r.n) || await D.roles.create({
      name: r.n, colors: { primaryColor: r.c }, hoist: !!r.hoist, reason: 'setup',
      permissions: r.admin ? [P.Administrator] : (r.perms || []),
    });
    id[r.n] = n; if (r.key) out[r.key] = n.id; await sleep(400);
  }
  const staff = ROLES.filter(r => r.staff).map(r => id[r.n].id);
  const membres = ROLES.filter(r => r.membre).map(r => id[r.n].id);
  const bot = client.user.id;

  // overwrites complets, calculés par niveau d'accès
  const ow = (acces, lectureSeule) => {
    const view = [P.ViewChannel, P.ReadMessageHistory];
    const rw = { allow: view, deny: [P.SendMessages, P.AddReactions] };
    const o = [{ id: bot, allow: [P.ViewChannel, P.SendMessages, P.ManageChannels, P.ManageMessages, P.EmbedLinks] }];
    const gens = (ids, allow, deny = []) => ids.forEach(i => o.push({ id: i, allow, deny }));
    gens(staff, [...view, P.SendMessages]);
    if (acces === 'verif') {
      o.push({ id: D.id, allow: [...view, P.SendMessages] });
      gens(membres, [], [P.ViewChannel]); // les vérifiés n'ont plus besoin de ce salon
    } else if (acces === 'public') o.push({ id: D.id, allow: view, deny: [P.SendMessages, P.AddReactions, P.CreatePublicThreads] });
    else {
      o.push({ id: D.id, deny: [P.ViewChannel] });
      if (acces !== 'staff') gens(membres, lectureSeule || acces === 'lecture' ? rw.allow : [...view, P.SendMessages], lectureSeule || acces === 'lecture' ? rw.deny : []);
    }
    return o;
  };

  for (const c of EN ? CATS.filter(c => c.en) : CATS) {
    const cat = await D.channels.create({ name: c.n, type: T.GuildCategory, permissionOverwrites: ow(c.acces), reason: 'setup' });
    keys(c.key).forEach(k => out[k] = cat.id); await sleep(400);
    for (const s of c.salons) {
      const lecture = c.acces === 'public' || c.acces === 'lecture' || s.lecture;
      const ch = await D.channels.create({
        name: s.n, type: s.voice ? T.GuildVoice : (s.type || T.GuildText), topic: s.t, parent: cat.id,
        permissionOverwrites: s.piege ? ow('verif').filter(o => !membres.includes(o.id)) : s.voice ? ow('membre').map(o => ({ ...o, allow: [...(o.allow || []), P.Connect] })) : ow(c.acces, lecture),
        reason: 'setup',
      });
      keys(s.key).forEach(k => out[k] = ch.id); await sleep(400);
    }
  }
  if (!EN) { out.VERIF_MODE = 'code'; out.FRESH_DATA = '1'; }
  const lignes = Object.entries(out).map(([k, v]) => k + '=' + v).join('\n') + '\n';
  if (EN) fs.appendFileSync(here('nouveau-serveur.env'), lignes); else fs.writeFileSync(here('nouveau-serveur.env'), lignes);
  console.log('\n✅ Terminé : ' + Object.keys(out).length + ' variables dans nouveau-serveur.env');
  process.exit(0);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
