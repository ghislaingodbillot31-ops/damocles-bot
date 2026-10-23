const fs = require('fs');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { panneau } = require('./embed-format');
const { dataPath } = require('./paths');

// Marché du HUB : chaque joueur ajoute des produits à vendre (nom, quantité, prix, unité).
// La liste est commune, triée par ordre alphabétique, visible en privé via le bouton « Marché ».
const STORE = dataPath('marche.json');
const MAX_PAR_JOUEUR = 25; // limite d'un menu déroulant Discord

const load = () => { try { return JSON.parse(fs.readFileSync(STORE, 'utf-8')); } catch { return []; } };
const save = list => fs.writeFileSync(STORE, JSON.stringify(list, null, 2), 'utf-8');
const nombre = s => Number(String(s).replace(/\s/g, '').replace(',', '.'));
const fmt = n => n.toLocaleString('fr-FR');

function vue(uid) {
  const list = load().sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
  const lignes = list.map(p => `**${p.nom}** — ${fmt(p.quantite)} ${p.unite} · ${fmt(p.prix)} € · <@${p.userId}>`);
  const embed = {
    title: '🏪  LE COIN DES COPAINS  ·  MARCHÉ',
    description: (lignes.join('\n') || '*Aucun produit en vente pour le moment.*').slice(0, 3900),
    color: 0xF1C40F,
    footer: { text: 'MonCopainBot' },
  };
  const rows = [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('marche_ajouter').setLabel('➕ Vendre un produit').setStyle(ButtonStyle.Success),
  )];
  const miens = list.filter(p => p.userId === uid);
  if (miens.length) rows.push(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('marche_retirer').setPlaceholder('🗑️ Retirer un de mes produits')
      .addOptions(miens.map(p => ({ label: `${p.nom} (${fmt(p.quantite)} ${p.unite})`.slice(0, 100), value: p.id }))),
  ));
  return { ...panneau({ embeds: [embed] }), components: rows };
}

const handleMarche = i => i.reply({ ...vue(i.user.id), flags: 64 });

async function handleAjouter(i) {
  if (load().filter(p => p.userId === i.user.id).length >= MAX_PAR_JOUEUR) {
    return i.reply({ content: `❌ Tu as déjà ${MAX_PAR_JOUEUR} produits en vente : retire-en un d'abord.`, flags: 64 });
  }
  const champ = (id, label, ph) => new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(ph).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60),
  );
  await i.showModal(new ModalBuilder().setCustomId('marche_modal').setTitle('Vendre un produit').addComponents(
    champ('nom', 'Nom du produit', 'Blé, Lait, Bottes de paille…'),
    champ('quantite', 'Quantité', '5000'),
    champ('prix', 'Prix (€)', '1200'),
    champ('unite', 'Unité', 'L, kg, t, bottes…'),
  ));
}

async function handleModal(i) {
  const nom = i.fields.getTextInputValue('nom').trim();
  const unite = i.fields.getTextInputValue('unite').trim();
  const quantite = nombre(i.fields.getTextInputValue('quantite'));
  const prix = nombre(i.fields.getTextInputValue('prix'));
  if (!nom || !unite || !(quantite > 0) || !(prix >= 0)) {
    return i.reply({ content: '❌ Quantité et prix doivent être des nombres (ex : 5000 et 1200).', flags: 64 });
  }
  const list = load();
  list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), userId: i.user.id, nom, quantite, prix, unite });
  save(list);
  await i.reply({ ...vue(i.user.id), flags: 64 });
}

async function handleRetirer(i) {
  save(load().filter(p => !(p.id === i.values[0] && p.userId === i.user.id)));
  await i.update(vue(i.user.id));
}

module.exports = { handleMarche, handleAjouter, handleModal, handleRetirer };
