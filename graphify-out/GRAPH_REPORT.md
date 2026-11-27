# Graph Report - Bot dominius  (2026-11-27)

## Corpus Check
- 144 files · ~149,528 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1597 nodes · 3009 edges · 90 communities (78 shown, 12 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 324 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6ca5036b`
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
- antispam.js
- creer
- tickets.js
- ressources.js
- embed-format.js
- suggestions.js
- admin-api.js
- publier
- panneau
- purge.js
- farm/hub-unifie.js
- hub-info.js
- Members
- Hubs.jsx
- Messages
- config.js
- antiraid.js
- xp-admin.js
- invite.js
- DiscordBridge.lua
- hub2.js
- Liste des succès FS25
- Exploitations.jsx
- restart.js
- evenements.js
- activites-sup.js
- credit.js
- Dashboard
- 2. Structure du serveur : salons, contenu, actions, code
- droits-texte.js
- nettoyage.js
- antidoublecompte.js
- succes-paliers.js
- paths.js
- fs25-data.js
- succes.test.js
- panneauEmbed
- publiclog.js
- niveau.js
- MonCopainBot
- deployer-render.sh
- sync-db.js
- moderation_roles_postrolesheader
- jeux.js
- bouton-info.js
- succes-base.js
- deploy-commands.js
- startJeux
- Tickets
- Messages.jsx
- creer-classement.js
- etat-salons.js
- purge-ancien.js
- structure.js
- vider-panneaux.js
- parseBrut
- boutique-admin.js

## God Nodes (most connected - your core abstractions)
1. `panneau()` - 107 edges
2. `dataPath()` - 40 edges
3. `agrilog()` - 25 edges
4. `autoClean()` - 19 edges
5. `publier()` - 18 edges
6. `creer()` - 17 edges
7. `save()` - 17 edges
8. `safe()` - 15 edges
9. `panneauEmbed()` - 15 edges
10. `log()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `st()` --calls--> `parseStatus()`  [EXTRACTED]
  test/succes.test.js → src/farm/fs25-bridge.js
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/analyse.js → src/core/embed-format.js
- `execute()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/banid.js → src/core/embed-format.js
- `handleContratAccepter()` --calls--> `panneau()`  [EXTRACTED]
  src/commands/contrat.js → src/core/embed-format.js
- `execute()` --calls--> `getLastActivity()`  [EXTRACTED]
  src/commands/expulsion.js → src/community/activity.js

## Import Cycles
- None detected.

## Communities (90 total, 12 thin omitted)

### Community 0 - "temptext.js"
Cohesion: 0.13
Nodes (27): autoClean(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, controlRow(), creerSalon(), { dataPath }, dernierMessage(), fs, handleTextControl() (+19 more)

### Community 1 - "levels.js"
Cohesion: 0.06
Nodes (58): levels, { SlashCommandBuilder }, adminAjuster(), adminReset(), announceLevelUp(), backfillFromHistory(), BAREME_PATH, baremeEmbed() (+50 more)

### Community 2 - "association.js"
Cohesion: 0.10
Nodes (66): actifs(), {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, StringSelectMenuBuilder,
}, adminPayload(), alertes, anneeEnCours(), auTotal(), calculFacture(), CHANNEL_ID (+58 more)

### Community 3 - "contrat.js"
Cohesion: 0.07
Nodes (61): ackSansData(), { agrilog }, autoClean(), boutonsDispo(), canDecide(), categorieNego(), CONTRAT_CHANNEL, contratSession (+53 more)

### Community 4 - "hub.js"
Cohesion: 0.10
Nodes (39): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  PermissionFlagsBits,
}, ACTIVITES, { agrilog }, autoClean(), canManage(), choixActivites(), exp, EXPLOITANT_ROLE_ID (+31 more)

### Community 5 - "fs25-bridge.js"
Cohesion: 0.12
Nodes (26): ref_stream, buildEmbed(), cfg(), duration(), { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle }, ensureStatusMessage(), fetchMods(), fetchModsFtp() (+18 more)

### Community 6 - "🚜 Travaux des champs"
Cohesion: 0.04
Nodes (46): 🐕 Ami des chiens (caresses), 🐝 Apiculteur (ruches), 💰 Argent, 🥚 Aviculteur (œufs), 🟫 Botteleur (bottes), 🛣️ Bouffeur de bitume (km), 🪓 Bûcheron (arbres), 🚛 Camionneur (km) (+38 more)

### Community 7 - "codeverif.js"
Cohesion: 0.11
Nodes (30): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle }, cleanup(), codeChannel(), codes, crypto, { dataPath }, db, flash() (+22 more)

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
Cohesion: 0.07
Nodes (43): execute(), { resetSalon, getStatus }, { SlashCommandBuilder, PermissionFlagsBits }, bar(), computeUnlocks(), arrondi(), C, proposition() (+35 more)

### Community 13 - "devDependencies"
Cohesion: 0.08
Nodes (24): autoprefixer, dependencies, react, react-dom, react-router-dom, devDependencies, autoprefixer, postcss (+16 more)

### Community 14 - "index.js"
Cohesion: 0.07
Nodes (26): { annoncerArrivee, sendJoinDM, sendLeave }, boutique, { checkNewMember }, { checkSpam, checkLinks }, client, { Client, GatewayIntentBits, Partials, Events }, contrat, { createDashboard, setClient } (+18 more)

### Community 15 - "database.js"
Cohesion: 0.05
Nodes (56): activity, db, EXCLUDED_ROLE_IDS, { panneau }, runAnalysis(), runAuto(), { SlashCommandBuilder, PermissionFlagsBits }, sleep() (+48 more)

### Community 16 - "exploitation.js"
Cohesion: 0.18
Nodes (20): addCoExploitant(), addOuvrier(), createExploitation(), { dataPath }, DB_PATH, deleteExploitation(), fs, getAll() (+12 more)

### Community 17 - "roles.js"
Cohesion: 0.12
Nodes (23): roles, { SlashCommandBuilder, PermissionFlagsBits }, { ActionRowBuilder, ButtonBuilder, ButtonStyle }, addRoleButton(), buildComponents(), _channel(), { dataPath }, fs (+15 more)

### Community 18 - "invitations.js"
Cohesion: 0.12
Nodes (21): { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType }, classementPayload(), { dataPath }, fs, handleInviteButton(), handleRolesButton(), handleRoleToggle(), HUB_CHANNEL (+13 more)

### Community 19 - "dashboard.js"
Cohesion: 0.16
Nodes (17): { ChannelType }, construire(), createDashboard(), crypto, { dataPath }, embeds, express, find() (+9 more)

### Community 20 - "salon-exploitation.js"
Cohesion: 0.16
Nodes (16): panneauDroits(), parNom(), CATEGORIE, { ChannelType, PermissionFlagsBits: P, ActionRowBuilder, ButtonBuilder, ButtonStyle }, droitsPayload(), ensure(), ensureInterne(), exp (+8 more)

### Community 21 - "statusbot.js"
Cohesion: 0.11
Nodes (22): ids, { SlashCommandBuilder, PermissionFlagsBits }, cfg, config, construire(), { dataPath }, db, duree() (+14 more)

### Community 23 - "maps.js"
Cohesion: 0.15
Nodes (22): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
}, cartePayload(), { dataPath }, etoiles(), fs, handleDelete(), handleModal(), handleRate() (+14 more)

### Community 24 - "boutique.js"
Cohesion: 0.13
Nodes (29): { agrilog }, autoClean(), cooldownRestant(), createRequest(), { dataPath }, decisionRow(), demandeEmbed(), estAdmin() (+21 more)

### Community 25 - "marche.js"
Cohesion: 0.18
Nodes (21): {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, champ(), { dataPath }, ERREUR, fmt(), fs, handleAjouter(), handleGerer() (+13 more)

### Community 26 - "scheduled-messages.js"
Cohesion: 0.07
Nodes (37): ref_path, CATS, { Client, GatewayIntentBits, ChannelType: T, PermissionFlagsBits: P }, dotenv, EN, env, FORCE, fs (+29 more)

### Community 27 - "verification.js"
Cohesion: 0.18
Nodes (15): db, execute(), { SlashCommandBuilder, PermissionFlagsBits }, { verifyMember }, { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, db, handleVerifRefButton(), handleVerifyButton() (+7 more)

### Community 28 - "App.jsx"
Cohesion: 0.21
Nodes (6): App(), dashboard_src_index, Config(), FIELDS, Login(), Logs()

### Community 29 - "antispam.js"
Cohesion: 0.18
Nodes (13): { dataPath }, fs, ids, onMessage(), panelPayload(), { panneau }, { PermissionFlagsBits }, { publier } (+5 more)

### Community 30 - "creer"
Cohesion: 0.31
Nodes (15): creer(), autoClean(), estAdmin(), handleSuggDecision(), handleSuggDecisionModal(), handleSuggModal(), handleSuggNew(), installerHub() (+7 more)

### Community 31 - "tickets.js"
Cohesion: 0.19
Nodes (17): handleButton(), log(), { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType }, closeTicket(), config, createTicket(), db, estSupport() (+9 more)

### Community 32 - "ressources.js"
Cohesion: 0.08
Nodes (31): ref_assert, autocomplete(), { classement }, data, execute(), FR, MEDALS, norm() (+23 more)

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

### Community 36 - "publier"
Cohesion: 0.14
Nodes (16): installer(), sansNotif(), envoyerRapport(), formater(), ICONE, noter(), publier(), tampon (+8 more)

### Community 37 - "panneau"
Cohesion: 0.11
Nodes (20): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, panneau(), { panneau }, reglementEmbed(), REGLES (+12 more)

### Community 38 - "purge.js"
Cohesion: 0.15
Nodes (13): execute(), collectRange(), data, dataEnd, dataStart, executeEnd(), executeStart(), key() (+5 more)

### Community 39 - "farm/hub-unifie.js"
Cohesion: 0.15
Nodes (22): { ActionRowBuilder, ButtonBuilder, ButtonStyle }, bouton(), commerce(), { dataPath }, ecrire(), egal(), etiquette(), eur() (+14 more)

### Community 40 - "hub-info.js"
Cohesion: 0.17
Nodes (14): { ActionRowBuilder, ButtonBuilder, ButtonStyle }, buildMessage(), { dataPath }, DEFAUT, DYN, fs, get(), getIntro() (+6 more)

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
Cohesion: 0.31
Nodes (8): CONFIG_PATH, { dataPath }, DEFAULT_CONFIG, ensureDataDir(), fs, get(), path, set()

### Community 45 - "antiraid.js"
Cohesion: 0.38
Nodes (6): checkLinks(), checkSpam(), estStaff(), EXCLUDED_ROLE_IDS, { log }, memberMessages

### Community 46 - "xp-admin.js"
Cohesion: 0.27
Nodes (8): BAREME_CLES, baremeSelectRow(), execute(), handleBaremeSelect(), levels, { panneau }, {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, valeurAffichee()

### Community 48 - "DiscordBridge.lua"
Cohesion: 0.13
Nodes (25): cell(), collectHelpers(), DiscordBridge:collectOwned(), DiscordBridge:export(), DiscordBridge:exportFull(), DiscordBridge:hookMoney(), DiscordBridge:loadCounters(), DiscordBridge:loadMap() (+17 more)

### Community 49 - "hub2.js"
Cohesion: 0.11
Nodes (24): { Client }, hub, { lireStatutUneFois }, succes, src_farm_fs25_bridge_lirestatutunefois, {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits,
}, activitesDe(), actsDe() (+16 more)

### Community 50 - "Liste des succès FS25"
Cohesion: 0.22
Nodes (8): 💰 Argent, 🎯 Divers, 🌾 Fourrage, forêt & atelier, Liste des succès FS25, 🏠 Possessions, 🛣️ Route & conduite, 🚜 Travaux des champs, 🐄 Élevage & ruches

### Community 51 - "Exploitations.jsx"
Cohesion: 0.32
Nodes (5): COULEURS, dateFr(), Exploitations(), Fiche(), toHex()

### Community 52 - "restart.js"
Cohesion: 0.43
Nodes (7): arretPropre(), config, heureParis(), heureReglee(), prevenir(), redemarrer(), startDailyRestart()

### Community 53 - "evenements.js"
Cohesion: 0.10
Nodes (32): ref_crypto, bouton(), crypto, { dataPath }, ecrire(), embed(), execute(), FILE (+24 more)

### Community 54 - "activites-sup.js"
Cohesion: 0.23
Nodes (15): achetables(), { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits }, { CHOIX, ELEVAGE_INDIV, parNom }, decider(), demander(), estStaff(), eur(), exp (+7 more)

### Community 55 - "credit.js"
Cohesion: 0.24
Nodes (14): logsSalon(), nomAffiche(), { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits }, choisir(), estAdmin(), eur(), exp, handle() (+6 more)

### Community 56 - "Dashboard"
Cohesion: 0.40
Nodes (3): Dashboard(), load(), runAnalyse()

### Community 57 - "2. Structure du serveur : salons, contenu, actions, code"
Cohesion: 0.12
Nodes (16): 1. Règles d'architecture (à connaître avant de toucher à quoi que ce soit), 2. Structure du serveur : salons, contenu, actions, code, 3. Commandes slash (enregistrées avec `node src/deploy-commands.js`), 4. Tâches planifiées, 5. Salons / clés cassés (état au 2026-11-25) — supprimés avec l'ancien compte, 6. Diagnostic rapide : « si ça ne marche pas », 🔐 ACCUEIL, 💬 COMMUNAUTÉ (+8 more)

### Community 58 - "droits-texte.js"
Cohesion: 0.12
Nodes (15): ACTIVITES, ANCIENS, CER, CHOIX, ELEVAGE, ELEVAGE_INDIV, ENGRAIS, FOUR (+7 more)

### Community 59 - "nettoyage.js"
Cohesion: 0.47
Nodes (5): epurer(), nettoyerTout(), signature(), SOUPLES, STRICTS

### Community 60 - "antidoublecompte.js"
Cohesion: 0.60
Nodes (5): checkNewMember(), findSimilarUsername(), { panneau }, sendSuspicionAlert(), usernameSimilarity()

### Community 62 - "succes-paliers.js"
Cohesion: 0.23
Nodes (11): appliquer(), calcul(), { dataPath }, defauts, FILE, fs, init(), liste() (+3 more)

### Community 63 - "paths.js"
Cohesion: 0.13
Nodes (18): ref_fs, dataPath(), fs, path, REPO_DATA, { dataPath }, exp, fs (+10 more)

### Community 64 - "fs25-data.js"
Cohesion: 0.17
Nodes (13): execute(), { lireDonneesCompletes }, { sectionEmbed }, { SlashCommandBuilder }, src_farm_fs25_bridge_liredonneescompletes, attrs(), cache, { EmbedBuilder } (+5 more)

### Community 65 - "succes.test.js"
Cohesion: 0.20
Nodes (11): deplacerTravail(), parseStatus(), src_farm_fs25_succes_reset, assert, base, { computeUnlocks, _reset }, cv, { parseStatus } (+3 more)

### Community 66 - "panneauEmbed"
Cohesion: 0.23
Nodes (12): panneauEmbed(), { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle }, buildMessage(), fs, handleButton(), handleSelect(), MEDALS, { panneauEmbed } (+4 more)

### Community 67 - "publiclog.js"
Cohesion: 0.26
Nodes (10): alerteStaff(), { AuditLogEvent }, demarrer(), MODELES, motif(), nom(), { panneauEmbed }, panneauVerif() (+2 more)

### Community 68 - "niveau.js"
Cohesion: 0.40
Nodes (5): barre(), execute(), levels, { panneau }, { SlashCommandBuilder }

### Community 73 - "sync-db.js"
Cohesion: 0.40
Nodes (5): db, execute(), { panneau }, { SlashCommandBuilder, PermissionFlagsBits }, syncDatabase()

### Community 75 - "jeux.js"
Cohesion: 0.14
Nodes (22): ajouterImages(), {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
}, { dataPath }, derniere, dernierMessage(), doublon(), fs, handleModal() (+14 more)

### Community 76 - "bouton-info.js"
Cohesion: 0.33
Nodes (8): CHOIX, enregistrer(), execute(), handleModal(), info, lire(), {
  SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
}, TEXTE

### Community 77 - "succes-base.js"
Cohesion: 0.31
Nodes (9): appliquer(), base, charger(), { dataPath }, figer(), FILE, fs, kC() (+1 more)

### Community 78 - "deploy-commands.js"
Cohesion: 0.50
Nodes (3): commands, rest, { REST, Routes }

### Community 79 - "startJeux"
Cohesion: 0.60
Nodes (5): panelPayload(), startJeux(), cacherAuxAutres(), salonAccueil(), visiblePar()

### Community 81 - "Messages.jsx"
Cohesion: 0.50
Nodes (3): COLOR_OPTIONS, EMPTY_FORM, INTERVAL_OPTIONS

### Community 88 - "parseBrut"
Cohesion: 0.50
Nodes (5): allTags(), attrs(), firstTag(), parseBrut(), unescapeXml()

## Knowledge Gaps
- **624 isolated node(s):** `{ Client, ChannelType, PermissionFlagsBits: P }`, `c`, `{ Client, GatewayIntentBits }`, `c`, `{ Client, GatewayIntentBits }` (+619 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `panneau()` connect `panneau` to `temptext.js`, `association.js`, `contrat.js`, `hub.js`, `codeverif.js`, `bugs.js`, `birthday.js`, `tempvoice.js`, `database.js`, `invitations.js`, `dashboard.js`, `salon-exploitation.js`, `statusbot.js`, `maps.js`, `boutique.js`, `marche.js`, `antispam.js`, `creer`, `tickets.js`, `embed-format.js`, `suggestions.js`, `purge.js`, `farm/hub-unifie.js`, `hub-info.js`, `xp-admin.js`, `hub2.js`, `activites-sup.js`, `antidoublecompte.js`, `panneauEmbed`, `niveau.js`, `sync-db.js`, `jeux.js`, `startJeux`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `dataPath()` connect `paths.js` to `temptext.js`, `levels.js`, `association.js`, `contrat.js`, `codeverif.js`, `bugs.js`, `tempvoice.js`, `fs25-succes.js`, `database.js`, `exploitation.js`, `roles.js`, `invitations.js`, `dashboard.js`, `statusbot.js`, `maps.js`, `boutique.js`, `marche.js`, `scheduled-messages.js`, `antispam.js`, `creer`, `ressources.js`, `suggestions.js`, `admin-api.js`, `panneau`, `farm/hub-unifie.js`, `hub-info.js`, `config.js`, `evenements.js`, `succes-paliers.js`, `jeux.js`, `succes-base.js`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `creer()` connect `creer` to `suggestions.js`, `paths.js`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `panneau()` (e.g. with `embed-format.js` and `panneauEmbed()`) actually correct?**
  _`panneau()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ Client, ChannelType, PermissionFlagsBits: P }`, `c`, `{ Client, GatewayIntentBits }` to the rest of the system?**
  _624 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `temptext.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1349206349206349 - nodes in this community are weakly interconnected._
- **Should `levels.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06041986687147977 - nodes in this community are weakly interconnected._