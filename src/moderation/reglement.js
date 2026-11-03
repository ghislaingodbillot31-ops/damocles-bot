const { panneau } = require('../core/embed-format');

// Règlement affiché par le bouton « 📜 Règlement » du HUB communautaire (invitations.js).
const REGLES = [
  ['1 · Respect', 'Sois respectueux envers tous. Aucune insulte, harcèlement ou discrimination.', 'Be respectful to everyone. No insults, harassment or discrimination.'],
  ['2 · Contenu · Content', 'Pas de contenu NSFW, choquant ou illégal.', 'No NSFW, shocking or illegal content.'],
  ['3 · Spam & Pub · Ads', 'Pas de spam, flood ni publicité sans autorisation.', 'No spam, flooding or advertising without permission.'],
  ['4 · Salons · Channels', 'Utilise chaque salon pour son usage prévu.', 'Use each channel for its intended purpose.'],
  ['5 · Le jeu · The game', 'Partage tes retours de façon constructive. Les contenus en avant-première restent confidentiels.', 'Share feedback constructively. Early previews must stay confidential.'],
  ['6 · Staff', 'Respecte les décisions du staff. Tout manquement peut être sanctionné.', 'Respect staff decisions. Any violation may lead to sanctions.'],
  ["7 · Discord ToS", "Les conditions d'utilisation de Discord s'appliquent.", "Discord's Terms of Service apply."],
];

const reglementEmbed = () => panneau({ embeds: [{
      title: 'RÈGLEMENT · RULES',
      description: [
        ...REGLES.flatMap(([titre, fr, en]) => ['## ' + titre, '🇫🇷 ' + fr, '🇬🇧 ' + en]),
        'https://discord.com/terms',
      ].join('\n'),
      color: 0x00E5FF,
      footer: { text: 'MonCopainBot' },
    }] });

module.exports = { reglementEmbed };
