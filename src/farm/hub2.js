const ids = require('../core/ids');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits,
} = require('discord.js');
const { panneau } = require('../core/embed-format');
const exp = require('./exploitation');
const N = require('./niveaux');
const C = require('./niveaux-config');

// Nouveau HUB des exploitants : un message général (boutons) puis une case par ferme du jeu,
// toutes éditées en place. Les fermes viennent directement du mod FS25.
const HUB2_CHANNEL = ids('EXPLOITANTS_HUB_CHANNEL_ID', '1569517803747152033');   // HUB général (boutons)
const LISTE_CHANNEL = ids('EXPLOITATIONS_LISTE_CHANNEL_ID', '1569522701666885642'); // une case par exploitation
let client = null;
const status = () => require('./fs25-succes').getStatus();

// ── Affichage ─────────────────────────────────────────────────────────────────
const barre = (v, a, b) => { const n = Math.round(Math.max(0, Math.min(1, (v - a) / (b - a))) * 10); return '▰'.repeat(n) + '▱'.repeat(10 - n); };
const fmt = n => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');

function exploitants(farm) {
  const e = exp.getAll().find(x => x.nom?.toLowerCase() === farm.name.trim().toLowerCase());
  return e ? exp.memberIds(e).slice(0, 8).map(i => '<@' + i + '>').join(' ') : '—';
}

function headPayload() {
  return panneau({
    embeds: [{
      title: '🌾  HUB DES EXPLOITANTS',
      description: [
        'Chaque exploitation gagne un **niveau (1 à 20)** avec ses succès. Chaque niveau donne **1 point** à dépenser en **activités** et en **usines**.',
        '',
        '> • Niveau 1 : **3 points** de départ, jusqu\'à **22 points** au niveau 20.',
        '> • Un niveau ne baisse jamais, les points gagnés restent acquis.',
        '> • Tout achat est validé par le staff dans un **ticket**.',
        '> • Revente ou changement : uniquement via le staff.',
        '',
        '📋 La liste des exploitations est dans <#' + LISTE_CHANNEL + '>.',
      ].join('\n'),
      color: 0x2ECC71,
      footer: { text: 'MonCopainBot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('nv_succes').setLabel('🏆 Succès').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('nv_act').setLabel('🛒 Activité').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('nv_usine').setLabel('🏭 Usine').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('nv_class').setLabel('📊 Classement').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('hubinfo_parametre').setLabel(require('./hub-info').get().boutons.find(b => b.key === 'parametre').label).setStyle(ButtonStyle.Secondary), // texte réglé avec /bouton-info
    )],
  });
}

// Panneau INFORMATIONS (message séparé) : Règlement, Google Drive, Mot de passe, Mods. Textes réglés avec /bouton-info, clics gérés par hub-info.js.
const infoPayload = () => require('./hub-info').buildMessage(['reglement', 'drive', 'motdepasse', 'mods']);

// HUB « Commerce & Contrat » (message séparé) : mêmes boutons et mêmes fonctions que l'ancien HUB des exploitants (hub_* gérés dans index.js).
const commercePayload = () => panneau({
  embeds: [{
    title: '🤝  COMMERCE & CONTRAT',
    description: [
      '📋  **Contrat** · propose tes services ou cherche un joueur',
      '📦  **Besoin** · recherche une matière première',
      '🏪  **Marché** · vends tes produits, consulte ceux des autres',
      '🛒  **Boutique** · points de classement contre argent en jeu',
    ].join('\n'),
    color: 0xF1C40F,
    footer: { text: 'MonCopainBot' },
  }],
  components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hub_contrat').setLabel('📋 Contrat').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('hub_besoin').setLabel('📦 Besoin').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('hub_marche').setLabel('🏪 Marché').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('hub_boutique').setLabel('🛒 Boutique').setStyle(ButtonStyle.Secondary),
  )],
});

function fermePayload(farm) {
  const f = N.lire(farm);
  const p = N.points(f);
  const suiv = C.PALIERS[f.niveau];
  const prog = suiv === undefined
    ? '**Niveau max** ' + barre(1, 0, 1) + ' ' + f.score
    : barre(f.score, C.PALIERS[f.niveau - 1], suiv) + ' ' + f.score + '/' + suiv;
  const acts = f.activites.map(id => C.parId[id].emoji + ' ' + C.parId[id].nom).join(' · ') || '_Aucune_';
  return panneau({ embeds: [{
    title: '🌾 ' + farm.name,
    description: '👥 ' + exploitants(farm) + '  ·  ⭐ **Niv. ' + f.niveau + '/20** ' + prog,
    fields: [
      { name: '💠 Points', value: '**' + p.dispo + '** dispo · ' + p.gagnes + ' gagnés · ' + p.depenses + ' dépensés', inline: true },
      { name: '💰 Solde', value: fmt(farm.money) + ' €', inline: true },
      { name: '🏦 Crédit', value: farm.loan > 0 ? fmt(farm.loan) + ' €' : '—', inline: true },
      { name: '🧰 Activités · 🏭 ' + f.usines + ' usine' + (f.usines > 1 ? 's' : ''), value: acts },
    ],
    color: 0x2ECC71,
  }], allowedMentions: { parse: [] } });
}

function foretPayload(farm) {
  return panneau({ embeds: [{
    title: '🌲 Association forestière',
    description: '👥 ' + exploitants(farm) + '\n\nBûcheron, bois de chauffage, plaquettes, populiculteur : activités **hors système**, non achetables par les exploitations.',
    fields: [{ name: '💰 Caisse', value: fmt(farm.money) + ' €' }],
    color: 0x1F8B4C,
  }], allowedMentions: { parse: [] } });
}

// ── Mise à jour des messages (édition en place) ───────────────────────────────
let enCours = false;
async function maj(st = status(), force = false) {
  if (!client || !st || enCours) return;
  enCours = true;
  try {
    const salon = id => client.channels.cache.get(id) || client.channels.fetch(id).catch(() => null);
    const [channel, liste] = [await salon(HUB2_CHANNEL), await salon(LISTE_CHANNEL)];
    if (!channel || !liste) return;
    const hub = N.db().hub;
    // Les cases étaient avant dans le salon du HUB : on les retire de l'ancien salon
    const ancien = hub.listeCanal || HUB2_CHANNEL;
    if (ancien !== LISTE_CHANNEL) {
      const vieux = await salon(ancien);
      for (const x of Object.values(hub.farms)) await vieux?.messages.delete(x.msgId).catch(() => {});
      hub.farms = {};
    }
    hub.listeCanal = LISTE_CHANNEL;
    const get = id => id ? channel.messages.fetch(id).catch(() => null) : null;
    const getCase = id => id ? liste.messages.fetch(id).catch(() => null) : null;

    const fermes = N.classement(st).map(x => x.farm);
    const foret = st.farms.find(N.estForet);
    const voulus = [...fermes.map(f => ({ cle: String(f.id), payload: fermePayload(f) })), ...(foret ? [{ cle: 'foret', payload: foretPayload(foret) }] : [])];

    // Tout est-il déjà en place ? sinon on republie dans l'ordre (HUB, classement des fermes, association)
    const tete = await get(hub.head);
    const existants = new Map();
    for (const v of voulus) { const m = await getCase(hub.farms[v.cle]?.msgId); if (m) existants.set(v.cle, m); }
    // Statut FS25 : s'il est dans ce salon, il doit rester EN TÊTE (avant le HUB) et n'est jamais supprimé par le nettoyage
    const bridge = require('./fs25-bridge');
    const stat = bridge.isStatusChannel(channel) ? await bridge.ensureStatusMessage(channel).catch(() => null) : null;
    const infoMsg = await get(hub.info);
    const comMsg = await get(hub.commerce);
    const complet = !force && tete && infoMsg && comMsg && voulus.every(v => existants.has(v.cle)) && (!stat || BigInt(stat.id) < BigInt(tete.id));

    if (!complet) {
      // Salons dédiés : on retire tout ce que le bot y a posté (évite les doublons si les ids connus sont perdus)
      for (const c of new Set([channel, liste])) {
        const vus = await c.messages.fetch({ limit: 100 }).catch(() => new Map());
        for (const m of vus.values()) if (m.author.id === client.user.id && m.id !== stat?.id) await m.delete().catch(() => {});
      }
      hub.farms = {};
      hub.head = (await channel.send(headPayload())).id;
      hub.info = (await channel.send(infoPayload())).id;
      hub.commerce = (await channel.send(commercePayload())).id;
      for (const v of voulus) hub.farms[v.cle] = { msgId: (await liste.send(v.payload)).id, h: JSON.stringify(v.payload) };
    } else {
      const hh = JSON.stringify(headPayload());
      if (hub.headH !== hh) { await tete.edit(headPayload()).catch(() => {}); hub.headH = hh; }
      const ih = JSON.stringify(infoPayload());
      if (hub.infoH !== ih) { await infoMsg.edit(infoPayload()).catch(() => {}); hub.infoH = ih; }
      const ch = JSON.stringify(commercePayload());
      if (hub.commerceH !== ch) { await comMsg.edit(commercePayload()).catch(() => {}); hub.commerceH = ch; }
      for (const v of voulus) {
        const h = JSON.stringify(v.payload);
        if (hub.farms[v.cle].h !== h) { await existants.get(v.cle).edit(v.payload).catch(() => {}); hub.farms[v.cle].h = h; }
      }
      for (const cle of Object.keys(hub.farms)) if (!voulus.some(v => v.cle === cle)) { // ferme disparue du jeu
        await liste.messages.delete(hub.farms[cle].msgId).catch(() => {});
        delete hub.farms[cle];
      }
    }
    N.save();
  } catch (e) { console.warn('⚠️ HUB exploitants :', e.message); }
  finally { enCours = false; }
}

// Appelé par fs25-succes à chaque vérification (15 min)
async function traiter(st, annonces) {
  const montees = N.actualiser(st);
  if (annonces && montees.length) {
    await annonces.send({
      content: montees.map(m => '⭐ **' + m.farm.name + '** passe **niveau ' + m.a + '** !  (+' + (m.a - m.de) + ' point' + (m.a - m.de > 1 ? 's' : '') + ' d\'activité)').join('\n'),
      allowedMentions: { parse: [] },
    }).catch(e => console.warn('⚠️ Annonce de niveau :', e.message));
  }
  await maj();
}

// ── Interactions ──────────────────────────────────────────────────────────────
const rep = (i, payload) => i.isStringSelectMenu() || /^nv_(oui|non)/.test(i.customId) ? i.update({ natif: true, content: '', embeds: [], components: [], ...payload }) : i.reply({ natif: true, ...payload, flags: 64 });
const estStaff = i => i.member?.permissions?.has(PermissionFlagsBits.Administrator) || require('../moderation/tickets').estSupport(i.member);

// Fermes proposées au joueur : celles qui portent le nom de son exploitation, sinon toutes (le staff valide)
function fermesDuJoueur(uid, st) {
  const noms = exp.getAll().filter(e => exp.memberIds(e).includes(uid)).map(e => e.nom.toLowerCase());
  const toutes = st.farms.filter(f => !N.estForet(f));
  const siennes = toutes.filter(f => noms.includes(f.name.trim().toLowerCase()));
  return siennes.length ? siennes : toutes;
}

const selectFerme = (genre, fermes) => new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder().setCustomId('nv_ferme_' + genre).setPlaceholder('🌾 Choisis ton exploitation')
    .addOptions(fermes.slice(0, 25).map(f => ({ label: f.name.slice(0, 100), value: String(f.id) }))));

const groupes = [...new Set(C.ACTIVITES.map(a => a.groupe))];

// cat = index de la catégorie choisie (null : seulement le menu des catégories)
function selectsActivites(farm, cat = null) {
  const f = N.lire(farm), p = N.points(f);
  const menuCat = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('nv_cat_' + farm.id).setPlaceholder('📂 Sélectionner une catégorie')
      .addOptions(groupes.map((g, k) => ({ label: g.replace(/^S+s/, ''), value: String(k), emoji: g.split(' ')[0], default: k === cat }))));
  const libres = cat === null ? [] : C.ACTIVITES.filter(a => a.groupe === groupes[cat] && !f.activites.includes(a.id));
  const menuAct = cat !== null && new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('nv_achat_' + farm.id).setPlaceholder(libres.length ? '🛒 Sélectionner une activité' : 'Toutes les activités de cette catégorie sont possédées')
      .setDisabled(!libres.length)
      .addOptions(libres.length ? libres.map(a => ({
        label: (a.nom + ' · ' + a.cout + ' pt' + (a.cout > 1 ? 's' : '')).slice(0, 100), value: a.id, emoji: a.emoji, description: a.res.slice(0, 100),
      })) : [{ label: '—', value: 'aucune' }]));
  const pts = n => '💠 **' + n + ' pt' + (n > 1 ? 's' : '') + '**';
  const lignes = [];
  let groupe = '';
  for (const a of C.ACTIVITES) {
    if (a.groupe !== groupe) { groupe = a.groupe; lignes.push('## ' + groupe); }
    lignes.push((f.activites.includes(a.id) ? '✅ ' : '') + '**' + a.nom + '** · ' + a.res + ' — ' + pts(a.cout));
  }
  lignes.push('## 🌲 Forêt ( Association )', ...C.FORET_ACTIVITES.map(([n, r]) => '**' + n + '** · ' + r + ' — _Association, non achetable_'));
  lignes.push('', '## 🏭 Industrie : monte en niveau, débloque des usines !',
    ...C.NIVEAUX_INDUSTRIE.map((n, k) => '**Nv ' + (k + 1) + ' · ' + n + '** → ' + (k + 1) + ' usine' + (k ? 's' : '') + ' — ' + pts(C.coutUsines(k + 1)) + ' au total'));
  return {
    content: 'Sélectionne une catégorie, puis une activité.',
    embeds: [{
      title: '🛒 Activités à acheter · ' + farm.name,
      description: 'Points disponibles : **' + p.dispo + '**  ·  ✅ = déjà possédée\n' + lignes.join('\n'),
      color: 0x2ECC71,
    }],
    components: [menuCat, menuAct].filter(Boolean),
  };
}

async function demander(i, farm, genre, actId) {
  const f = N.lire(farm), p = N.points(f);
  const act = actId && C.parId[actId];
  const cout = act ? act.cout : f.usines + 2;
  const quoi = act ? act.emoji + ' ' + act.nom : '🏭 Usine n°' + (f.usines + 1);
  if (act && f.activites.includes(actId)) return rep(i, { content: '❌ Ton exploitation possède déjà cette activité.' });
  if (cout > p.dispo) return rep(i, { content: '❌ Il te faut **' + cout + ' pts** pour ' + quoi + ', tu en as **' + p.dispo + '**.' });
  const db = N.db();
  if (Object.values(db.demandes).some(d => d.statut === 'attente' && d.farmId === farm.id && d.quoi === (actId || 'usine')))
    return rep(i, { content: '⏳ Une demande identique est déjà en attente du staff.' });

  await (i.isStringSelectMenu() || i.customId.startsWith('nv_oui_') ? i.deferUpdate() : i.deferReply({ flags: 64 }));
  let ticket;
  try {
    ticket = await require('../moderation/tickets').ouvrirSalon(i.guild, i.member, {
      prefix: 'achat', objet: 'Achat d\'exploitation', welcome: 'Ta demande d\'achat est juste en dessous. Le staff la traite dans ce salon.',
    });
  } catch (e) {
    console.error('⚠️ Achat — ticket :', e.message);
    return i.editReply({ content: '⚠️ Impossible d\'ouvrir le ticket. Préviens un administrateur.', components: [] });
  }
  const n = db.next++;
  db.demandes[n] = { userId: i.user.id, farmId: farm.id, quoi: actId || 'usine', cout, statut: 'attente' };
  N.save();
  await ticket.send({
    ...panneau({ embeds: [{
      title: '🛒 Demande d\'achat n°' + n,
      description: '<@' + i.user.id + '> demande **' + quoi + '** pour **' + farm.name + '**.',
      fields: [
        { name: 'Coût', value: cout + ' pt' + (cout > 1 ? 's' : ''), inline: true },
        { name: 'Points disponibles', value: String(p.dispo), inline: true },
      ],
      color: 0x5865F2,
    }] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('nv_ok_' + n).setLabel('✅ Valider').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('nv_no_' + n).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
    )],
    allowedMentions: { parse: [] },
  });
  const texte = '✅ Demande transmise au staff : <#' + ticket.id + '>';
  await i.editReply({ content: texte, components: [] });
}

async function decider(i) {
  if (!estStaff(i)) return i.reply({ content: '❌ Réservé au staff.', flags: 64 });
  const [, oui, num] = i.customId.match(/^nv_(ok|no)_(\d+)$/);
  const d = N.db().demandes[num];
  if (!d || d.statut !== 'attente') return i.reply({ content: 'ℹ️ Demande déjà traitée.', flags: 64 });
  const st = status();
  const farm = st?.farms.find(f => f.id === d.farmId);
  if (!farm) return i.reply({ content: '⏳ Données FS25 indisponibles, réessaie dans une minute.', flags: 64 });

  let note = '';
  if (oui === 'ok') {
    const f = N.fiche(farm);
    if (d.quoi !== 'usine' && f.activites.includes(d.quoi)) note = 'déjà possédée';
    else if (d.cout > N.points(f).dispo) note = 'points insuffisants (' + N.points(f).dispo + ' dispo)';
    else if (d.quoi === 'usine') f.usines += 1; else f.activites.push(d.quoi);
    if (note) return i.reply({ content: '❌ Validation impossible : ' + note + '.', flags: 64 });
  }
  d.statut = oui === 'ok' ? 'valide' : 'refuse';
  d.par = i.user.id;
  N.save();
  await i.update({ components: [], content: (oui === 'ok' ? '✅ Validé' : '❌ Refusé') + ' par <@' + i.user.id + '> · <@' + d.userId + '>', allowedMentions: { users: [d.userId] } });
  await maj();
}

async function handle(i) {
  const id = i.customId;
  const st = status();
  try {
    if (/^nv_(ok|no)_\d+$/.test(id)) return await decider(i);
    if (!st) return i.reply({ content: '⏳ Pas encore de données du serveur FS25, réessaie dans une minute.', flags: 64 });

    if (id === 'nv_class') {
      const lignes = N.classement(st).map((x, k) => (['🥇', '🥈', '🥉'][k] || '`' + (k + 1) + '.`') + ' **' + x.farm.name + '** · niv. ' + x.f.niveau + ' · ' + x.f.score + ' succès');
      return i.reply({ natif: true, ...panneau({ embeds: [{ title: '📊 Classement des exploitations', description: lignes.join('\n') || '_Aucune exploitation._', color: 0xF1C40F }] }), flags: 64 });
    }

    // Boutons / menus qui commencent par choisir une ferme
    let genre = { nv_succes: 'succes', nv_act: 'act', nv_usine: 'usine' }[id];
    let farm;
    if (genre) {
      const fermes = fermesDuJoueur(i.user.id, st);
      if (!fermes.length) return i.reply({ content: '❌ Aucune exploitation trouvée.', flags: 64 });
      if (fermes.length > 1) return i.reply({ content: 'Pour quelle exploitation ?', components: [selectFerme(genre, fermes)], flags: 64 });
      farm = fermes[0];
    } else if (id.startsWith('nv_ferme_')) {
      genre = id.slice(9);
      farm = st.farms.find(f => String(f.id) === i.values[0]);
    } else if (/^nv_(cat|achat|oui)_/.test(id)) {
      farm = st.farms.find(f => String(f.id) === id.split('_')[2]);
      if (!farm) return;
      if (id.startsWith('nv_cat_')) return await rep(i, selectsActivites(farm, Number(i.values[0])));
      if (id.startsWith('nv_oui_')) return await demander(i, farm, 'act', id.split('_')[3]);
      // activité choisie : confirmation Oui / Non
      const a = C.parId[i.values[0]];
      return await i.update({
        content: 'Voulez-vous choisir cette activité ?\n' + a.emoji + ' **' + a.nom + '** · 💠 **' + a.cout + ' pt' + (a.cout > 1 ? 's' : '') + '** pour **' + farm.name + '**',
        embeds: [],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('nv_oui_' + farm.id + '_' + a.id).setLabel('Oui').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('nv_non').setLabel('Non').setStyle(ButtonStyle.Danger),
        )],
      });
    } else if (id === 'nv_non') {
      return await i.update({ content: 'Achat annulé.', embeds: [], components: [] });
    }
    if (!farm) return i.reply({ content: '⏳ Ferme introuvable.', flags: 64 });

    if (genre === 'succes') return rep(i, { embeds: [require('./fs25-succes').progressEmbed(farm, st)] });
    if (genre === 'usine') return await demander(i, farm, 'usine', null);
    return rep(i, selectsActivites(farm));
  } catch (e) {
    console.error('Erreur HUB exploitants :', e.stack || e.message);
  }
}

module.exports = { init: c => { client = c; }, traiter, maj, handle };
