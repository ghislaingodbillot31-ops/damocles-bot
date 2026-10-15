const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType } = require('discord.js');

const TOKEN    = 'MTUxMDMxMzU3OTExNzY3ODc5NQ.GK9Ri_.OPUfC-BgwPGwhB6WITJsSywLYfcZicm6cTgfjU';
const GUILD_ID = '1208785889849905172';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const sleep = ms => new Promise(r => setTimeout(r, ms));

client.once('ready', async () => {
  console.log('✅ Connecté : ' + client.user.tag);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.error('❌ Serveur introuvable'); process.exit(1); }

  console.log('\n🚀 Création structure VANGUARD — Farming Simulator 25\n');

  // ── RÔLES ──────────────────────────────────────────────────────────────────
  console.log('🎭 Création des rôles...');
  const roles = {};

  const roleDefs = [
    { name: '👑 Fondateur',          color: 0xF1C40F, hoist: true,  permissions: ['Administrator'] },
    { name: '⚙️ Administrateur',     color: 0xE74C3C, hoist: true,  permissions: ['Administrator'] },
    { name: '🛡️ Modérateur',         color: 0xE67E22, hoist: true,  permissions: ['ManageMessages','KickMembers','BanMembers'] },
    { name: '🔧 Staff',              color: 0x3498DB, hoist: true,  permissions: [] },
    { name: '🌟 VIP',                color: 0xF39C12, hoist: false, permissions: [] },
    { name: '🎮 Joueur FS25',        color: 0x2ECC71, hoist: true,  permissions: [] },
    { name: '🚜 Agriculteur',        color: 0x27AE60, hoist: false, permissions: [] },
    { name: '🏭 Entrepreneur',       color: 0x16A085, hoist: false, permissions: [] },
    { name: '🤝 Partenaire',         color: 0x9B59B6, hoist: false, permissions: [] },
    { name: '✅ Membre vérifié',     color: 0x2ECC71, hoist: false, permissions: [] },
    { name: '📜 Règlement accepté',  color: 0x3498DB, hoist: false, permissions: [] },
    { name: '⏳ En attente',         color: 0x95A5A6, hoist: false, permissions: [] },
    { name: '🔍 Vérification',       color: 0xF39C12, hoist: false, permissions: [] },
    { name: '🟡 Inactif',            color: 0xF39C12, hoist: false, permissions: [] },
    { name: '🎫 Support',            color: 0x5865F2, hoist: false, permissions: [] },
  ];

  for (const r of roleDefs) {
    try {
      const perms = r.permissions.length
        ? r.permissions.reduce((acc, p) => acc | PermissionFlagsBits[p], 0n)
        : 0n;
      const role = await guild.roles.create({
        name: r.name, color: r.color, hoist: r.hoist,
        permissions: perms, reason: 'Setup VANGUARD',
      });
      roles[r.name] = role;
      console.log('  ✅ ' + r.name + ' — ' + role.id);
      await sleep(400);
    } catch (e) { console.error('  ❌ ' + r.name + ' : ' + e.message); }
  }

  // ── CATÉGORIES & SALONS ───────────────────────────────────────────────────
  console.log('\n📁 Création des salons...');
  const createdChannels = {};

  const structure = [
    {
      name: '🔐 SYSTÈME', staffOnly: false,
      channels: [
        { name: '🔍・vérification',     topic: 'Vérification automatique des nouveaux membres' },
        { name: '📜・règlement',         topic: 'Règlement du serveur VANGUARD' },
        { name: '👋・bienvenue',         topic: 'Messages de bienvenue et départ' },
        { name: '📢・annonces',          topic: 'Annonces officielles VANGUARD', readonly: true },
      ]
    },
    {
      name: '💬 GÉNÉRAL', staffOnly: false,
      channels: [
        { name: '💬・général',           topic: 'Discussion générale' },
        { name: '🤣・memes',             topic: 'Memes et humour' },
        { name: '📸・médias',            topic: 'Partage de photos et vidéos' },
        { name: '🎵・musique',           topic: 'Partage musical' },
        { name: '🤖・commandes-bot',     topic: 'Commandes Discord' },
      ]
    },
    {
      name: '🚜 FARMING SIMULATOR 25', staffOnly: false,
      channels: [
        { name: '📢・fs25-annonces',     topic: 'Annonces FS25', readonly: true },
        { name: '💬・fs25-général',      topic: 'Discussion Farming Simulator 25' },
        { name: '🗺️・fs25-maps',         topic: 'Discussion sur les maps' },
        { name: '🔧・fs25-mods',         topic: 'Partage et discussion de mods' },
        { name: '📷・fs25-screenshots',  topic: 'Screenshots et vidéos FS25' },
        { name: '🆘・fs25-entraide',     topic: 'Entraide et questions FS25' },
        { name: '🏆・fs25-exploitations',topic: 'Présentation des exploitations' },
      ]
    },
    {
      name: '🎫 SUPPORT', staffOnly: false,
      channels: [
        { name: '📩・ouvrir-ticket',     topic: 'Ouvrir un ticket de support' },
      ]
    },
    {
      name: '👥 COMMUNAUTÉ', staffOnly: false,
      channels: [
        { name: '🎂・anniversaires',     topic: 'Anniversaires des membres' },
        { name: '🏆・classements',       topic: 'Classements et statistiques' },
        { name: '🤝・partenariats',      topic: 'Informations partenariats', readonly: true },
      ]
    },
    {
      name: '📊 STAFF', staffOnly: true,
      channels: [
        { name: '💬・staff-général',     topic: 'Discussion staff' },
        { name: '📋・staff-logs',        topic: 'Logs du bot Damoclès' },
        { name: '⚠️・staff-alertes',     topic: 'Alertes sécurité' },
        { name: '🖥️・bot-status',        topic: 'Statut du bot' },
      ]
    },
  ];

  for (const cat of structure) {
    try {
      const staffRole = roles['🛡️ Modérateur'];
      const catPerms = cat.staffOnly && staffRole
        ? [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
           { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel] }]
        : [];

      const category = await guild.channels.create({
        name: cat.name, type: ChannelType.GuildCategory,
        permissionOverwrites: catPerms, reason: 'Setup VANGUARD',
      });
      console.log('\n  📁 ' + cat.name + ' — ' + category.id);
      await sleep(400);

      for (const ch of cat.channels) {
        const chPerms = ch.readonly
          ? [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }]
          : [];

        const channel = await guild.channels.create({
          name: ch.name, type: ChannelType.GuildText,
          topic: ch.topic || '', parent: category.id,
          permissionOverwrites: chPerms, reason: 'Setup VANGUARD',
        });
        createdChannels[ch.name] = channel;
        console.log('    #' + ch.name + ' — ' + channel.id);
        await sleep(400);
      }
    } catch (e) { console.error('  ❌ Erreur : ' + e.message); }
  }

  // ── RÉSUMÉ .env ────────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════');
  console.log('✅ STRUCTURE CRÉÉE ! Copie ces IDs dans ton .env :');
  console.log('══════════════════════════════════════════\n');

  const envMap = {
    'VERIFICATION_CHANNEL_ID':  '🔍・vérification',
    'REGLEMENT_CHANNEL_ID':     '📜・règlement',
    'WELCOME_CHANNEL_ID':       '👋・bienvenue',
    'LOG_CHANNEL_ID':           '⚠️・staff-alertes',
    'DAMOCLES_LOG_CHANNEL_ID':  '📋・staff-logs',
    'STATUS_CHANNEL_ID':        '🖥️・bot-status',
    'TICKET_CHANNEL_ID':        '📩・ouvrir-ticket',
  };

  console.log('# Salons');
  for (const [key, name] of Object.entries(envMap)) {
    const ch = createdChannels[name];
    if (ch) console.log(key + '=' + ch.id);
  }

  console.log('\n# Rôles');
  const roleMap = {
    'VERIFICATION_ROLE_ID':     '🔍 Vérification',
    'REGLEMENT_ROLE_ID':        '📜 Règlement accepté',
    'ATTENTE_ROLE_ID':          '⏳ En attente',
    'ACTIVE_ROLE_ID':           '✅ Membre vérifié',
    'INACTIVE_ROLE_ID':         '🟡 Inactif',
    'TICKET_SUPPORT_ROLE_ID':   '🎫 Support',
  };

  for (const [key, name] of Object.entries(roleMap)) {
    const r = roles[name];
    if (r) console.log(key + '=' + r.id);
  }

  console.log('\n# Rôles exclus (staff — ne pas analyser pour inactivité)');
  const excluded = ['👑 Fondateur', '⚙️ Administrateur', '🛡️ Modérateur', '🔧 Staff']
    .map(n => roles[n]?.id).filter(Boolean).join(',');
  console.log('EXCLUDED_ROLE_IDS=' + excluded);

  process.exit(0);
});

client.login(TOKEN);