# Graph Report - Bot dominius  (2026-10-23)

## Corpus Check
- 101 files · ~75,079 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1172 nodes · 2299 edges · 69 communities (64 shown, 5 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 274 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `69363f09`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- scheduled-messages.js
- expulsion.js
- levels.js
- birthday.js
- roles.js
- contrat.js
- hub.js
- boutique.js
- codeverif.js
- bugs.js
- temptext.js
- database.js
- fs25-monitor.js
- tempvoice.js
- src/index.js
- creer
- exploitation.js
- App.jsx
- invitations.js
- dashboard.js
- devDependencies
- verification.js
- welcome.js
- Messages
- statusbot.js
- embed-format.js
- log
- Members
- setup-moncopainbot.js
- purge.js
- tickets.js
- Hubs.jsx
- xp-admin.js
- Exploitations.jsx
- dependencies
- antispam.js
- Dashboard
- antidoublecompte.js
- dataPath
- hub-info.js
- nettoyage.js
- jeu.js
- config.js
- deployer-render.sh
- publier
- restart.js
- jeux.js
- paths.js
- Tickets
- simple.js
- Messages.jsx
- interactions/index.js
- deploy-commands.js
- ajouter-bouton-reglement.js
- invite.js
- README.md
- panneau
- contenu.js
- marche.js
- analyse.js
- runDaily
- Multifruit (phase 1)
- publiclog.js
- test.js
- suggestions.js
- startJeux

## God Nodes (most connected - your core abstractions)
1. `panneau()` - 86 edges
2. `dataPath()` - 26 edges
3. `un()` - 21 edges
4. `agrilog()` - 20 edges
5. `run()` - 20 edges
6. `action()` - 17 edges
7. `publier()` - 17 edges
8. `creer()` - 17 edges
9. `log()` - 16 edges
10. `nb()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `handleButton()` --calls--> `log()`  [EXTRACTED]
  src/commands/purge.js → src/logger.js
- `execute()` --calls--> `getLastActivity()`  [EXTRACTED]
  src/commands/expulsion.js → src/activity.js
- `runAnalysis()` --calls--> `getMemberStatus()`  [EXTRACTED]
  src/commands/analyse.js → src/activity.js
- `runAnalysis()` --calls--> `getDaysInactive()`  [EXTRACTED]
  src/commands/analyse.js → src/activity.js
- `handleDecision()` --calls--> `agrilog()`  [EXTRACTED]
  src/boutique.js → src/agrilog.js

## Import Cycles
- None detected.

## Communities (69 total, 5 thin omitted)

### Community 0 - "scheduled-messages.js"
Cohesion: 0.20
Nodes (19): ref_crypto, clearTimer(), create(), crypto, DATA_PATH, { dataPath }, fs, getAll() (+11 more)

### Community 1 - "expulsion.js"
Cohesion: 0.12
Nodes (17): config, db, getDaysInactive(), getLastActivity(), getMemberStatus(), { inactiveDays: INACTIVE_DAYS, expelDays: EXPEL_DAYS }, _lastSeen, thresholds() (+9 more)

### Community 2 - "levels.js"
Cohesion: 0.06
Nodes (58): levels, { SlashCommandBuilder }, adminAjuster(), adminReset(), announceLevelUp(), backfillFromHistory(), BAREME_PATH, baremeEmbed() (+50 more)

### Community 3 - "birthday.js"
Cohesion: 0.14
Nodes (13): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, BIRTHDAY_CHANNEL_ID, db, enregistrer(), handleModal(), ids, MOIS, { panneau } (+5 more)

### Community 4 - "roles.js"
Cohesion: 0.12
Nodes (23): roles, { SlashCommandBuilder, PermissionFlagsBits }, { ActionRowBuilder, ButtonBuilder, ButtonStyle }, addRoleButton(), buildComponents(), _channel(), { dataPath }, fs (+15 more)

### Community 5 - "contrat.js"
Cohesion: 0.10
Nodes (42): agrilog(), ids, LOG_CHANNEL, ackSansData(), { agrilog }, autoClean(), boutonsDispo(), canDecide() (+34 more)

### Community 6 - "hub.js"
Cohesion: 0.08
Nodes (37): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  PermissionFlagsBits,
}, ACTIVITES, { agrilog }, autoClean(), canManage(), exp, EXPLOITANT_ROLE_ID, ficheAnnuaire() (+29 more)

### Community 7 - "boutique.js"
Cohesion: 0.10
Nodes (36): adminRoles(), { agrilog }, autoClean(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, cooldownRestant(), createRequest(), { dataPath }, decisionRow() (+28 more)

### Community 8 - "codeverif.js"
Cohesion: 0.11
Nodes (30): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, cleanup(), codeChannel(), codes, crypto, { dataPath }, db, flash() (+22 more)

### Community 9 - "bugs.js"
Cohesion: 0.13
Nodes (29): autoClean(), bugPayload(), copier(), { dataPath }, derniere, EN_DM, estAdmin(), fs (+21 more)

### Community 10 - "temptext.js"
Cohesion: 0.13
Nodes (27): autoClean(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, controlRow(), creerSalon(), { dataPath }, dernierMessage(), fs, handleTextControl() (+19 more)

### Community 11 - "database.js"
Cohesion: 0.14
Nodes (28): addWarning(), banMember(), cleanDatabase(), { dataPath, REPO_DATA }, DB_PATH, estVisible(), fs, getAbsentMembers() (+20 more)

### Community 12 - "fs25-monitor.js"
Cohesion: 0.19
Nodes (14): ref_http, fetchStats(), formatUptime(), FS25_PORT, http, ids, NOTIF_CHANNEL, { panneauEmbed } (+6 more)

### Community 13 - "tempvoice.js"
Cohesion: 0.13
Nodes (28): autoClean(), cacherAuxAutres(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, controlRow(), { dataPath }, ensurePanels(), fs, handleVoiceControl() (+20 more)

### Community 14 - "src/index.js"
Cohesion: 0.07
Nodes (27): { annoncerArrivee, sendWelcomeAfterReglement, sendJoinDM, sendLeave }, boutique, { checkNewMember }, { checkSpam, checkLinks }, client, { Client, GatewayIntentBits, Partials, Events }, contrat, { createDashboard, setClient } (+19 more)

### Community 15 - "creer"
Cohesion: 0.26
Nodes (17): creer(), autoClean(), estAdmin(), handleSuggDecision(), handleSuggDecisionModal(), handleSuggModal(), handleSuggNew(), installerHub() (+9 more)

### Community 16 - "exploitation.js"
Cohesion: 0.17
Nodes (22): addCoExploitant(), addOuvrier(), createExploitation(), { dataPath }, DB_PATH, deleteExploitation(), fs, getAll() (+14 more)

### Community 17 - "App.jsx"
Cohesion: 0.21
Nodes (6): App(), dashboard_src_index, Config(), FIELDS, Login(), Logs()

### Community 18 - "invitations.js"
Cohesion: 0.13
Nodes (18): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType }, { dataPath }, fs, handleInviteButton(), handleRolesButton(), handleRoleToggle(), HUB_CHANNEL, ids (+10 more)

### Community 19 - "dashboard.js"
Cohesion: 0.16
Nodes (17): { ChannelType }, construire(), createDashboard(), crypto, { dataPath }, embeds, express, find() (+9 more)

### Community 20 - "devDependencies"
Cohesion: 0.08
Nodes (24): autoprefixer, dependencies, react, react-dom, react-router-dom, devDependencies, autoprefixer, postcss (+16 more)

### Community 21 - "verification.js"
Cohesion: 0.18
Nodes (15): db, execute(), { SlashCommandBuilder, PermissionFlagsBits }, { verifyMember }, { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, db, handleVerifRefButton(), handleVerifyButton() (+7 more)

### Community 22 - "welcome.js"
Cohesion: 0.18
Nodes (15): annoncerArrivee(), CONFIG_PATH, { dataPath }, embedArrivee(), fs, getWelcomeConfig(), ids, loadWelcomeConfig() (+7 more)

### Community 23 - "Messages"
Cohesion: 0.27
Nodes (5): Messages(), deleteMsg(), loadAll(), save(), toggleEnabled()

### Community 24 - "statusbot.js"
Cohesion: 0.15
Nodes (19): execute(), construire(), { dataPath }, db, duree(), events(), EVENTS_FILE, fs (+11 more)

### Community 25 - "embed-format.js"
Cohesion: 0.29
Nodes (4): db, { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, SEP

### Community 26 - "log"
Cohesion: 0.27
Nodes (10): checkLinks(), checkRaid(), checkSpam(), estStaff(), EXCLUDED_ROLE_IDS, { log }, memberMessages, recentJoins (+2 more)

### Community 27 - "Members"
Cohesion: 0.24
Nodes (6): ageDays(), fmt(), fmtFull(), Members(), STATUS_COLORS, STATUS_LABELS

### Community 28 - "setup-moncopainbot.js"
Cohesion: 0.14
Nodes (10): CATS, { Client, GatewayIntentBits, ChannelType: T, PermissionFlagsBits: P }, dotenv, EN, env, FORCE, fs, GO (+2 more)

### Community 29 - "purge.js"
Cohesion: 0.21
Nodes (11): collectRange(), { ContextMenuCommandBuilder, PermissionFlagsBits, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle }, dataEnd, dataStart, executeEnd(), executeStart(), handleButton(), key() (+3 more)

### Community 30 - "tickets.js"
Cohesion: 0.18
Nodes (14): { ContextMenuCommandBuilder, ApplicationCommandType, PermissionFlagsBits }, execute(), { postTicketButton }, { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, closeTicket(), config, createTicket(), db (+6 more)

### Community 31 - "Hubs.jsx"
Cohesion: 0.31
Nodes (8): Embed(), fromHex(), Hubs(), publier(), sauver(), styleCls(), STYLES, toHex()

### Community 32 - "xp-admin.js"
Cohesion: 0.27
Nodes (8): BAREME_CLES, baremeSelectRow(), execute(), handleBaremeSelect(), levels, { panneau }, {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, valeurAffichee()

### Community 33 - "Exploitations.jsx"
Cohesion: 0.32
Nodes (5): COULEURS, dateFr(), Exploitations(), Fiche(), toHex()

### Community 34 - "dependencies"
Cohesion: 0.08
Nodes (25): discord.js, dotenv, express, express-session, multer, node-cron, node-fetch, dependencies (+17 more)

### Community 35 - "antispam.js"
Cohesion: 0.18
Nodes (13): { dataPath }, fs, ids, onMessage(), panelPayload(), { panneau }, { PermissionFlagsBits }, { publier } (+5 more)

### Community 36 - "Dashboard"
Cohesion: 0.40
Nodes (3): Dashboard(), load(), runAnalyse()

### Community 37 - "antidoublecompte.js"
Cohesion: 0.60
Nodes (5): checkNewMember(), findSimilarUsername(), { panneau }, sendSuspicionAlert(), usernameSimilarity()

### Community 38 - "dataPath"
Cohesion: 0.18
Nodes (12): config, { dataPath }, db, expl, fs, hubInfo, levels, lire() (+4 more)

### Community 39 - "hub-info.js"
Cohesion: 0.21
Nodes (11): { ActionRowBuilder, ButtonBuilder, ButtonStyle }, buildMessage(), { dataPath }, DEFAUT, fs, get(), handleButton(), { panneau } (+3 more)

### Community 40 - "nettoyage.js"
Cohesion: 0.47
Nodes (5): epurer(), nettoyerTout(), signature(), SOUPLES, STRICTS

### Community 41 - "jeu.js"
Cohesion: 0.15
Nodes (45): transaction(), accepterBon(), acheterCuve(), acheterFruits(), acheterMachine(), action(), ajouter(), ameliorerCuve() (+37 more)

### Community 42 - "config.js"
Cohesion: 0.31
Nodes (8): CONFIG_PATH, { dataPath }, DEFAULT_CONFIG, ensureDataDir(), fs, get(), path, set()

### Community 46 - "publier"
Cohesion: 0.14
Nodes (16): envoyerRapport(), formater(), ICONE, noter(), publier(), tampon, installer(), sansNotif() (+8 more)

### Community 47 - "restart.js"
Cohesion: 0.43
Nodes (7): arretPropre(), config, heureParis(), heureReglee(), prevenir(), redemarrer(), startDailyRestart()

### Community 48 - "jeux.js"
Cohesion: 0.14
Nodes (22): ajouterImages(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, { dataPath }, derniere, dernierMessage(), doublon(), fs, handleModal() (+14 more)

### Community 49 - "paths.js"
Cohesion: 0.20
Nodes (10): ref_fs, ref_path, { DatabaseSync }, { dataPath }, FICHIER, fs, path, fs (+2 more)

### Community 51 - "simple.js"
Cohesion: 0.60
Nodes (4): D, installer(), simple(), simplifier()

### Community 52 - "Messages.jsx"
Cohesion: 0.50
Nodes (3): COLOR_OPTIONS, EMPTY_FORM, INTERVAL_OPTIONS

### Community 53 - "interactions/index.js"
Cohesion: 0.09
Nodes (29): data, executer(), installer(), installerServeur(), jeu, publierClassements(), publierMarche(), SALONS (+21 more)

### Community 54 - "deploy-commands.js"
Cohesion: 0.50
Nodes (3): commands, rest, { REST, Routes }

### Community 59 - "panneau"
Cohesion: 0.07
Nodes (58): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, barre(), execute(), levels, { panneau } (+50 more)

### Community 60 - "contenu.js"
Cohesion: 0.15
Nodes (10): clients, contenants, cuves, DIR, erreurs, fruits, fs, jus (+2 more)

### Community 61 - "marche.js"
Cohesion: 0.22
Nodes (15): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, { dataPath }, fmt(), fs, handleAjouter(), handleMarche(), handleModal(), handleRetirer() (+7 more)

### Community 62 - "analyse.js"
Cohesion: 0.28
Nodes (8): activity, db, EXCLUDED_ROLE_IDS, { panneau }, runAnalysis(), runAuto(), { SlashCommandBuilder, PermissionFlagsBits }, sleep()

### Community 63 - "runDaily"
Cohesion: 0.33
Nodes (7): execute(), { runDaily }, { SlashCommandBuilder, PermissionFlagsBits }, db, refreshMembers(), runDaily(), startDailyTasks()

### Community 64 - "Multifruit (phase 1)"
Cohesion: 0.25
Nodes (7): Ajouter du contenu (sans toucher au code), Base de données propre, Branchement dans le bot, Commandes, Fichiers, Multifruit (phase 1), Règles de la phase 1

### Community 65 - "publiclog.js"
Cohesion: 0.26
Nodes (11): panneauEmbed(), alerteStaff(), { AuditLogEvent }, demarrer(), MODELES, motif(), nom(), { panneauEmbed } (+3 more)

### Community 66 - "test.js"
Cohesion: 0.20
Nodes (8): db, assert, { db }, e, J, J2, lot, V

### Community 67 - "suggestions.js"
Cohesion: 0.25
Nodes (7): { agrilog }, { dataPath }, fs, jeu, mods, { panneau }, {
  PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}

### Community 68 - "startJeux"
Cohesion: 0.60
Nodes (5): panelPayload(), startJeux(), cacherAuxAutres(), salonAccueil(), visiblePar()

## Knowledge Gaps
- **449 isolated node(s):** `name`, `version`, `dev`, `build`, `preview` (+444 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `panneau()` connect `panneau` to `expulsion.js`, `birthday.js`, `hub.js`, `boutique.js`, `codeverif.js`, `bugs.js`, `temptext.js`, `tempvoice.js`, `creer`, `invitations.js`, `dashboard.js`, `welcome.js`, `statusbot.js`, `embed-format.js`, `log`, `tickets.js`, `xp-admin.js`, `antispam.js`, `antidoublecompte.js`, `hub-info.js`, `jeux.js`, `marche.js`, `analyse.js`, `publiclog.js`, `suggestions.js`, `startJeux`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **Why does `dataPath()` connect `dataPath` to `scheduled-messages.js`, `levels.js`, `roles.js`, `contrat.js`, `boutique.js`, `codeverif.js`, `bugs.js`, `temptext.js`, `database.js`, `tempvoice.js`, `creer`, `exploitation.js`, `invitations.js`, `dashboard.js`, `welcome.js`, `statusbot.js`, `antispam.js`, `hub-info.js`, `config.js`, `jeux.js`, `paths.js`, `marche.js`, `suggestions.js`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `log()` connect `log` to `codeverif.js`, `src/index.js`, `statusbot.js`, `purge.js`, `tickets.js`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `panneau()` (e.g. with `embed-format.js` and `panneauEmbed()`) actually correct?**
  _`panneau()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `dev` to the rest of the system?**
  _449 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `expulsion.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12380952380952381 - nodes in this community are weakly interconnected._
- **Should `levels.js` be split into smaller, more focused modules?**
  _Cohesion score 0.059907834101382486 - nodes in this community are weakly interconnected._