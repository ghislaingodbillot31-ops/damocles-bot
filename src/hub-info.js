const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { dataPath } = require('./paths');
const { panneau } = require('./embed-format');

// HUB d'information, publié AU-DESSUS du HUB des exploitants.
// Chaque bouton renvoie au joueur (en privé) un message réglé depuis le dashboard.
const STORE = dataPath('hub-info.json');

const STYLES = {
  Primary: ButtonStyle.Primary, Secondary: ButtonStyle.Secondary,
  Success: ButtonStyle.Success, Danger: ButtonStyle.Danger,
};

const DEFAUT = {
  titre: '📌  EUROAGRI  ·  INFORMATIONS',
  description: 'Tout ce qu\'il faut savoir avant de jouer. Clique sur un bouton pour afficher les détails (visible par toi seul).',
  couleur: 0x3498DB,
  boutons: [
    { key: 'reglement',  actif: true, label: '📜 Règlement',  style: 'Primary',   titre: '📜  Règlement du serveur', message: '', couleur: 0x3498DB, image: '' },
    { key: 'exploitant', actif: true, label: '🌾 Exploitant', style: 'Success',   titre: '🌾  Devenir exploitant',   message: '', couleur: 0x2ECC71, image: '' },
    { key: 'activite',   actif: true, label: '🚜 Activité',   style: 'Secondary', titre: '🚜  Les activités',        message: '', couleur: 0xE67E22, image: '' },
    { key: 'parametre',  actif: true, label: '⚙️ Paramètre',  style: 'Secondary', titre: '⚙️  Paramètres de la partie', message: '', couleur: 0x95A5A6, image: '' },
  ],
};

function get() {
  let saved = {};
  try { if (fs.existsSync(STORE)) saved = JSON.parse(fs.readFileSync(STORE, 'utf-8')); } catch {}
  const boutons = DEFAUT.boutons.map(d => ({ ...d, ...((saved.boutons || []).find(b => b.key === d.key) || {}) }));
  return { ...DEFAUT, ...saved, boutons };
}

// Ne garde que les champs connus, avec les bonnes limites Discord.
function set(input) {
  const cur = get();
  const txt = (v, max, def) => (typeof v === 'string' ? v.slice(0, max) : def);
  const col = (v, def) => (Number.isInteger(v) && v >= 0 && v <= 0xFFFFFF ? v : def);
  const next = {
    titre:       txt(input.titre, 256, cur.titre),
    description: txt(input.description, 4000, cur.description),
    couleur:     col(input.couleur, cur.couleur),
    boutons: cur.boutons.map(b => {
      const n = (input.boutons || []).find(x => x.key === b.key) || {};
      return {
        key:     b.key,
        actif:   typeof n.actif === 'boolean' ? n.actif : b.actif,
        label:   txt(n.label, 80, b.label) || b.label,
        style:   STYLES[n.style] !== undefined ? n.style : b.style,
        titre:   txt(n.titre, 256, b.titre),
        message: txt(n.message, 4000, b.message),
        couleur: col(n.couleur, b.couleur),
        image:   /^https:\/\/\S+$/.test(n.image || '') ? n.image : (n.image === '' ? '' : b.image),
      };
    }),
  };
  fs.writeFileSync(STORE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function buildMessage() {
  const c = get();
  const actifs = c.boutons.filter(b => b.actif);
  return {
    ...panneau({ embeds: [{ title: c.titre, description: c.description, color: c.couleur, footer: { text: 'EUROAGRI · Damoclès Bot' } }] }),
    components: actifs.length ? [new ActionRowBuilder().addComponents(
      actifs.map(b => new ButtonBuilder().setCustomId('hubinfo_' + b.key).setLabel(b.label).setStyle(STYLES[b.style])),
    )] : [],
  };
}

async function handleButton(interaction) {
  const key = interaction.customId.replace('hubinfo_', '');
  const b = get().boutons.find(x => x.key === key);
  if (!b || !b.message.trim()) {
    await interaction.reply({ content: 'ℹ️ Cette rubrique n\'est pas encore renseignée. Reviens bientôt !', flags: 64 });
    return;
  }
  const embed = { title: b.titre || b.label, description: b.message, color: b.couleur, footer: { text: 'EUROAGRI · Damoclès Bot' } };
  if (b.image) embed.image = { url: b.image };
  await interaction.reply({ ...panneau({ embeds: [embed] }), flags: 64 });
}

module.exports = { get, set, buildMessage, handleButton };
