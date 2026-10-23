// Boutons, menus et modales de Multifruit (customId préfixés « mf: »).
const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const jeu = require('../systems/jeu');
const C   = require('../systems/contenu');
const V   = require('../ui/vues');

const ko = msg => { throw new jeu.JeuErreur(msg); };
const modale = (id, titre, champs) => new ModalBuilder().setCustomId(id).setTitle(titre.slice(0, 45)).addComponents(
  champs.map(([cid, label, ph]) => new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(cid).setLabel(label.slice(0, 45)).setPlaceholder(ph || '').setStyle(TextInputStyle.Short).setRequired(true))));
const entier = (i, champ) => {
  const n = Number(String(i.fields.getTextInputValue(champ)).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) ko('Saisis un nombre positif.');
  return n;
};

// Met à jour le message du HUB (composant ou modale venant d'un composant) ou en envoie un nouveau (éphémère).
const afficher = (i, payload) => (i.isMessageComponent() || (i.isModalSubmit() && i.isFromMessage()))
  ? i.update(payload) : i.reply({ ...payload, flags: MessageFlags.Ephemeral });
const hub = (i, notice) => afficher(i, V.vueHub(jeu.etat(i.user.id), notice));
const ouvrirOuErreur = (i, vue, msg) => vue ? afficher(i, vue) : ko(msg);

async function traiter(i) {
  const [cmd, ...a] = i.customId.slice(3).split(':');
  const uid = i.user.id;

  if (i.isButton()) {
    if (cmd === 'ouvrir') return jeu.entreprise(uid) ? hub(i) : i.showModal(modale('mf:creer_modal', 'Créer mon entreprise', [['nom', "Nom de l'entreprise", 'Ex. : Les Vergers du Coin']]));
    if (cmd === 'hub') return hub(i);
    if (cmd.startsWith('info_'))
      return i.reply({ ...{ info_jus: V.vueInfoJus, info_contenants: V.vueInfoContenants, info_machines: V.vueInfoMachines }[cmd](), flags: MessageFlags.Ephemeral });
    if (cmd === 'classement') return i.update(V.panneauClassements());
    const e = () => jeu.etat(uid);
    if (cmd === 'acheter')    return afficher(i, V.vueAchatFruits(e()));
    if (cmd === 'contenants') return afficher(i, V.vueContenants(e()));
    if (cmd === 'usine')      return afficher(i, V.vueUsine(e()));
    if (cmd === 'pressage')   return ouvrirOuErreur(i, V.vuePressage(e()), "Tu n'as aucun fruit en stock : achète-en d'abord.");
    if (cmd === 'bouteille')  return ouvrirOuErreur(i, V.vueBouteille(e()), "Aucune cuve ne contient de jus pour l'instant.");
    if (cmd === 'bon') {
      const msg = jeu.accepterBon(uid, Number(a[0]));
      await i.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return i.message.edit(V.panneauMarche()).catch(() => {});
    }
    if (cmd === 'livrer')     return ouvrirOuErreur(i, V.vueLivraison(e()), "Aucune commande n'est complète pour l'instant.");
    if (cmd === 'vendre')     return ouvrirOuErreur(i, V.vueVente(e()), "Tu n'as aucun produit fini à vendre.");
    if (cmd === 'usine_stock') { const n = jeu.ameliorerStockFruits(uid); return afficher(i, V.vueUsine(jeu.etat(uid), n)); }
  }

  if (i.isStringSelectMenu()) {
    const v = i.values[0];
    if (cmd === 'fruit_sel') {
      const max = jeu.maxAchatFruits(jeu.etat(uid), v);
      if (max < 1) ko('Tu ne peux pas en acheter : stock plein ou fonds insuffisants.');
      return i.showModal(modale(`mf:fruit_qte:${v}`, `Acheter · ${C.fruits[v].nom}`, [['n', `Caisses de ${C.eq.caisse_kg} kg (max ${max})`, String(max)]]));
    }
    if (cmd === 'press_sel') {
      const m = jeu.maxPressage(jeu.etat(uid), v);
      if (m.max <= 0) ko(m.raison);
      return i.showModal(modale(`mf:press_qte:${v}`, `Presser · ${C.fruits[v].nom}`, [['n', `Kilos à presser (max ${m.max} kg)`, String(m.max)]]));
    }
    if (cmd === 'bt_cuve')   return afficher(i, V.vueBouteilleContenant(jeu.etat(uid), v));
    if (cmd === 'bt_cont') {
      const m = jeu.maxBouteille(jeu.etat(uid), a[0], v);
      if (m.max <= 0) ko(m.raison);
      return i.showModal(modale(`mf:bt_qte:${a[0]}:${v}`, 'Mise en bouteille', [['n', `Contenants à remplir (max ${m.max})`, String(m.max)]]));
    }
    if (cmd === 'cont_sel') {
      const max = jeu.maxContenants(jeu.etat(uid), v);
      if (max < 1) ko('Fonds insuffisants.');
      return i.showModal(modale(`mf:cont_qte:${v}`, `Commander · ${C.contenants[v].nom}`, [['n', `Quantité (max ${max} avec tes fonds)`, String(Math.min(max, 50))]]));
    }
    if (cmd === 'livrer_sel') return hub(i, jeu.livrerCommande(uid, Number(v)));
    if (cmd === 'vente_sel') {
      const [j, c] = v.split('|'), max = jeu.maxVente(jeu.etat(uid), j, c);
      if (max < 1) ko("Limite du comptoir atteinte pour aujourd'hui.");
      return i.showModal(modale(`mf:vente_qte:${j}:${c}`, 'Vente au comptoir', [['n', `Quantité à vendre (max ${max})`, String(max)]]));
    }
    if (cmd === 'usine_m' || cmd === 'usine_c') {
      const [mode, id] = v.split(':');
      const msg = cmd === 'usine_m' ? (mode === 'buy' ? jeu.acheterMachine(uid, id) : jeu.ameliorerMachine(uid, id))
                                    : (mode === 'buy' ? jeu.acheterCuve(uid, id) : jeu.ameliorerCuve(uid, Number(id)));
      return afficher(i, V.vueUsine(jeu.etat(uid), msg));
    }
  }

  if (i.isModalSubmit()) {
    if (cmd === 'creer_modal') { jeu.creerEntreprise(uid, i.fields.getTextInputValue('nom')); return hub(i, '🎉 Entreprise créée ! Tu reçois ton capital de départ et une première cuve.'); }
    const n = entier(i, 'n');
    if (cmd === 'fruit_qte')  return hub(i, jeu.acheterFruits(uid, a[0], n));
    if (cmd === 'press_qte')  return hub(i, jeu.lancerPressage(uid, a[0], n));
    if (cmd === 'bt_qte')     return hub(i, jeu.mettreEnBouteille(uid, Number(a[0]), a[1], n));
    if (cmd === 'cont_qte')   return hub(i, jeu.commanderContenants(uid, a[0], n));
    if (cmd === 'vente_qte')  return hub(i, jeu.vendre(uid, a[0], a[1], n));
  }
}

async function gerer(i) {
  try { await traiter(i); }
  catch (err) {
    const joueur = err instanceof jeu.JeuErreur;
    if (!joueur) console.error('Erreur Multifruit :', err.stack || err.message);
    const payload = { content: joueur ? `❌ ${err.message}` : '❌ Une erreur est survenue, réessaie.', flags: MessageFlags.Ephemeral };
    try { await (i.replied || i.deferred ? i.followUp(payload) : i.reply(payload)); } catch {}
  }
}

module.exports = { gerer };
