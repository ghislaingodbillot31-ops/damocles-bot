const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { panneau } = require('./embed-format');

// Règlement affiché dans le salon REGLEMENT_CHANNEL_ID, au style du centre de contrôle.
// Le bouton « J'accepte » est celui géré par index.js (accept_reglement).
const REGLES = [
  ['1 · Respect', 'Sois respectueux envers tous. Aucune insulte, harcèlement ou discrimination.', 'Be respectful to everyone. No insults, harassment or discrimination.'],
  ['2 · Contenu · Content', 'Pas de contenu NSFW, choquant ou illégal.', 'No NSFW, shocking or illegal content.'],
  ['3 · Spam & Pub · Ads', 'Pas de spam, flood ni publicité sans autorisation.', 'No spam, flooding or advertising without permission.'],
  ['4 · Salons · Channels', 'Utilise chaque salon pour son usage prévu.', 'Use each channel for its intended purpose.'],
  ['5 · Le jeu · The game', 'Partage tes retours de façon constructive. Les contenus en avant-première restent confidentiels.', 'Share feedback constructively. Early previews must stay confidential.'],
  ['6 · Staff', 'Respecte les décisions du staff. Tout manquement peut être sanctionné.', 'Respect staff decisions. Any violation may lead to sanctions.'],
  ['7 · Discord ToS', 'Les conditions d\'utilisation de Discord s\'appliquent.', 'Discord\'s Terms of Service apply.'],
];

function payload(nomServeur) {
  return {
    content: '',
    ...panneau({ embeds: [{
      title: 'RÈGLEMENT · RULES',
      description: [
        ...REGLES.flatMap(([titre, fr, en]) => ['## ' + titre, '🇫🇷 ' + fr, '🇬🇧 ' + en]),
        '## Acceptation · Agreement',
        '**Clique sur le bouton ci-dessous pour accepter le règlement.**',
        '**Click the button below to accept the rules.**',
        'https://discord.com/terms',
      ].join('\n'),
      color: 0x00E5FF,
      footer: { text: nomServeur },
    }] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('accept_reglement').setLabel('✅ J\'accepte le règlement · I accept the rules').setStyle(ButtonStyle.Success))],
  };
}

// Édite le message du règlement du bot s'il existe, sinon en publie un
async function publier(client) {
  const channel = await client.channels.fetch(process.env.REGLEMENT_CHANNEL_ID).catch(() => null);
  if (!channel) return console.error('⚠️ Règlement : salon introuvable (REGLEMENT_CHANNEL_ID)');
  const existant = [...(await channel.messages.fetch({ limit: 20 })).values()].find(m => m.author.id === client.user.id && m.embeds.length);
  if (existant) await existant.edit(payload(channel.guild.name));
  else await channel.send(payload(channel.guild.name));
  console.log('📜 Règlement publié (#' + channel.name + ')');
}

module.exports = { publier };
