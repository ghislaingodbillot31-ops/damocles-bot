const {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { panneau } = require('../embed-format');
const levels = require('../levels');

// Clés du barème pilotables via /xp-admin bareme, avec libellé et unité affichés.
// `enMs: true` : la commande prend/affiche des secondes, stockées en ms en interne.
const BAREME_CLES = {
  MESSAGE:       { label: 'Message (XP par message)',           unite: ' XP' },
  MESSAGE_CD_MS: { label: 'Cooldown message',                    unite: ' s', enMs: true },
  IMAGE:         { label: 'Image / screenshot (bonus)',          unite: ' XP' },
  IMAGE_CD_MS:   { label: 'Cooldown image',                      unite: ' s', enMs: true },
  VOICE_PER_MIN: { label: 'Vocal (XP par minute)',               unite: ' XP' },
  INVITE:        { label: 'Invitation (XP)',                     unite: ' XP' },
  INVITE_KEEP:   { label: 'Invitation retenue 7 jours (XP)',     unite: ' XP' },
};

function valeurAffichee(cle) {
  const info   = BAREME_CLES[cle];
  const actuel = levels.XP[cle];
  return info.enMs ? Math.round(actuel / 1000) : actuel;
}

// Menu déroulant : un gain par ligne, avec sa valeur actuelle en description.
function baremeSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('xpadmin_bareme_select')
    .setPlaceholder('Choisir un gain à modifier…')
    .addOptions(Object.entries(BAREME_CLES).map(([value, info]) => ({
      label: info.label,
      value,
      description: 'Actuellement : ' + valeurAffichee(value) + info.unite,
    })));
  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp-admin')
    .setDescription('[ADMIN] Gérer l\'XP des membres')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('ajouter')
      .setDescription('Ajouter (ou retirer avec un négatif) de l\'XP à un membre')
      .addUserOption(o => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('XP à ajouter (négatif pour retirer)').setRequired(true)))
    .addSubcommand(s => s.setName('bareme')
      .setDescription('Voir ou modifier les points d\'XP gagnés par action')
      .addStringOption(o => o.setName('cle').setDescription('Le gain à consulter/modifier').setRequired(false)
        .addChoices(...Object.entries(BAREME_CLES).map(([value, info]) => ({ name: info.label, value }))))
      .addIntegerOption(o => o.setName('valeur').setDescription('Nouvelle valeur (laisser vide pour consulter)').setRequired(false)))
    .addSubcommand(s => s.setName('reset')
      .setDescription('Remettre à zéro l\'XP de TOUT le serveur'))
    .addSubcommand(s => s.setName('backfill')
      .setDescription('Recalcule le classement depuis l\'historique des messages de tous les salons')
      .addIntegerOption(o => o.setName('jours').setDescription('Nombre de jours d\'historique à scanner (défaut 90)').setRequired(false))
      .addIntegerOption(o => o.setName('max_messages').setDescription('Messages max par salon (défaut 8000)').setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ajouter') {
      const membre  = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');
      const r = levels.adminAjuster(membre.id, montant);
      await interaction.reply({
        embeds: [{ description: (montant >= 0 ? '➕ ' : '➖ ') + Math.abs(montant) + ' XP → <@' + membre.id + '>\nNouveau total : **' + r.xp.toLocaleString('fr-FR') + ' XP** (niveau ' + r.level + ')', color: 0x2ECC71 }],
        flags: 64,
      });
      await levels.refreshLeaderboard();
      return;
    }

    if (sub === 'bareme') {
      const cle    = interaction.options.getString('cle');
      const valeur = interaction.options.getInteger('valeur');

      if (!cle) {
        await interaction.reply({
          embeds: [{ title: '🎚️ Barème XP actuel', description: levels.baremeTexte(), color: 0x5865F2 }],
          components: [baremeSelectRow()],
          flags: 64,
        });
        return;
      }

      const info = BAREME_CLES[cle];
      if (valeur === null) {
        const actuel  = levels.XP[cle];
        const affiche = info.enMs ? Math.round(actuel / 1000) : actuel;
        await interaction.reply({ content: '🎚️ **' + info.label + '** = **' + affiche + info.unite + '**', flags: 64 });
        return;
      }

      try {
        const valeurFinale = info.enMs ? valeur * 1000 : valeur;
        levels.setBaremeValeur(cle, valeurFinale);
        await interaction.reply({
          embeds: [{ description: '✅ **' + info.label + '** défini à **' + valeur + info.unite + '**', color: 0x2ECC71 }],
          flags: 64,
        });
      } catch (err) {
        console.error('⚠️ xp-admin bareme :', err.stack || err.message);
        await interaction.reply({ content: '❌ ' + err.message, flags: 64 }).catch(() => {});
        return;
      }
      levels.refreshLeaderboard().catch(err => console.error('⚠️ refreshLeaderboard :', err.stack || err.message));
      return;
    }

    if (sub === 'reset') {
      await interaction.deferReply({ flags: 64 });
      const n = levels.adminReset();
      await levels.refreshLeaderboard();
      await interaction.editReply({ content: '♻️ XP remis à zéro pour **' + n + '** membre(s).' });
      return;
    }

    if (sub === 'backfill') {
      const jours       = interaction.options.getInteger('jours') || 90;
      const maxParSalon = interaction.options.getInteger('max_messages') || 8000;

      await interaction.reply({
        embeds: [{
          description: '⏳ **Recalcul du classement en cours…**\nScan de l\'historique des ' + jours + ' derniers jours.\nÇa peut prendre plusieurs minutes, je mets à jour ce message au fur et à mesure.',
          color: 0xF39C12,
        }],
        flags: 64,
      });

      let dernierEdit = 0;
      const onProgress = async ({ salon, salonsFaits, total, messagesLus }) => {
        const now = Date.now();
        if (now - dernierEdit < 4000) return;       // throttle des éditions
        dernierEdit = now;
        await interaction.editReply({
          embeds: [{
            description: '⏳ **Recalcul en cours…**\n'
              + 'Salons : **' + salonsFaits + '/' + total + '**\n'
              + 'Messages lus : **' + messagesLus.toLocaleString('fr-FR') + '**\n'
              + 'Dernier salon : #' + salon,
            color: 0xF39C12,
          }],
        }).catch(() => {});
      };

      try {
        const res = await levels.backfillFromHistory(interaction.guild, { jours, maxParSalon, onProgress });
        await interaction.editReply(panneau({
          embeds: [{
            title: '✅ Classement recalculé',
            description: [
              '**' + res.salons + '** salons scannés',
              '**' + res.messagesLus.toLocaleString('fr-FR') + '** messages lus (' + res.jours + ' derniers jours)',
              '**' + res.membresCredites + '** membres avec de l\'XP',
              '',
              'Le classement a été republié. Le comptage vocal / invitations continue par-dessus.',
            ].join('\n'),
            color: 0x2ECC71,
          }],
        })).catch(() => {});
      } catch (err) {
        console.error('❌ backfill :', err);
        await interaction.editReply({ content: '❌ Erreur pendant le recalcul : ' + err.message }).catch(() => {});
      }
    }
  },

  // Sélection dans le menu déroulant → ouvre un formulaire pour saisir la nouvelle valeur.
  async handleBaremeSelect(interaction) {
    const cle  = interaction.values[0];
    const info = BAREME_CLES[cle];
    if (!info) {
      await interaction.reply({ content: '❌ Gain inconnu : ' + cle, flags: 64 }).catch(() => {});
      return;
    }

    try {
      const modal = new ModalBuilder().setCustomId('xpadmin_bareme_modal_' + cle).setTitle(info.label.slice(0, 45));
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('valeur')
          .setLabel('Nouvelle valeur' + (info.enMs ? ' (en secondes)' : ' (en XP)'))
          .setStyle(TextInputStyle.Short)
          .setValue(String(valeurAffichee(cle)))
          .setRequired(true)
      ));
      await interaction.showModal(modal);
    } catch (err) {
      console.error('⚠️ xp-admin bareme select :', err.stack || err.message);
      await interaction.reply({ content: '❌ ' + err.message, flags: 64 }).catch(() => {});
    }
  },

  // Validation du formulaire → applique la nouvelle valeur du barème.
  async handleBaremeModal(interaction) {
    const cle  = interaction.customId.replace('xpadmin_bareme_modal_', '');
    const info = BAREME_CLES[cle];
    if (!info) {
      await interaction.reply({ content: '❌ Gain inconnu : ' + cle, flags: 64 }).catch(() => {});
      return;
    }

    const brut   = interaction.fields.getTextInputValue('valeur').trim().replace(',', '.');
    const valeur = Number(brut);
    if (!Number.isFinite(valeur) || valeur < 0) {
      await interaction.reply({ content: '❌ Valeur invalide, entre un nombre positif.', flags: 64 }).catch(() => {});
      return;
    }

    try {
      const valeurFinale = info.enMs ? valeur * 1000 : valeur;
      levels.setBaremeValeur(cle, valeurFinale);
      await interaction.reply({
        embeds: [{ description: '✅ **' + info.label + '** défini à **' + valeur + info.unite + '**', color: 0x2ECC71 }],
        flags: 64,
      });
    } catch (err) {
      console.error('⚠️ xp-admin bareme modal :', err.stack || err.message);
      await interaction.reply({ content: '❌ ' + err.message, flags: 64 }).catch(() => {});
      return;
    }
    // Met à jour le panneau « comment gagner des points » sans bloquer/faire échouer la réponse déjà envoyée.
    levels.refreshLeaderboard().catch(err => console.error('⚠️ refreshLeaderboard :', err.stack || err.message));
  },
};
