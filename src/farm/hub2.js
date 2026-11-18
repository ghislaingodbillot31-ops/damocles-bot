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
        'Chaque exploitation gagne un **niveau (1 à 20)** avec ses succès.',
        '',
        '> • Un niveau ne baisse jamais.',
        '> • **🛒 Activité** liste les activités du serveur, **🏭 Industrie** les niveaux d\'industrie.',
        '',
        '📋 La liste des exploitations est dans <#' + LISTE_CHANNEL + '>.',
      ].join('\n'),
      color: 0x2ECC71,
      footer: { text: 'MonCopainBot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hub_expl').setLabel('🌾 Exploitation').setStyle(ButtonStyle.Success), // créer / gérer sa fiche (flux hub.js) : la case du salon liste est mise à jour ensuite
      new ButtonBuilder().setCustomId('nv_succes').setLabel('🏆 Succès').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('nv_act').setLabel('🛒 Activité').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('nv_usine').setLabel('🏭 Industrie').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('nv_class').setLabel('📊 Classement').setStyle(ButtonStyle.Secondary),
    ), new ActionRowBuilder().addComponents(
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

// Fiche de l'exploitation (créée avec le bouton Exploitation) liée à la ferme du jeu par son nom
function ficheExploitation(farm) {
  const e = exp.getAll().find(x => x.nom?.toLowerCase() === farm.name.trim().toLowerCase());
  if (!e) return null;
  const liste = ids => ids?.length ? ids.map(i => '<@' + i + '>').join(' ') : '—';
  const acts = [e.activitePrincipale, e.activiteSecondaire, e.activiteSupplementaire].filter(Boolean).join(' · ') || '—';
  return { id: e.id, couleur: e.couleur, texte: [
    '**Exploitant :** <@' + e.ownerId + '>' + (e.coExploitants?.length ? '  ·  **Co :** ' + liste(e.coExploitants) : ''),
    '**Activités :** ' + acts,
    '**Recrutement :** ' + (e.recrute ? 'OUI' : 'NON') + '  ·  **Ouvriers :** ' + liste(e.ouvriers),
    '**Créée le :** ' + new Date(e.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
  ].join('\n') };
}

function fermePayload(farm) {
  const f = N.lire(farm);
  const suiv = C.PALIERS[f.niveau];
  const prog = suiv === undefined
    ? '**Niveau max** ' + barre(1, 0, 1) + ' ' + f.score
    : barre(f.score, C.PALIERS[f.niveau - 1], suiv) + ' ' + f.score + '/' + suiv;
  const fiche = ficheExploitation(farm);
  return panneau({ embeds: [{
    title: '🌾 ' + farm.name,
    description: '👥 ' + exploitants(farm) + '  ·  ⭐ **Niv. ' + f.niveau + '/20** ' + prog,
    fields: [
      { name: '💰 Solde', value: fmt(farm.money) + ' €', inline: true },
      { name: '🏦 Crédit', value: farm.loan > 0 ? fmt(farm.loan) + ' €' : '—', inline: true },
      { name: '📋 Exploitation', value: (fiche ? fiche.texte : '_Pas encore de fiche : clique sur **🌾 Exploitation** dans le HUB._').slice(0, 1024) },
    ],
    color: fiche?.couleur ?? 0x2ECC71,
  }],
  // Bouton visible de tous mais réservé aux admins (vérifié au clic) ; sans fiche, il sert à désigner le propriétaire
  components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hub_expl_adm_' + (fiche ? fiche.id : 'farm_' + farm.id)).setLabel('⚙️ Admin').setStyle(ButtonStyle.Secondary))],
  allowedMentions: { parse: [] } });
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
      content: montees.map(m => '⭐ **' + m.farm.name + '** passe **niveau ' + m.a + '** !').join('\n'),
      allowedMentions: { parse: [] },
    }).catch(e => console.warn('⚠️ Annonce de niveau :', e.message));
  }
  await maj();
}

// ── Interactions ──────────────────────────────────────────────────────────────
const rep = (i, payload) => i.isStringSelectMenu() ? i.update({ natif: true, content: '', embeds: [], components: [], ...payload }) : i.reply({ natif: true, ...payload, flags: 64 });

// Texte du bouton « Activité » (information seule, aucun achat)
const ACTIVITES_TEXTE = [
  '**🚜 ACTIVITÉS DU SERVEUR — FS25**',
  '━━━━━━━━━━━━━━',
  '**🌱 CULTURES**',
  '🌾 **Céréalier + Oléagineux**',
  'blé, orge, avoine, maïs grain, sorgho, colza, tournesol, soja, moutarde',
  '',
  '🥕 **Maraîcher racines + verts**',
  'carottes, panais, betteraves rouges, pommes de terre, betteraves sucrières, épinards, pois, haricots verts',
  '',
  '🌴 **Tropical**',
  'canne à sucre, coton',
  '',
  '🍚 **Riziculteur**',
  'riz, riz long grain',
  '',
  '🌿 **Fourrager + Ensileur**',
  'herbe, foin, paille, balles enrubannées, maïs ensilage, luzerne, ensilage d\'herbe',
  '━━━━━━━━━━━━━━',
  '**🍇 VIGNES**',
  '🍇 **Viticulteur** · raisin',
  '',
  '**🫒 VERGERS**',
  '🫒 **Oléiculteur** · olives',
  '',
  '**🏡 SERRES**',
  '🍅 **Culture sous serre** · légumes et champignons',
  '━━━━━━━━━━━━━━',
  '**🐾 ÉLEVAGE**',
  '🐃 **Buffles + vaches laitières**',
  '🥩 **Vaches à viande**',
  '🐑 **Moutons + chèvres**',
  '🐖 **Porcs + poules**',
  '🐎 **Équin + abeilles**',
  '━━━━━━━━━━━━━━',
  '**🌲 FORÊT**',
  'Association forestière, activité non accessible aux exploitations',
].join('\n');

// Texte du bouton « Industrie » (information seule)
const INDUSTRIE_TEXTE = [
  "**🏭 NIVEAUX D'INDUSTRIE**",
  "━━━━━━━━━━━━━━",
  "**Nv 1 · Artisan** → 1 usine — 💶 50 000 €",
  "**Nv 2 · Atelier** → 2 usines — 💶 200 000 €",
  "**Nv 3 · Petite entreprise** → 3 usines — 💶 350 000 €",
  "**Nv 4 · PME** → 4 usines — 💶 500 000 €",
  "**Nv 5 · Manufacture** → 5 usines — 💶 650 000 €",
  "**Nv 6 · Industriel** → 6 usines — 💶 800 000 €",
  "**Nv 7 · Groupe industriel** → 7 usines — 💶 950 000 €",
  "**Nv 8 · Grand groupe** → 8 usines — 💶 1 100 000 €",
  "**Nv 9 · Conglomérat** → 9 usines — 💶 1 250 000 €",
  "**Nv 10 · Magnat de l'industrie** → 10 usines — 💶 1 400 000 €",
  "━━━━━━━━━━━━━━",
  "• Chaque niveau se paie **par virement à l'association**",
  "• Le niveau est validé par le staff après réception du virement",
  "• On passe les niveaux dans l'ordre, sans en sauter",
  "• Le prix d'achat des usines dans le jeu reste à votre charge"
].join('\n');

// Fermes proposées au joueur : celles qui portent le nom de son exploitation, sinon toutes
function fermesDuJoueur(uid, st) {
  const noms = exp.getAll().filter(e => exp.memberIds(e).includes(uid)).map(e => e.nom.toLowerCase());
  const toutes = st.farms.filter(f => !N.estForet(f));
  const siennes = toutes.filter(f => noms.includes(f.name.trim().toLowerCase()));
  return siennes.length ? siennes : toutes;
}

const selectFerme = fermes => new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder().setCustomId('nv_ferme_succes').setPlaceholder('🌾 Choisis ton exploitation')
    .addOptions(fermes.slice(0, 25).map(f => ({ label: f.name.slice(0, 100), value: String(f.id) }))));

async function handle(i) {
  const id = i.customId;
  const st = status();
  try {
    if (id === 'nv_act' || id === 'nv_usine') i._intro = true; // texte complet : pas d'intro /bouton-info en tête
    if (id === 'nv_act') return await i.reply({ natif: true, ...panneau({ embeds: [{ description: ACTIVITES_TEXTE, color: 0x2ECC71 }] }), flags: 64 });
    if (id === 'nv_usine') return await i.reply({ natif: true, ...panneau({ embeds: [{ description: INDUSTRIE_TEXTE, color: 0xE67E22 }] }), flags: 64 });
    if (!st) return i.reply({ content: '⏳ Pas encore de données du serveur FS25, réessaie dans une minute.', flags: 64 });

    if (id === 'nv_class') {
      const lignes = N.classement(st).map((x, k) => (['🥇', '🥈', '🥉'][k] || '`' + (k + 1) + '.`') + ' **' + x.farm.name + '** · niv. ' + x.f.niveau + ' · ' + x.f.score + ' succès');
      return i.reply({ natif: true, ...panneau({ embeds: [{ title: '📊 Classement des exploitations', description: lignes.join('\n') || '_Aucune exploitation._', color: 0xF1C40F }] }), flags: 64 });
    }

    let farm;
    if (id === 'nv_succes') {
      const fermes = fermesDuJoueur(i.user.id, st);
      if (!fermes.length) return i.reply({ content: '❌ Aucune exploitation trouvée.', flags: 64 });
      if (fermes.length > 1) return i.reply({ content: 'Pour quelle exploitation ?', components: [selectFerme(fermes)], flags: 64 });
      farm = fermes[0];
    } else if (id === 'nv_ferme_succes') {
      farm = st.farms.find(f => String(f.id) === i.values[0]);
    } else return;
    if (!farm) return i.reply({ content: '⏳ Ferme introuvable.', flags: 64 });
    return rep(i, { embeds: [require('./fs25-succes').progressEmbed(farm, st)] });
  } catch (e) {
    console.error('Erreur HUB exploitants :', e.stack || e.message);
  }
}

// Après chaque clic / menu / formulaire du flux « Exploitation » (hub_expl*), les cases du salon liste sont rafraîchies
function init(c) {
  client = c;
  c.on('interactionCreate', i => {
    if (!String(i.customId || '').startsWith('hub_expl')) return;
    for (const d of [3000, 12000]) setTimeout(() => { maj().catch(() => {}); require('./salon-exploitation').refreshAll(c).catch(() => {}); }, d); // 2 passes : le flux peut finir après la 1re
  });
}

module.exports = { init, traiter, maj, handle };
