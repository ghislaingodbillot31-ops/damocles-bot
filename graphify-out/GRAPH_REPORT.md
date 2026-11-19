# Graph Report - Bot dominius  (2026-11-19)

## Corpus Check
- 122 files · ~136,311 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1383 nodes · 2707 edges · 74 communities (68 shown, 6 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 293 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8a0acbd3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- temptext.js
- levels.js
- association.js
- contrat.js
- hub.js
- fs25-bridge.js
- 🚜 Travaux des champs
- codeverif.js
- bugs.js
- birthday.js
- tempvoice.js
- dependencies
- fs25-succes.js
- devDependencies
- index.js
- database.js
- exploitation.js
- roles.js
- invitations.js
- dashboard.js
- salon-exploitation.js
- statusbot.js
- ref_node_sqlite
- maps.js
- boutique.js
- marche.js
- scheduled-messages.js
- verification.js
- App.jsx
- ids.js
- creer
- tickets.js
- setup-moncopainbot.js
- embed-format.js
- suggestions.js
- admin-api.js
- panneau-sync.test.js
- welcome.js
- purge.js
- bouton-info.js
- hub-info.js
- Members
- Hubs.jsx
- Messages
- paths.js
- log
- xp-admin.js
- ref_discord_js
- DiscordBridge.lua
- hub2.js
- Liste des succès FS25
- Exploitations.jsx
- restart.js
- loto.js
- fs25-data.js
- fs25-succes-hub.js
- Dashboard
- panneau
- publiclog.js
- nettoyage.js
- antidoublecompte.js
- succes.test.js
- dataPath
- Messages.jsx
- publier
- bouton.js
- classement.js
- MonCopainBot
- deployer-render.sh
- moderation_roles_postrolesheader

## God Nodes (most connected - your core abstractions)
1. `panneau()` - 105 edges
2. `dataPath()` - 31 edges
3. `agrilog()` - 25 edges
4. `autoClean()` - 19 edges
5. `publier()` - 19 edges
6. `creer()` - 17 edges
7. `handle()` - 16 edges
8. `panneauEmbed()` - 15 edges
9. `log()` - 15 edges
10. `save()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `st()` --calls--> `parseStatus()`  [EXTRACTED]
  test/succes.test.js → src/farm/fs25-bridge.js
- `handleButton()` --calls--> `log()`  [EXTRACTED]
  src/commands/purge.js → src/core/logger.js
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/analyse.js → src/core/embed-format.js
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/banid.js → src/core/embed-format.js
- `handleContratAccepter()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/contrat.js → src/core/embed-format.js

## Import Cycles
- None detected.

## Communities (74 total, 6 thin omitted)

### Community 0 - "temptext.js"
Cohesion: 0.07
Nodes (54): ajouterImages(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, { dataPath }, derniere, dernierMessage(), doublon(), fs, handleModal() (+46 more)

### Community 1 - "levels.js"
Cohesion: 0.07
Nodes (55): adminAjuster(), adminReset(), announceLevelUp(), backfillFromHistory(), BAREME_PATH, baremeEmbed(), baremeTexte(), cacheInvites() (+47 more)

### Community 2 - "association.js"
Cohesion: 0.10
Nodes (65): actifs(), {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, StringSelectMenuBuilder,
}, adminPanel(), alertes, auTotal(), CHANNEL_ID, clotureElection(), commissionPresident() (+57 more)

### Community 3 - "contrat.js"
Cohesion: 0.07
Nodes (61): ackSansData(), { agrilog }, autoClean(), boutonsDispo(), canDecide(), categorieNego(), CONTRAT_CHANNEL, contratSession (+53 more)

### Community 4 - "hub.js"
Cohesion: 0.10
Nodes (38): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  PermissionFlagsBits,
}, ACTIVITES, { agrilog }, autoClean(), canManage(), exp, EXPLOITANT_ROLE_ID, exploitOuFerme() (+30 more)

### Community 5 - "fs25-bridge.js"
Cohesion: 0.10
Nodes (33): ref_basic_ftp, ref_ssh2_sftp_client, ref_stream, allTags(), attrs(), buildEmbed(), cfg(), duration() (+25 more)

### Community 6 - "🚜 Travaux des champs"
Cohesion: 0.04
Nodes (46): 🐕 Ami des chiens (caresses), 🐝 Apiculteur (ruches), 💰 Argent, 🥚 Aviculteur (œufs), 🟫 Botteleur (bottes), 🛣️ Bouffeur de bitume (km), 🪓 Bûcheron (arbres), 🚛 Camionneur (km) (+38 more)

### Community 7 - "codeverif.js"
Cohesion: 0.11
Nodes (31): ref_crypto, { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, cleanup(), codeChannel(), codes, crypto, { dataPath }, db (+23 more)

### Community 8 - "bugs.js"
Cohesion: 0.13
Nodes (29): autoClean(), bugPayload(), copier(), { dataPath }, derniere, EN_DM, estAdmin(), fs (+21 more)

### Community 9 - "birthday.js"
Cohesion: 0.14
Nodes (13): birthday, { SlashCommandBuilder }, { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, BIRTHDAY_CHANNEL_ID, db, enregistrer(), handleModal(), ids (+5 more)

### Community 10 - "tempvoice.js"
Cohesion: 0.13
Nodes (28): autoClean(), cacherAuxAutres(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, controlRow(), { dataPath }, ensurePanels(), fs, handleVoiceControl() (+20 more)

### Community 11 - "dependencies"
Cohesion: 0.08
Nodes (24): basic-ftp, discord.js, dotenv, express, express-session, node-cron, dependencies, basic-ftp (+16 more)

### Community 12 - "fs25-succes.js"
Cohesion: 0.08
Nodes (36): execute(), { resetSalon, getStatus }, { SlashCommandBuilder, PermissionFlagsBits }, bar(), computeUnlocks(), C, { EmbedBuilder, SlashCommandBuilder }, fmt() (+28 more)

### Community 13 - "devDependencies"
Cohesion: 0.08
Nodes (24): autoprefixer, dependencies, react, react-dom, react-router-dom, devDependencies, autoprefixer, postcss (+16 more)

### Community 14 - "index.js"
Cohesion: 0.07
Nodes (26): ref_node_cron, { annoncerArrivee, sendJoinDM, sendLeave }, boutique, { checkNewMember }, { checkSpam, checkLinks }, client, { Client, GatewayIntentBits, Partials, Events }, contrat (+18 more)

### Community 15 - "database.js"
Cohesion: 0.05
Nodes (56): activity, db, EXCLUDED_ROLE_IDS, { panneau }, runAnalysis(), runAuto(), { SlashCommandBuilder, PermissionFlagsBits }, sleep() (+48 more)

### Community 16 - "exploitation.js"
Cohesion: 0.18
Nodes (20): addCoExploitant(), addOuvrier(), createExploitation(), { dataPath }, DB_PATH, deleteExploitation(), fs, getAll() (+12 more)

### Community 17 - "roles.js"
Cohesion: 0.16
Nodes (21): { ActionRowBuilder, ButtonBuilder, ButtonStyle }, addRoleButton(), buildComponents(), _channel(), { dataPath }, fs, headerEmbed(), ids (+13 more)

### Community 18 - "invitations.js"
Cohesion: 0.12
Nodes (20): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType }, classementPayload(), { dataPath }, fs, handleInviteButton(), handleRolesButton(), handleRoleToggle(), HUB_CHANNEL (+12 more)

### Community 19 - "dashboard.js"
Cohesion: 0.14
Nodes (19): ref_express, ref_express_session, { ChannelType }, construire(), createDashboard(), crypto, { dataPath }, embeds (+11 more)

### Community 20 - "salon-exploitation.js"
Cohesion: 0.10
Nodes (25): ACTIVITES, CHOIX, ELEVAGE, ENGRAIS, LISTE, panneauDroits(), parNom(), payload() (+17 more)

### Community 21 - "statusbot.js"
Cohesion: 0.16
Nodes (18): construire(), { dataPath }, db, duree(), events(), EVENTS_FILE, fs, ids (+10 more)

### Community 23 - "maps.js"
Cohesion: 0.15
Nodes (22): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
}, cartePayload(), { dataPath }, etoiles(), fs, handleDelete(), handleModal(), handleRate() (+14 more)

### Community 24 - "boutique.js"
Cohesion: 0.13
Nodes (29): { agrilog }, autoClean(), cooldownRestant(), createRequest(), { dataPath }, decisionRow(), demandeEmbed(), estAdmin() (+21 more)

### Community 25 - "marche.js"
Cohesion: 0.22
Nodes (17): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, { dataPath }, fmt(), fs, handleAjouter(), handleMarche(), handleModal(), handlePrix() (+9 more)

### Community 26 - "scheduled-messages.js"
Cohesion: 0.22
Nodes (18): clearTimer(), create(), crypto, DATA_PATH, { dataPath }, fs, getAll(), load() (+10 more)

### Community 27 - "verification.js"
Cohesion: 0.18
Nodes (15): db, execute(), { SlashCommandBuilder, PermissionFlagsBits }, { verifyMember }, { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, db, handleVerifRefButton(), handleVerifyButton() (+7 more)

### Community 28 - "App.jsx"
Cohesion: 0.15
Nodes (6): App(), Config(), FIELDS, Login(), Logs(), Tickets()

### Community 29 - "ids.js"
Cohesion: 0.14
Nodes (15): cfg, config, { dataPath }, fs, ids, onMessage(), panelPayload(), { panneau } (+7 more)

### Community 30 - "creer"
Cohesion: 0.31
Nodes (15): creer(), autoClean(), estAdmin(), handleSuggDecision(), handleSuggDecisionModal(), handleSuggModal(), handleSuggNew(), installerHub() (+7 more)

### Community 31 - "tickets.js"
Cohesion: 0.21
Nodes (14): { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, closeTicket(), config, createTicket(), db, estSupport(), historique(), { log } (+6 more)

### Community 32 - "setup-moncopainbot.js"
Cohesion: 0.14
Nodes (10): CATS, { Client, GatewayIntentBits, ChannelType: T, PermissionFlagsBits: P }, dotenv, EN, env, FORCE, fs, GO (+2 more)

### Community 33 - "embed-format.js"
Cohesion: 0.21
Nodes (9): db, { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, SEP, avecIntro(), D, installer(), simple() (+1 more)

### Community 34 - "suggestions.js"
Cohesion: 0.22
Nodes (9): { agrilog }, { dataPath }, fs, ids, jeu, mods, { panneau }, {
  PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} (+1 more)

### Community 35 - "admin-api.js"
Cohesion: 0.18
Nodes (11): config, { dataPath }, db, expl, fs, hubInfo, levels, lire() (+3 more)

### Community 36 - "panneau-sync.test.js"
Cohesion: 0.18
Nodes (10): installer(), sansNotif(), assert, { formater }, guild, { imageSteam }, jeux, { publier } (+2 more)

### Community 37 - "welcome.js"
Cohesion: 0.18
Nodes (12): annoncerArrivee(), CONFIG_PATH, { dataPath }, embedArrivee(), fs, getWelcomeConfig(), ids, loadWelcomeConfig() (+4 more)

### Community 38 - "purge.js"
Cohesion: 0.18
Nodes (12): collectRange(), data, dataEnd, dataStart, executeEnd(), executeStart(), handleButton(), key() (+4 more)

### Community 39 - "bouton-info.js"
Cohesion: 0.33
Nodes (8): CHOIX, enregistrer(), execute(), handleModal(), info, lire(), {
  SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
}, TEXTE

### Community 40 - "hub-info.js"
Cohesion: 0.19
Nodes (13): { ActionRowBuilder, ButtonBuilder, ButtonStyle }, buildMessage(), { dataPath }, DEFAUT, DYN, fs, get(), getIntro() (+5 more)

### Community 41 - "Members"
Cohesion: 0.24
Nodes (6): ageDays(), fmt(), fmtFull(), Members(), STATUS_COLORS, STATUS_LABELS

### Community 42 - "Hubs.jsx"
Cohesion: 0.31
Nodes (8): Embed(), fromHex(), Hubs(), publier(), sauver(), styleCls(), STYLES, toHex()

### Community 43 - "Messages"
Cohesion: 0.27
Nodes (5): Messages(), deleteMsg(), loadAll(), save(), toggleEnabled()

### Community 44 - "paths.js"
Cohesion: 0.18
Nodes (13): ref_fs, ref_path, CONFIG_PATH, { dataPath }, DEFAULT_CONFIG, ensureDataDir(), fs, get() (+5 more)

### Community 45 - "log"
Cohesion: 0.31
Nodes (9): execute(), execute(), log(), checkLinks(), checkSpam(), estStaff(), EXCLUDED_ROLE_IDS, { log } (+1 more)

### Community 46 - "xp-admin.js"
Cohesion: 0.27
Nodes (8): BAREME_CLES, baremeSelectRow(), execute(), handleBaremeSelect(), levels, { panneau }, {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, valeurAffichee()

### Community 47 - "ref_discord_js"
Cohesion: 0.13
Nodes (8): ref_discord_js, boutique, { SlashCommandBuilder, PermissionFlagsBits }, { SlashCommandBuilder }, { SlashCommandBuilder, PermissionFlagsBits }, commands, rest, { REST, Routes }

### Community 48 - "DiscordBridge.lua"
Cohesion: 0.15
Nodes (11): DiscordBridge:collectOwned(), DiscordBridge:export(), DiscordBridge:exportFull(), DiscordBridge:loadMap(), DiscordBridge:trackWork(), farmName(), fillLevels(), isServer() (+3 more)

### Community 49 - "hub2.js"
Cohesion: 0.11
Nodes (22): { Client }, hub, { lireStatutUneFois }, succes, {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits,
}, ACTIVITES_TEXTE, classement(), commercePayload() (+14 more)

### Community 50 - "Liste des succès FS25"
Cohesion: 0.22
Nodes (8): 💰 Argent, 🎯 Divers, 🌾 Fourrage, forêt & atelier, Liste des succès FS25, 🏠 Possessions, 🛣️ Route & conduite, 🚜 Travaux des champs, 🐄 Élevage & ruches

### Community 51 - "Exploitations.jsx"
Cohesion: 0.32
Nodes (5): COULEURS, dateFr(), Exploitations(), Fiche(), toHex()

### Community 52 - "restart.js"
Cohesion: 0.43
Nodes (7): arretPropre(), config, heureParis(), heureReglee(), prevenir(), redemarrer(), startDailyRestart()

### Community 53 - "loto.js"
Cohesion: 0.17
Nodes (22): { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder }, brouillons, { dataPath }, fmt(), fs, GAINS, grilleUI(), handleButton() (+14 more)

### Community 54 - "fs25-data.js"
Cohesion: 0.18
Nodes (12): execute(), { lireDonneesCompletes }, { sectionEmbed }, { SlashCommandBuilder }, attrs(), cache, { EmbedBuilder }, fmt() (+4 more)

### Community 55 - "fs25-succes-hub.js"
Cohesion: 0.23
Nodes (12): panneauEmbed(), { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle }, buildMessage(), fs, handleButton(), handleSelect(), MEDALS, { panneauEmbed } (+4 more)

### Community 56 - "Dashboard"
Cohesion: 0.40
Nodes (3): Dashboard(), load(), runAnalyse()

### Community 57 - "panneau"
Cohesion: 0.12
Nodes (18): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, barre(), execute(), levels, { panneau } (+10 more)

### Community 58 - "publiclog.js"
Cohesion: 0.26
Nodes (10): alerteStaff(), { AuditLogEvent }, demarrer(), MODELES, motif(), nom(), { panneauEmbed }, panneauVerif() (+2 more)

### Community 59 - "nettoyage.js"
Cohesion: 0.47
Nodes (5): epurer(), nettoyerTout(), signature(), SOUPLES, STRICTS

### Community 60 - "antidoublecompte.js"
Cohesion: 0.60
Nodes (5): checkNewMember(), findSimilarUsername(), { panneau }, sendSuspicionAlert(), usernameSimilarity()

### Community 62 - "succes.test.js"
Cohesion: 0.29
Nodes (6): ref_assert, assert, { computeUnlocks, _reset }, { parseStatus }, st(), u

### Community 63 - "dataPath"
Cohesion: 0.33
Nodes (6): dataPath(), { dataPath }, exp, fs, run(), TEMOIN

### Community 64 - "Messages.jsx"
Cohesion: 0.50
Nodes (3): COLOR_OPTIONS, EMPTY_FORM, INTERVAL_OPTIONS

### Community 65 - "publier"
Cohesion: 0.43
Nodes (6): envoyerRapport(), formater(), ICONE, noter(), publier(), tampon

## Knowledge Gaps
- **525 isolated node(s):** `name`, `version`, `dev`, `build`, `preview` (+520 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `panneau()` connect `panneau` to `temptext.js`, `association.js`, `contrat.js`, `hub.js`, `codeverif.js`, `bugs.js`, `birthday.js`, `tempvoice.js`, `database.js`, `invitations.js`, `dashboard.js`, `salon-exploitation.js`, `statusbot.js`, `maps.js`, `boutique.js`, `marche.js`, `ids.js`, `creer`, `tickets.js`, `embed-format.js`, `suggestions.js`, `welcome.js`, `hub-info.js`, `log`, `xp-admin.js`, `hub2.js`, `loto.js`, `fs25-succes-hub.js`, `antidoublecompte.js`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `dataPath()` connect `dataPath` to `temptext.js`, `levels.js`, `association.js`, `contrat.js`, `codeverif.js`, `bugs.js`, `tempvoice.js`, `fs25-succes.js`, `database.js`, `exploitation.js`, `roles.js`, `invitations.js`, `dashboard.js`, `statusbot.js`, `maps.js`, `boutique.js`, `marche.js`, `scheduled-messages.js`, `ids.js`, `creer`, `suggestions.js`, `admin-api.js`, `welcome.js`, `hub-info.js`, `paths.js`, `loto.js`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `publier()` connect `publier` to `temptext.js`, `panneau-sync.test.js`, `tempvoice.js`, `roles.js`, `invitations.js`, `statusbot.js`, `loto.js`, `ids.js`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `panneau()` (e.g. with `embed-format.js` and `panneauEmbed()`) actually correct?**
  _`panneau()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `dev` to the rest of the system?**
  _525 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `temptext.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06957047791893527 - nodes in this community are weakly interconnected._
- **Should `levels.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06715063520871144 - nodes in this community are weakly interconnected._