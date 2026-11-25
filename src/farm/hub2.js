const ids = require('../core/ids');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits,
} = require('discord.js');
const { panneau } = require('../core/embed-format');
const exp = require('./exploitation');
const N = require('./niveaux');

// HUB des exploitants : trois messages (HUB, informations, commerce) dans un seul salon, édités en place.
const HUB2_CHANNEL = ids('EXPLOITANTS_HUB_CHANNEL_ID', '1569517803747152033');   // HUB général (boutons)
let client = null;
const status = () => require('./fs25-succes').getStatus();

// ── Affichage ─────────────────────────────────────────────────────────────────

function headPayload(st) {
  return panneau({
    embeds: [{
      title: '🌾  HUB DES EXPLOITANTS',
      description: [
        'Chaque exploitation gagne un **niveau (1 à 20)** avec ses succès.',
        '',
        '> • Un niveau ne baisse jamais.',
        '> • **🛒 Activité** liste les activités du serveur.',
        '',
        '**📊  CLASSEMENT DES EXPLOITATIONS**',
        classement(st),
      ].join('\n'),
      color: 0x2ECC71,
      footer: { text: 'MonCopainBot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hub_expl').setLabel('🌾 Exploitation').setStyle(ButtonStyle.Success), // créer / gérer sa fiche (flux hub.js)
      new ButtonBuilder().setCustomId('nv_succes').setLabel('🏆 Succès').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('nv_act').setLabel('🛒 Activité').setStyle(ButtonStyle.Success),
    ), new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hubinfo_parametre').setLabel(require('./hub-info').get().boutons.find(b => b.key === 'parametre').label).setStyle(ButtonStyle.Secondary), // texte réglé avec /bouton-info
    )],
  });
}

// Classement (niveau puis succès) affiché dans le HUB des exploitants, mis à jour en place à chaque vérification
// Sous chaque ferme : les activités choisies par l'exploitation du même nom (ligne vide si aucune).
const activitesDe = nom => {
  const e = exp.getAll().find(x => x.nom && x.nom.trim().toLowerCase() === nom.trim().toLowerCase());
  const acts = e ? [e.activitePrincipale, e.activiteSecondaire, ...(e.activitesSup || []), e.activiteSupplementaire].filter(Boolean) : [];
  return '\n　↳ ' + (acts.length ? acts.join(' · ') : '*Aucune activité choisie*');
};
const classement = st => N.classement(st).map((x, k) => (['🥇', '🥈', '🥉'][k] || '`' + (k + 1) + '.`') + ' **' + x.farm.name + '** · niv. ' + x.f.niveau + ' · ' + x.f.score + ' succès' + activitesDe(x.farm.name)).join('\n') || '_Aucune exploitation._';

// HUB « Commerce & Contrat » (message séparé) : mêmes boutons et mêmes fonctions que l'ancien HUB des exploitants (hub_* gérés dans index.js).
const commercePayload = () => panneau({
  embeds: [{
    title: '🤝  COMMERCE & CONTRAT',
    description: [
      '📋  **Contrat** · propose tes services ou cherche un joueur',
      '📦  **Besoin** · recherche une matière première',
      '🏪  **Marché** · liste globale des produits en vente',
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

// ── Mise à jour des messages (édition en place) ───────────────────────────────
let enCours = false;
async function maj(st = status(), force = false) {
  if (!client || !st || enCours || require('./hub-unifie').remplace()) return; // HUB unifié en place : l'ancien ne republie plus
  enCours = true;
  try {
    const channel = client.channels.cache.get(HUB2_CHANNEL) || await client.channels.fetch(HUB2_CHANNEL).catch(() => null);
    if (!channel) return;
    const hub = N.db().hub;
    delete hub.listeCanal; hub.farms = {}; // ancien salon « liste des exploitations » supprimé
    const get = id => id ? channel.messages.fetch(id).catch(() => null) : null;

    // Statut FS25 : s'il est dans ce salon, il doit rester EN TÊTE (avant le HUB) et n'est jamais supprimé par le nettoyage
    const bridge = require('./fs25-bridge');
    const stat = bridge.isStatusChannel(channel) ? await bridge.ensureStatusMessage(channel).catch(() => null) : null;
    const [tete, comMsg] = [await get(hub.head), await get(hub.commerce)];
    // ordre : statut (avec les boutons d'information), HUB des exploitants (avec le classement), commerce
    const complet = !force && tete && comMsg && BigInt(tete.id) < BigInt(comMsg.id) && (!stat || BigInt(stat.id) < BigInt(tete.id));

    if (!complet) {
      // Salon dédié : on retire tout ce que le bot y a posté (évite les doublons si les ids connus sont perdus)
      const vus = await channel.messages.fetch({ limit: 100 }).catch(() => new Map());
      for (const m of vus.values()) if (m.author.id === client.user.id && m.id !== stat?.id) await m.delete().catch(() => {});
      delete hub.classement; delete hub.info;
      hub.head = (await channel.send(headPayload(st))).id;
      hub.commerce = (await channel.send(commercePayload())).id;
    } else {
      // panneau retiré de la config (ancien classement / informations) laissé par une ancienne version : supprimé
      const vus = await channel.messages.fetch({ limit: 30 }).catch(() => new Map());
      for (const m of vus.values()) if (m.author.id === client.user.id && ![tete.id, comMsg.id].includes(m.id) && /CLASSEMENT|INFORMATIONS/.test(m.embeds[0]?.title || '') && m.id !== stat?.id) await m.delete().catch(() => {});
      const hh = JSON.stringify(headPayload(st));
      if (hub.headH !== hh) { await tete.edit(headPayload(st)).catch(() => {}); hub.headH = hh; }
      const ch = JSON.stringify(commercePayload());
      if (hub.commerceH !== ch) { await comMsg.edit(commercePayload()).catch(() => {}); hub.commerceH = ch; }
    }
    N.save();
  } catch (e) { console.warn('⚠️ HUB exploitants :', e.message); }
  finally { enCours = false; }
}

// Appelé par fs25-succes à chaque vérification (15 min)
async function traiter(st, annonces) {
  const montees = N.actualiser(st);
  if (false && annonces && montees.length) { // annonces « ⭐ passe niveau » désactivées pour le moment
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
const ACTIVITES_TEXTE = "🚜 **ACTIVITÉS DU SERVEUR — FS25**\n━━━━━━━━━━━━━━\n**ACTIVITÉ 1 AU CHOIX**\n━━━━━━━━━━━━━━\n\n**🌱 CULTURES**\n\n**Céréalier 1**\nBlé, blé d'hiver, orge, orge d'hiver, avoine, maïs grain, sorgho\n\n**Céréalier 2**\nColza, tournesol, soja, moutarde, seigle, triticale, épeautre, radis oléagineux\n\n**Maraîcher 1**\nCarottes, panais, betteraves rouges, pommes de terre\n\n**Maraîcher 2**\nÉpinards, pois, haricots verts, betteraves sucrières\n\n**Tropical 1**\nCanne à sucre\n\n**Tropical 2**\nCoton\n\n**Riziculteur**\nRiz, riz long grain\n\n**Fourrager + Ensileur 1**\nHerbe, foin, herbe de prairie, herbe de champ, trèfle\n\n**Fourrager + Ensileur 2**\nMaïs ensilage, luzerne, ensilage d'herbe, vesce-seigle, seigle vert, couvert fleuri\n\n**🍇 VIGNES**\n\n**Viticulteur**\nRaisin\n\n**🫒 VERGERS**\n\n**Oléiculteur**\nOlives\n\n**🏡 SERRES**\n\n**Culture sous serre 1**\nLégumes\n\n**Culture sous serre 2**\nChampignons\n\n━━━━━━━━━━━━━━\n**ACTIVITÉ 2 AU CHOIX**\n━━━━━━━━━━━━━━\n\n**🐾 ÉLEVAGE**\n\n**500 animaux maximum par espèce**\n\n🐃 Buffles\n🐄 Vaches laitières\n🥩 Vaches à viande\n🐑 Moutons\n🐐 Chèvres\n🐖 Porcs\n🐔 Poules\n🐎 Chevaux\n🐝 Abeilles\n\n━━━━━━━━━━━━━━\n**🌲 FORÊT**\n\nAssociation forestière (peuplier) — activité indépendante, non accessible aux exploitations."; require('../core/ids');

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
    if (id === 'nv_act') i._intro = true; // texte complet : pas d'intro /bouton-info en tête
    if (id === 'nv_act') return await i.reply({ natif: true, ...panneau({ embeds: [{ description: ACTIVITES_TEXTE, color: 0x2ECC71 }] }), flags: 64 });
    if (id === 'nv_marche') return await require('./marche').handleGerer(i);
    if (id === 'nv_usine') return await require('./industrie').afficher(i);
    if (!st) return i.reply({ content: '⏳ Pas encore de données du serveur FS25, réessaie dans une minute.', flags: 64 });

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

module.exports = { init, traiter, maj, handle, classement };
