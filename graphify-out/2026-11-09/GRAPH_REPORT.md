# Graph Report - Bot dominius  (2026-11-03)

## Corpus Check
- 126 files · ~125,649 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1279 nodes · 2532 edges · 72 communities (68 shown, 4 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 296 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `22cec729`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- temptext.js
- levels.js
- jeu.js
- contrat.js
- hub.js
- fs25-bridge.js
- vues.js
- codeverif.js
- bugs.js
- evenements.js
- tempvoice.js
- dependencies
- interactions/index.js
- devDependencies
- src/index.js
- database.js
- exploitation.js
- roles.js
- invitations.js
- dashboard.js
- jeux.js
- statusbot.js
- db.js
- fs25-succes.js
- boutique.js
- suggestions.js
- scheduled-messages.js
- embed-format.js
- App.jsx
- fs25-succes-hub.js
- creer
- tickets.js
- setup-moncopainbot.js
- antispam.js
- birthday.js
- dataPath
- publier
- panneau
- purge.js
- ref_discord_js
- hub-info.js
- Members
- Hubs.jsx
- Messages
- paths.js
- log
- xp-admin.js
- panneauEmbed
- DiscordBridge.lua
- succes.test.js
- Liste des succès FS25
- Exploitations.jsx
- restart.js
- Multifruit (phase 1)
- sanction.js
- startJeux
- Dashboard
- niveau.js
- sync-db.js
- nettoyage.js
- antidoublecompte.js
- test-vues.js
- simple.js
- Messages.jsx
- bouton.js
- MonCopainBot
- deployer-render.sh
- moderation_roles_postrolesheader

## God Nodes (most connected - your core abstractions)
1. `panneau()` - 91 edges
2. `dataPath()` - 27 edges
3. `agrilog()` - 21 edges
4. `un()` - 21 edges
5. `run()` - 20 edges
6. `creer()` - 17 edges
7. `panneauEmbed()` - 17 edges
8. `publier()` - 17 edges
9. `action()` - 17 edges
10. `nb()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `st()` --calls--> `parseStatus()`  [EXTRACTED]
  test/succes.test.js → src/farm/fs25-bridge.js
- `handleButton()` --calls--> `log()`  [EXTRACTED]
  src/commands/purge.js → src/core/logger.js
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/analyse.js → src/core/embed-format.js
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/banid.js → src/core/embed-format.js
- `execute()` --calls--> `getLastActivity()`  [EXTRACTED]
  src/commands/expulsion.js → src/community/activity.js

## Import Cycles
- None detected.

## Communities (72 total, 4 thin omitted)

### Community 0 - "temptext.js"
Cohesion: 0.13
Nodes (27): autoClean(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, controlRow(), creerSalon(), { dataPath }, dernierMessage(), fs, handleTextControl() (+19 more)

### Community 1 - "levels.js"
Cohesion: 0.07
Nodes (55): adminAjuster(), adminReset(), announceLevelUp(), backfillFromHistory(), BAREME_PATH, baremeEmbed(), baremeTexte(), cacheInvites() (+47 more)

### Community 2 - "jeu.js"
Cohesion: 0.15
Nodes (45): transaction(), accepterBon(), acheterCuve(), acheterFruits(), acheterMachine(), action(), ajouter(), ameliorerCuve() (+37 more)

### Community 3 - "contrat.js"
Cohesion: 0.10
Nodes (43): ackSansData(), { agrilog }, autoClean(), boutonsDispo(), canDecide(), CONTRAT_CHANNEL, contratSession, corpsAnnonce() (+35 more)

### Community 4 - "hub.js"
Cohesion: 0.08
Nodes (37): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  PermissionFlagsBits,
}, ACTIVITES, { agrilog }, autoClean(), canManage(), exp, EXPLOITANT_ROLE_ID, ficheAnnuaire() (+29 more)

### Community 5 - "fs25-bridge.js"
Cohesion: 0.12
Nodes (26): ref_basic_ftp, ref_ssh2_sftp_client, ref_stream, buildEmbed(), cfg(), duration(), { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle }, ensureStatusMessage() (+18 more)

### Community 6 - "vues.js"
Cohesion: 0.18
Nodes (33): { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder }, barre(), bloc(), bouton(), C, CATEGORIES, CLASSEMENTS, duree() (+25 more)

### Community 7 - "codeverif.js"
Cohesion: 0.11
Nodes (30): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, cleanup(), codeChannel(), codes, crypto, { dataPath }, db, flash() (+22 more)

### Community 8 - "bugs.js"
Cohesion: 0.13
Nodes (29): autoClean(), bugPayload(), copier(), { dataPath }, derniere, EN_DM, estAdmin(), fs (+21 more)

### Community 9 - "evenements.js"
Cohesion: 0.12
Nodes (28): actif, { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, attente(), bingoEmbed(), bingoRow(), bingos, bouton(), CHANNEL_ID (+20 more)

### Community 10 - "tempvoice.js"
Cohesion: 0.13
Nodes (28): autoClean(), cacherAuxAutres(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, controlRow(), { dataPath }, ensurePanels(), fs, handleVoiceControl() (+20 more)

### Community 11 - "dependencies"
Cohesion: 0.08
Nodes (25): basic-ftp, discord.js, dotenv, express, express-session, node-cron, dependencies, basic-ftp (+17 more)

### Community 12 - "interactions/index.js"
Cohesion: 0.06
Nodes (39): data, executer(), installer(), installerServeur(), jeu, publierClassements(), publierMarche(), SALONS (+31 more)

### Community 13 - "devDependencies"
Cohesion: 0.08
Nodes (24): autoprefixer, dependencies, react, react-dom, react-router-dom, devDependencies, autoprefixer, postcss (+16 more)

### Community 14 - "src/index.js"
Cohesion: 0.07
Nodes (27): ref_node_cron, { annoncerArrivee, sendWelcomeAfterReglement, sendJoinDM, sendLeave }, boutique, { checkNewMember }, { checkSpam, checkLinks }, client, { Client, GatewayIntentBits, Partials, Events }, contrat (+19 more)

### Community 15 - "database.js"
Cohesion: 0.05
Nodes (56): activity, db, EXCLUDED_ROLE_IDS, { panneau }, runAnalysis(), runAuto(), { SlashCommandBuilder, PermissionFlagsBits }, sleep() (+48 more)

### Community 16 - "exploitation.js"
Cohesion: 0.18
Nodes (19): addCoExploitant(), addOuvrier(), createExploitation(), { dataPath }, DB_PATH, deleteExploitation(), fs, getAll() (+11 more)

### Community 17 - "roles.js"
Cohesion: 0.16
Nodes (21): { ActionRowBuilder, ButtonBuilder, ButtonStyle }, addRoleButton(), buildComponents(), _channel(), { dataPath }, fs, headerEmbed(), ids (+13 more)

### Community 18 - "invitations.js"
Cohesion: 0.13
Nodes (18): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType }, { dataPath }, fs, handleInviteButton(), handleRolesButton(), handleRoleToggle(), HUB_CHANNEL, ids (+10 more)

### Community 19 - "dashboard.js"
Cohesion: 0.14
Nodes (19): ref_express, ref_express_session, { ChannelType }, construire(), createDashboard(), crypto, { dataPath }, embeds (+11 more)

### Community 20 - "jeux.js"
Cohesion: 0.14
Nodes (22): ajouterImages(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, { dataPath }, derniere, dernierMessage(), doublon(), fs, handleModal() (+14 more)

### Community 21 - "statusbot.js"
Cohesion: 0.16
Nodes (18): construire(), { dataPath }, db, duree(), events(), EVENTS_FILE, fs, ids (+10 more)

### Community 22 - "db.js"
Cohesion: 0.12
Nodes (14): ref_node_sqlite, { DatabaseSync }, { dataPath }, db, FICHIER, fs, path, assert (+6 more)

### Community 23 - "fs25-succes.js"
Cohesion: 0.17
Nodes (19): execute(), { recapAll }, { SlashCommandBuilder, PermissionFlagsBits }, bar(), computeUnlocks(), { EmbedBuilder, SlashCommandBuilder }, fmt(), { panneauEmbed } (+11 more)

### Community 24 - "boutique.js"
Cohesion: 0.11
Nodes (31): boutique, { SlashCommandBuilder, PermissionFlagsBits }, { agrilog }, autoClean(), cooldownRestant(), createRequest(), { dataPath }, decisionRow() (+23 more)

### Community 25 - "suggestions.js"
Cohesion: 0.25
Nodes (7): { agrilog }, { dataPath }, fs, jeu, mods, { panneau }, {
  PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}

### Community 26 - "scheduled-messages.js"
Cohesion: 0.20
Nodes (19): ref_crypto, clearTimer(), create(), crypto, DATA_PATH, { dataPath }, fs, getAll() (+11 more)

### Community 27 - "embed-format.js"
Cohesion: 0.07
Nodes (38): db, execute(), { SlashCommandBuilder, PermissionFlagsBits }, { verifyMember }, SEP, {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, { dataPath }, fmt() (+30 more)

### Community 28 - "App.jsx"
Cohesion: 0.15
Nodes (6): App(), Config(), FIELDS, Login(), Logs(), Tickets()

### Community 29 - "fs25-succes-hub.js"
Cohesion: 0.16
Nodes (15): C, { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle }, buildMessage(), { dataPath }, fs, handleSelect(), load(), logUnlocks() (+7 more)

### Community 30 - "creer"
Cohesion: 0.26
Nodes (17): creer(), autoClean(), estAdmin(), handleSuggDecision(), handleSuggDecisionModal(), handleSuggModal(), handleSuggNew(), installerHub() (+9 more)

### Community 31 - "tickets.js"
Cohesion: 0.21
Nodes (14): { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, closeTicket(), config, createTicket(), db, estSupport(), historique(), { log } (+6 more)

### Community 32 - "setup-moncopainbot.js"
Cohesion: 0.14
Nodes (10): CATS, { Client, GatewayIntentBits, ChannelType: T, PermissionFlagsBits: P }, dotenv, EN, env, FORCE, fs, GO (+2 more)

### Community 33 - "antispam.js"
Cohesion: 0.18
Nodes (13): { dataPath }, fs, ids, onMessage(), panelPayload(), { panneau }, { PermissionFlagsBits }, { publier } (+5 more)

### Community 34 - "birthday.js"
Cohesion: 0.14
Nodes (13): birthday, { SlashCommandBuilder }, { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, BIRTHDAY_CHANNEL_ID, db, enregistrer(), handleModal(), ids (+5 more)

### Community 35 - "dataPath"
Cohesion: 0.18
Nodes (12): dataPath(), config, { dataPath }, db, expl, fs, hubInfo, levels (+4 more)

### Community 36 - "publier"
Cohesion: 0.14
Nodes (16): installer(), sansNotif(), envoyerRapport(), formater(), ICONE, noter(), publier(), tampon (+8 more)

### Community 37 - "panneau"
Cohesion: 0.13
Nodes (18): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, panneau(), annoncerArrivee(), CONFIG_PATH, { dataPath } (+10 more)

### Community 38 - "purge.js"
Cohesion: 0.21
Nodes (11): collectRange(), { ContextMenuCommandBuilder, PermissionFlagsBits, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle }, dataEnd, dataStart, executeEnd(), executeStart(), handleButton(), key() (+3 more)

### Community 39 - "ref_discord_js"
Cohesion: 0.13
Nodes (8): ref_discord_js, { ContextMenuCommandBuilder, PermissionFlagsBits, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle }, levels, { SlashCommandBuilder }, { SlashCommandBuilder }, commands, rest, { REST, Routes }

### Community 40 - "hub-info.js"
Cohesion: 0.21
Nodes (11): { ActionRowBuilder, ButtonBuilder, ButtonStyle }, buildMessage(), { dataPath }, DEFAUT, fs, get(), handleButton(), { panneau } (+3 more)

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

### Community 47 - "panneauEmbed"
Cohesion: 0.22
Nodes (12): panneauEmbed(), handleButton(), alerteStaff(), { AuditLogEvent }, demarrer(), MODELES, motif(), nom() (+4 more)

### Community 48 - "DiscordBridge.lua"
Cohesion: 0.21
Nodes (5): DiscordBridge:collectOwned(), DiscordBridge:export(), DiscordBridge:loadMap(), isServer(), safe()

### Community 49 - "succes.test.js"
Cohesion: 0.20
Nodes (11): ref_assert, allTags(), attrs(), firstTag(), parseStatus(), unescapeXml(), assert, { computeUnlocks, _reset } (+3 more)

### Community 50 - "Liste des succès FS25"
Cohesion: 0.22
Nodes (8): 💰 Argent, 🎯 Divers, 🌾 Fourrage, forêt & atelier, Liste des succès FS25, 🏠 Possessions, 🛣️ Route & conduite, 🚜 Travaux des champs, 🐄 Élevage & ruches

### Community 51 - "Exploitations.jsx"
Cohesion: 0.32
Nodes (5): COULEURS, dateFr(), Exploitations(), Fiche(), toHex()

### Community 52 - "restart.js"
Cohesion: 0.43
Nodes (7): arretPropre(), config, heureParis(), heureReglee(), prevenir(), redemarrer(), startDailyRestart()

### Community 53 - "Multifruit (phase 1)"
Cohesion: 0.25
Nodes (7): Ajouter du contenu (sans toucher au code), Base de données propre, Branchement dans le bot, Commandes, Fichiers, Multifruit (phase 1), Règles de la phase 1

### Community 54 - "sanction.js"
Cohesion: 0.50
Nodes (3): db, { panneau }, { SlashCommandBuilder, PermissionFlagsBits }

### Community 55 - "startJeux"
Cohesion: 0.60
Nodes (5): panelPayload(), startJeux(), cacherAuxAutres(), salonAccueil(), visiblePar()

### Community 56 - "Dashboard"
Cohesion: 0.40
Nodes (3): Dashboard(), load(), runAnalyse()

### Community 57 - "niveau.js"
Cohesion: 0.40
Nodes (5): barre(), execute(), levels, { panneau }, { SlashCommandBuilder }

### Community 58 - "sync-db.js"
Cohesion: 0.40
Nodes (5): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, syncDatabase()

### Community 59 - "nettoyage.js"
Cohesion: 0.47
Nodes (5): epurer(), nettoyerTout(), signature(), SOUPLES, STRICTS

### Community 60 - "antidoublecompte.js"
Cohesion: 0.60
Nodes (5): checkNewMember(), findSimilarUsername(), { panneau }, sendSuspicionAlert(), usernameSimilarity()

### Community 62 - "test-vues.js"
Cohesion: 0.33
Nodes (5): { ActionRowBuilder }, e, J, m, V

### Community 63 - "simple.js"
Cohesion: 0.60
Nodes (4): D, installer(), simple(), simplifier()

### Community 64 - "Messages.jsx"
Cohesion: 0.50
Nodes (3): COLOR_OPTIONS, EMPTY_FORM, INTERVAL_OPTIONS

## Knowledge Gaps
- **481 isolated node(s):** `name`, `version`, `dev`, `build`, `preview` (+476 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `panneau()` connect `panneau` to `temptext.js`, `hub.js`, `vues.js`, `codeverif.js`, `bugs.js`, `evenements.js`, `tempvoice.js`, `database.js`, `invitations.js`, `dashboard.js`, `jeux.js`, `statusbot.js`, `boutique.js`, `suggestions.js`, `embed-format.js`, `creer`, `tickets.js`, `antispam.js`, `birthday.js`, `hub-info.js`, `log`, `xp-admin.js`, `panneauEmbed`, `sanction.js`, `startJeux`, `niveau.js`, `sync-db.js`, `antidoublecompte.js`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `dataPath()` connect `dataPath` to `temptext.js`, `levels.js`, `contrat.js`, `codeverif.js`, `bugs.js`, `tempvoice.js`, `database.js`, `exploitation.js`, `roles.js`, `invitations.js`, `dashboard.js`, `jeux.js`, `statusbot.js`, `db.js`, `boutique.js`, `suggestions.js`, `scheduled-messages.js`, `embed-format.js`, `fs25-succes-hub.js`, `creer`, `antispam.js`, `panneau`, `hub-info.js`, `paths.js`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `creer()` connect `creer` to `suggestions.js`, `dataPath`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `panneau()` (e.g. with `embed-format.js` and `panneauEmbed()`) actually correct?**
  _`panneau()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `dev` to the rest of the system?**
  _481 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `temptext.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1349206349206349 - nodes in this community are weakly interconnected._
- **Should `levels.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06715063520871144 - nodes in this community are weakly interconnected._