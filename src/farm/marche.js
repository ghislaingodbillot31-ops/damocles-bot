const fs = require('fs');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { panneau } = require('../core/embed-format');
const { dataPath } = require('../core/paths');

// Marché du HUB : chaque joueur ajoute des produits à vendre (nom, quantité, prix, unité).
// La liste est commune, triée par ordre alphabétique. Deux vues :
// • bouton « Marché » du HUB Commerce & Contrat : liste globale, lecture seule (aucune interaction) ;
// • bouton « Marché » du HUB des exploitants : le joueur gère SES produits (ajouter, modifier entièrement, retirer).
const STORE = dataPath('marche.json');
const MAX_PAR_JOUEUR = 25; // limite d'un menu déroulant Discord

const load = () => { try { return JSON.parse(fs.readFileSync(STORE, 'utf-8')); } catch { return []; } };
const save = list => fs.writeFileSync(STORE, JSON.stringify(list, null, 2), 'utf-8');
// Restauration unique : fusionne marche-seed.json (sans doublon d'id) puis pose un marqueur pour ne jamais ressusciter un produit retiré.
const SEEDED = dataPath('marche.seeded');
if (!fs.existsSync(SEEDED)) {
  try {
    const cur = load(), ids = new Set(cur.map(p => p.id));
    save(cur.concat(JSON.parse(fs.readFileSync(require('path').join(__dirname, 'marche-seed.json'), 'utf-8')).filter(p => !ids.has(p.id))));
    fs.writeFileSync(SEEDED, '1');
  } catch (err) { console.error('⚠️ Marché : restauration impossible :', err.message); }
}
// Transfert de compte : les produits de l'ancien compte passent au nouveau (idempotent).
{ const l = load(); if (l.some(p => p.userId === '231500104844967937')) save(l.map(p => p.userId === '231500104844967937' ? { ...p, userId: '1487197600452055040' } : p)); }
const nombre = s => Number(String(s).replace(/\s/g, '').replace(',', '.'));
const fmt = n => n.toLocaleString('fr-FR');

const MAX_DESC = 3900;

function vue(uid, gerer) {
  const list = load().sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
  const miens = list.filter(p => p.userId === uid);
  if (!gerer) {
    const lignes = list.map(p => `**${p.nom}** — ${fmt(p.quantite)} ${p.unite} · ${fmt(p.prix)} € · <@${p.userId}>`);
    return { ...panneau({ embeds: [{ title: '🏪  LE COIN DES COPAINS  ·  MARCHÉ', description: (lignes.join('\n') || '*Aucun produit en vente pour le moment.*').slice(0, MAX_DESC),
      color: 0xF1C40F, footer: { text: 'MonCopainBot' } }] }), components: [], natif: true };
  }
  const lignes = miens.map(p => `**${p.nom}** — ${fmt(p.quantite)} ${p.unite} · ${fmt(p.prix)} €`);
  const embed = {
    title: '🏪  MES PRODUITS  ·  MARCHÉ',
    description: (lignes.join('\n') || '*Tu n\'as aucun produit en vente. Clique sur **➕ Ajouter un produit**.*').slice(0, MAX_DESC),
    color: 0xF1C40F,
    footer: { text: 'MonCopainBot · la liste globale est dans le HUB Commerce & Contrat' },
  };
  const opts = p => ({ label: `${p.nom} (${fmt(p.quantite)} ${p.unite} · ${fmt(p.prix)} €)`.slice(0, 100), value: p.id });
  const rows = [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('marche_ajouter').setLabel('➕ Ajouter un produit').setStyle(ButtonStyle.Success),
  )];
  if (miens.length) rows.push(
    new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('marche_prix').setPlaceholder('✏️ Modifier un de mes produits').addOptions(miens.map(opts))),
    new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('marche_retirer').setPlaceholder('🗑️ Supprimer un de mes produits').addOptions(miens.map(opts))),
  );
  return { ...panneau({ embeds: [embed] }), components: rows, natif: true };
}

const champ = (id, label, ph, valeur) => {
  const t = new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(ph).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60);
  return new ActionRowBuilder().addComponents(valeur === undefined ? t : t.setValue(valeur));
};

// Modifier un produit : fenêtre pré-remplie avec nom, quantité, prix et unité
async function handlePrix(i) {
  const p = load().find(x => x.id === i.values[0] && x.userId === i.user.id);
  if (!p) return i.update(vue(i.user.id, true));
  await i.showModal(new ModalBuilder().setCustomId(`marche_prixmodal_${p.id}`).setTitle(`Modifier : ${p.nom}`.slice(0, 45)).addComponents(
    champ('nom', 'Nom du produit', 'Blé, Lait…', p.nom),
    champ('quantite', 'Quantité', '5000', String(p.quantite)),
    champ('prix', 'Prix (€)', '1200', String(p.prix)),
    champ('unite', 'Unité', 'L, kg, t, bottes…', p.unite),
  ));
}

function lireChamps(i) {
  const nom = i.fields.getTextInputValue('nom').trim(), unite = i.fields.getTextInputValue('unite').trim();
  const quantite = nombre(i.fields.getTextInputValue('quantite')), prix = nombre(i.fields.getTextInputValue('prix'));
  return !nom || !unite || !(quantite > 0) || !(prix >= 0) ? null : { nom, unite, quantite, prix };
}
const ERREUR = { content: '❌ Quantité et prix doivent être des nombres (ex : 5000 et 1200).', flags: 64 };

async function handlePrixModal(i) {
  const v = lireChamps(i);
  if (!v) return i.reply(ERREUR);
  const id = i.customId.slice('marche_prixmodal_'.length), list = load();
  const p = list.find(x => x.id === id && x.userId === i.user.id);
  if (!p) return i.reply({ content: '❌ Produit introuvable.', flags: 64 });
  Object.assign(p, v);
  save(list);
  await i.reply({ ...vue(i.user.id, true), flags: 64 });
}

// HUB Commerce & Contrat : liste globale en lecture seule
const handleMarche = i => i.reply({ ...vue(i.user.id, false), flags: 64 });
// HUB des exploitants : gestion de mes produits
const handleGerer = i => i.reply({ ...vue(i.user.id, true), flags: 64 });

async function handleAjouter(i) {
  if (load().filter(p => p.userId === i.user.id).length >= MAX_PAR_JOUEUR) {
    return i.reply({ content: `❌ Tu as déjà ${MAX_PAR_JOUEUR} produits en vente : retire-en un d'abord.`, flags: 64 });
  }
  await i.showModal(new ModalBuilder().setCustomId('marche_modal').setTitle('Vendre un produit').addComponents(
    champ('nom', 'Nom du produit', 'Blé, Lait, Bottes de paille…'),
    champ('quantite', 'Quantité', '5000'),
    champ('prix', 'Prix (€)', '1200'),
    champ('unite', 'Unité', 'L, kg, t, bottes…'),
  ));
}

async function handleModal(i) {
  const v = lireChamps(i);
  if (!v) return i.reply(ERREUR);
  const list = load();
  list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), userId: i.user.id, ...v });
  save(list);
  await i.reply({ ...vue(i.user.id, true), flags: 64 });
}

async function handleRetirer(i) {
  save(load().filter(p => !(p.id === i.values[0] && p.userId === i.user.id)));
  await i.update(vue(i.user.id, true));
}

module.exports = { handleMarche, handleGerer, handleAjouter, handleModal, handleRetirer, handlePrix, handlePrixModal };
