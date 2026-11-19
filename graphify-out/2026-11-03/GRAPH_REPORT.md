# Graph Report - Bot dominius  (2026-11-03)

## Corpus Check
- 118 files · ~119,619 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1209 nodes · 2419 edges · 75 communities (68 shown, 7 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 284 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c4302bd2`
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
- commands/index.js
- statusbot.js
- db.js
- expulsion.js
- boutique.js
- paths.js
- scheduled-messages.js
- marche.js
- App.jsx
- verification.js
- creer
- tickets.js
- setup-moncopainbot.js
- antispam.js
- birthday.js
- dataPath
- panneau-sync.test.js
- welcome.js
- purge.js
- ref_discord_js
- hub-info.js
- Members
- Hubs.jsx
- Messages
- config.js
- log
- xp-admin.js
- handleModal
- analyse.js
- panneau
- runDaily
- Exploitations.jsx
- restart.js
- Multifruit (phase 1)
- embed-format.js
- publier
- Dashboard
- niveau.js
- sync-db.js
- nettoyage.js
- antidoublecompte.js
- reglement.js
- test-vues.js
- simple.js
- Messages.jsx
- anniversaire.js
- boutique-admin.js
- bouton.js
- classement.js
- MonCopainBot
- deployer-render.sh
- moderation_roles_postrolesheader

## God Nodes (most connected - your core abstractions)
1. `panneau()` - 91 edges
2. `dataPath()` - 26 edges
3. `agrilog()` - 21 edges
4. `un()` - 21 edges
5. `run()` - 20 edges
6. `creer()` - 17 edges
7. `publier()` - 17 edges
8. `action()` - 17 edges
9. `nb()` - 16 edges
10. `log()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `handleButton()` --calls--> `log()`  [EXTRACTED]
  src/commands/purge.js → src/core/logger.js
- `runAnalysis()` --calls--> `getDaysInactive()`  [EXTRACTED]
  src/commands/analyse.js → src/community/activity.js
- `runAnalysis()` --calls--> `getMemberStatus()`  [EXTRACTED]
  src/commands/analyse.js → src/community/activity.js
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/analyse.js → src/core/embed-format.js
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/banid.js → src/core/embed-format.js

## Import Cycles
- None detected.

## Communities (75 total, 7 thin omitted)

### Community 0 - "temptext.js"
Cohesion: 0.07
Nodes (54): ajouterImages(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, { dataPath }, derniere, dernierMessage(), doublon(), fs, handleModal() (+46 more)

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
Cohesion: 0.08
Nodes (41): ref_basic_ftp, ref_ssh2_sftp_client, ref_stream, panneauEmbed(), allTags(), attrs(), buildEmbed(), cfg() (+33 more)

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
Cohesion: 0.11
Nodes (22): { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags }, afficher(), C, entier(), gerer(), hub(), jeu, ko() (+14 more)

### Community 13 - "devDependencies"
Cohesion: 0.08
Nodes (24): autoprefixer, dependencies, react, react-dom, react-router-dom, devDependencies, autoprefixer, postcss (+16 more)

### Community 14 - "src/index.js"
Cohesion: 0.07
Nodes (27): ref_node_cron, { annoncerArrivee, sendWelcomeAfterReglement, sendJoinDM, sendLeave }, boutique, { checkNewMember }, { checkSpam, checkLinks }, client, { Client, GatewayIntentBits, Partials, Events }, contrat (+19 more)

### Community 15 - "database.js"
Cohesion: 0.16
Nodes (24): addWarning(), banMember(), cleanDatabase(), { dataPath, REPO_DATA }, DB_PATH, estVisible(), fs, getAllMembers() (+16 more)

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
Cohesion: 0.13
Nodes (20): ref_crypto, ref_express, ref_express_session, { ChannelType }, construire(), createDashboard(), crypto, { dataPath } (+12 more)

### Community 20 - "commands/index.js"
Cohesion: 0.13
Nodes (17): data, executer(), installer(), installerServeur(), jeu, publierClassements(), publierMarche(), SALONS (+9 more)

### Community 21 - "statusbot.js"
Cohesion: 0.16
Nodes (19): execute(), construire(), { dataPath }, db, duree(), events(), EVENTS_FILE, fs (+11 more)

### Community 22 - "db.js"
Cohesion: 0.12
Nodes (15): ref_assert, ref_node_sqlite, { DatabaseSync }, { dataPath }, db, FICHIER, fs, path (+7 more)

### Community 23 - "expulsion.js"
Cohesion: 0.13
Nodes (17): activity, db, EXCLUDED_ROLE_IDS, execute(), handleButton(), { panneau }, queues, sendNext() (+9 more)

### Community 24 - "boutique.js"
Cohesion: 0.16
Nodes (18): { agrilog }, createRequest(), { dataPath }, estAdmin(), exp, fs, getRequest(), handleDecision() (+10 more)

### Community 25 - "paths.js"
Cohesion: 0.17
Nodes (11): ref_fs, { agrilog }, { dataPath }, fs, jeu, mods, { panneau }, {
  PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} (+3 more)

### Community 26 - "scheduled-messages.js"
Cohesion: 0.22
Nodes (18): clearTimer(), create(), crypto, DATA_PATH, { dataPath }, fs, getAll(), load() (+10 more)

### Community 27 - "marche.js"
Cohesion: 0.22
Nodes (17): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, { dataPath }, fmt(), fs, handleAjouter(), handleMarche(), handleModal(), handlePrix() (+9 more)

### Community 28 - "App.jsx"
Cohesion: 0.15
Nodes (6): App(), Config(), FIELDS, Login(), Logs(), Tickets()

### Community 29 - "verification.js"
Cohesion: 0.18
Nodes (15): db, execute(), { SlashCommandBuilder, PermissionFlagsBits }, { verifyMember }, { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, db, handleVerifRefButton(), handleVerifyButton() (+7 more)

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
Cohesion: 0.19
Nodes (11): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, BIRTHDAY_CHANNEL_ID, db, enregistrer(), handleModal(), ids, MOIS, { panneau } (+3 more)

### Community 35 - "dataPath"
Cohesion: 0.18
Nodes (12): dataPath(), config, { dataPath }, db, expl, fs, hubInfo, levels (+4 more)

### Community 36 - "panneau-sync.test.js"
Cohesion: 0.18
Nodes (10): installer(), sansNotif(), assert, { formater }, guild, { imageSteam }, jeux, { publier } (+2 more)

### Community 37 - "welcome.js"
Cohesion: 0.21
Nodes (11): annoncerArrivee(), CONFIG_PATH, { dataPath }, embedArrivee(), fs, getWelcomeConfig(), ids, loadWelcomeConfig() (+3 more)

### Community 38 - "purge.js"
Cohesion: 0.21
Nodes (11): collectRange(), { ContextMenuCommandBuilder, PermissionFlagsBits, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle }, dataEnd, dataStart, executeEnd(), executeStart(), handleButton(), key() (+3 more)

### Community 39 - "ref_discord_js"
Cohesion: 0.18
Nodes (6): ref_discord_js, { ContextMenuCommandBuilder, PermissionFlagsBits, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle }, { SlashCommandBuilder }, commands, rest, { REST, Routes }

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

### Community 44 - "config.js"
Cohesion: 0.27
Nodes (9): ref_path, CONFIG_PATH, { dataPath }, DEFAULT_CONFIG, ensureDataDir(), fs, get(), path (+1 more)

### Community 45 - "log"
Cohesion: 0.33
Nodes (8): execute(), log(), checkLinks(), checkSpam(), estStaff(), EXCLUDED_ROLE_IDS, { log }, memberMessages

### Community 46 - "xp-admin.js"
Cohesion: 0.27
Nodes (8): BAREME_CLES, baremeSelectRow(), execute(), handleBaremeSelect(), levels, { panneau }, {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, valeurAffichee()

### Community 47 - "handleModal"
Cohesion: 0.33
Nodes (10): autoClean(), cooldownRestant(), decisionRow(), demandeEmbed(), formatDuree(), genId(), getPending(), handleEchange() (+2 more)

### Community 48 - "analyse.js"
Cohesion: 0.28
Nodes (8): activity, db, EXCLUDED_ROLE_IDS, { panneau }, runAnalysis(), runAuto(), { SlashCommandBuilder, PermissionFlagsBits }, sleep()

### Community 49 - "panneau"
Cohesion: 0.25
Nodes (8): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, panneau(), handleBoutique(), sendJoinDM(), sendLeave()

### Community 50 - "runDaily"
Cohesion: 0.33
Nodes (7): execute(), { runDaily }, { SlashCommandBuilder, PermissionFlagsBits }, db, refreshMembers(), runDaily(), startDailyTasks()

### Community 51 - "Exploitations.jsx"
Cohesion: 0.32
Nodes (5): COULEURS, dateFr(), Exploitations(), Fiche(), toHex()

### Community 52 - "restart.js"
Cohesion: 0.43
Nodes (7): arretPropre(), config, heureParis(), heureReglee(), prevenir(), redemarrer(), startDailyRestart()

### Community 53 - "Multifruit (phase 1)"
Cohesion: 0.25
Nodes (7): Ajouter du contenu (sans toucher au code), Base de données propre, Branchement dans le bot, Commandes, Fichiers, Multifruit (phase 1), Règles de la phase 1

### Community 54 - "embed-format.js"
Cohesion: 0.29
Nodes (4): db, { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, SEP

### Community 55 - "publier"
Cohesion: 0.43
Nodes (6): envoyerRapport(), formater(), ICONE, noter(), publier(), tampon

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

### Community 61 - "reglement.js"
Cohesion: 0.40
Nodes (5): { ActionRowBuilder, ButtonBuilder, ButtonStyle }, { panneau }, payload(), publier(), REGLES

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
- **453 isolated node(s):** `name`, `version`, `dev`, `build`, `preview` (+448 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `panneau()` connect `panneau` to `temptext.js`, `hub.js`, `fs25-bridge.js`, `vues.js`, `codeverif.js`, `bugs.js`, `evenements.js`, `tempvoice.js`, `invitations.js`, `dashboard.js`, `statusbot.js`, `expulsion.js`, `boutique.js`, `paths.js`, `marche.js`, `creer`, `tickets.js`, `antispam.js`, `birthday.js`, `welcome.js`, `hub-info.js`, `log`, `xp-admin.js`, `handleModal`, `analyse.js`, `embed-format.js`, `niveau.js`, `sync-db.js`, `antidoublecompte.js`, `reglement.js`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `dataPath()` connect `dataPath` to `temptext.js`, `levels.js`, `contrat.js`, `codeverif.js`, `bugs.js`, `tempvoice.js`, `database.js`, `exploitation.js`, `roles.js`, `invitations.js`, `dashboard.js`, `statusbot.js`, `db.js`, `boutique.js`, `paths.js`, `scheduled-messages.js`, `marche.js`, `creer`, `antispam.js`, `welcome.js`, `hub-info.js`, `config.js`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `creer()` connect `creer` to `paths.js`, `dataPath`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `panneau()` (e.g. with `embed-format.js` and `panneauEmbed()`) actually correct?**
  _`panneau()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `dev` to the rest of the system?**
  _453 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `temptext.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06957047791893527 - nodes in this community are weakly interconnected._
- **Should `levels.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06715063520871144 - nodes in this community are weakly interconnected._