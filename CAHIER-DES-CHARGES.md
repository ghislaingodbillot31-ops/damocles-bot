# MonCopainBot — Cahier des charges (salons, actions, code, données)

Serveur : **Le Coin des Copains** (`GUILD_ID` 1553812030262218952). Bot : **MonCopainBOT** (application recréée le 2026-11-25, ancien compte supprimé).
Document de référence : *« si quelque chose ne va pas, où chercher »*. Mis à jour le 2026-11-25.

---
## 1. Règles d'architecture (à connaître avant de toucher à quoi que ce soit)

| Sujet | Règle |
|---|---|
| Où tourne le bot | **Render** (branche `dominius`, déploiement : `bash deployer-render.sh`, 3-5 min). En local `npm start` ne se connecte PAS à Discord (sauf `DISCORD_LOCAL=1`). |
| Où sont les VRAIES données | Disque persistant Render `DATA_DIR=/var/data`. Le dossier `data/` du PC = données de test, **ne jamais s'y fier** (le classement, les heures d'association, les exploitations n'y sont pas). |
| Variables sensibles | `.env` / `.env.render` (ignorés par git). Sur Render : *Environment*. À modifier à la main sur le site (token, `CLIENT_ID`…). |
| ID des salons | `src/core/ids.js` : `.env` > `config.json` (disque) > valeur par défaut codée. Un salon supprimé = fonction muette (avertissement au démarrage). |
| Rafraîchir un panneau | **Éditer en place** via `src/farm/panneau-sync.js → publier(channel, msgId, payload)` : si le message est introuvable ou non modifiable (posté par l'ancien bot) → il est supprimé puis republié. Les IDs de messages sont gardés dans les fichiers de données de chaque module. Ne jamais republier en masse. |
| Nettoyage doublons | `src/core/nettoyage.js` : 60 s après le démarrage, garde le panneau le plus récent de chaque type dans les salons « stricts » (antispam, invitations, anniversaires, vocal, rôles, règlement) et « souples » (suggestions, mods, bugs, tickets). Il ne touche que les messages du bot **actuel**. |
| Notifications | `src/core/silencieux.js` : tout message du bot est silencieux (sauf tickets). |
| Remises à zéro ponctuelles | `src/farm/reset-*.js`, repérées par un fichier `*.done` dans le dossier de données (**un nouveau disque = elles se rejouent** ; en local elles ont vidé marché/succès, sauvegardes `*.backup-reset.json`). |
| Nouveau bot / ancienne app | Les messages de l'ancien bot s'affichent « Deleted User », boutons morts, non modifiables. Corrigé pour : panneaux `panneau-sync`, classement XP, salons de ferme, tickets. Les autres modules passant par `publier()` sont couverts. |

---
## 2. Structure du serveur : salons, contenu, actions, code

Légende : **Env** = clé de configuration ; **Code** = fichier source ; **Données** = fichier dans le dossier de données.

### 🔐 ACCUEIL
| Salon | Env | Contenu posté par le bot | Actions joueur / staff | Code | Données |
|---|---|---|---|---|---|
| 👋・bienvenue | `WELCOME_CHANNEL_ID` | Message d'arrivée (guide « pour commencer », lien vers `CHAT_CHANNEL_ID`) | — | `moderation/welcome.js` | `welcome-config.json` |
| 🖥️・bot-status | `STATUS_CHANNEL_ID` | « 🛰️ Centre de contrôle » : état live du bot (un seul message, rafraîchi par timer) | — | `core/statusbot.js` | `status-msg.json`, `status-events.json` |
| 🖥️・public-logs | `PUBLIC_LOG_CHANNEL_ID` | Journal public : arrivées, joueurs validés, tickets, rôles, bans/expulsions | — | `moderation/publiclog.js` | — |
| 🔍・vérification | `VERIFICATION_CHANNEL_ID` | Panneau « 🔐 VÉRIFICATION » (selon `VERIF_MODE` : `code-compte`, `code` ou classique) | Boutons `verif_saisir`, `verif_code`, `verify_accept_/refuse_`, `verifref_accept_/close_/kick_` ; `/verifier` | `moderation/verification.js`, `codeverif.js`, `antidoublecompte.js` | `codeverif.json` |
| ⛔・ne-pas-écrire (hors catégorie) | `ANTISPAM_CHANNEL_ID` | Panneau « NE PAS ÉCRIRE ICI » (piège à bots : tout message d'un non-staff = ban auto) | — | `moderation/antispam.js` | `antispam.json` |

### 💬 COMMUNAUTÉ
| Salon | Env | Contenu | Actions | Code | Données |
|---|---|---|---|---|---|
| 🏘️・hub-communautaire | `INVITE_HUB_CHANNEL_ID` | **2 messages** : (1) « 🏘️ HUB COMMUNAUTAIRE » (3 boutons) ; (2) en dessous « 🏆 CLASSEMENT XP » | Boutons `lien_invite` (lien perso 7 j), `hub_roles` (prendre/retirer rôles `hubrole_*`), `hub_reglement` (règlement) | `moderation/invitations.js` (`startInvitations`, `refreshHub`), `moderation/roles.js`, `moderation/reglement.js`, XP : `community/levels.js` | `invitations.json` (`panelMsgId`, `rankMsgId`), `xp.json`, `roles-panel.json` |
| 💬・général | `CHAT_CHANNEL_ID` | — (joueurs) | Chaque message donne de l'XP | `community/levels.js` | `xp.json` |
| 📸・screenshots | — | — | Bonus XP image | `levels.js` | `xp.json` |
| 🎂・anniversaires | `BIRTHDAY_CHANNEL_ID` | Panneau « 🎂 ANNIVERSAIRES » | Bouton `anniv_btn`, `/anniversaire`, annonce à minuit (cron `0 0 * * *`) | `community/birthday.js` | `members.json` |
| 📩・mise-a-jour | — | manuel (annonces staff) | — | — | — |

**XP / classement :** `levels.js` — gains messages/images/vocal/invitations (barème `xp-config.json`, `/xp-admin bareme`). `/xp-admin ajouter|retirer|reset|backfill`, `/classement`, `/niveau`. Le classement est affiché **sous le HUB** : `levels.refreshLeaderboard()` appelle `invitations.refreshHub()`. L'ancien salon dédié `LEVELUP_CHANNEL_ID` (🏆・classements) n'existe plus : volontairement vide, ne pas le recréer. Annonces de montée de niveau désactivées.

### 🔊 VOCAUX
| Salon | Env | Contenu | Actions | Code | Données |
|---|---|---|---|---|---|
| ➕-créer-un-salon | `TEMPVOICE_PANEL_CHANNEL_ID` (catégorie `VOICE_CATEGORY_ID`) | « 🔊 SALONS VOCAUX TEMPORAIRES » | `voice_create`, `voice_rename_/limit_/lock_/delete_` ; salons supprimés quand vides | `community/tempvoice.js` | `tempvoice.json` |

### 🚜 FARMING SIMULATOR 25
| Salon | Env | Contenu | Actions | Code | Données |
|---|---|---|---|---|---|
| 📢・fs25-annonces, 💬・fs25-général, 📷・fs25-screenshots | — | manuel | — | — | — |
| 📦・fs25-mods | `MODS_CHANNEL_ID` | « 🛠️ RÈGLEMENT DES MODS » + propositions | bouton de proposition | `community/suggestions.js` | `mods-propositions.json` |

### 🚜 FARMING SIMULATOR INFO
| Salon | Env | Contenu | Actions | Code | Données |
|---|---|---|---|---|---|
| 🏡・fs25-nouveau-joueur | — | manuel | — | — | — |
| 🚜・fs25-hub | `EXPLOITANTS_HUB_CHANNEL_ID` (défaut codé), `FS25_STATUS_CHANNEL_ID` | **3 messages** : « 🤝 COMMERCE & CONTRAT », « 🌾 HUB DES EXPLOITANTS » (classement des fermes + activités), « 🟢 Le Coin des Copains » (statut serveur FS25 + boutons info) | `hub_expl`, `nv_succes`, `nv_act`, `hub_contrat`, `hub_besoin`, `hub_marche`, `hub_boutique`, `hubinfo_*` | `farm/hub2.js`, `farm/hub.js`, `farm/niveaux.js`, `farm/fs25-bridge.js`, `farm/hub-info.js`, `farm/boutique.js`, `farm/marche.js` | `niveaux.json` (IDs messages + niveaux), `exploitations.json`, `marche.json`, `hub-info.json`, `boutique.json` |
| 🏆・fs25-succes | `FS25_SUCCES_CHANNEL_ID` | « 🏆 HUB DES SUCCÈS » + « 🎯 DÉFI HEBDOMADAIRE » (lundi, 3 défis) ; salon remis à zéro chaque jour à 6 h (HUB seul) | `succhub_farm`, `succhub_liste`, `/succes`, `/succes-maj` | `farm/fs25-succes.js`, `fs25-succes-hub.js`, `fs25-succes-config.js`, `evenements.js`, `succes-paliers.js`, `succes-base.js` | `succes.json`, `succes-base.json`, `succes-paliers.json`, `evenements.json` |
| 🟢・fs25-connexions | `FS25_CONNEXIONS_CHANNEL_ID` | Connexions / déconnexions des joueurs du serveur de jeu | — | `farm/fs25-bridge.js` | — |
| 🏦・fs25-banque | `FS25_BANQUE_CHANNEL_ID` | Mouvements d'argent du jeu | — | `fs25-bridge.js` | — |
| 📰・fs25-contrats-besoins | `CONTRAT_CHANNEL_ID` | Annonces de contrats (je propose) et de besoins (je recherche) ; nettoyées périodiquement | `contrat_*`, `besoin_modal_`, `/contrat` | `commands/contrat.js` | `contrat-sessions.json` |
| 🏡・fs25-association | `ASSO_CHANNEL_ID` (défaut codé) | « 🌲 ASSOCIATION » : licences, crédits, versements, salaires, règlement | `asso_rejoindre`, `asso_licence`, `asso_credit`, `asso_remb`, `asso_resil`, `asso_reglement(_edit)`, `asso_admin`, `asso_ok_/no_`, `asso_op*` | `farm/association.js` (timers : licences 1 min, salaires 5 min, virements 1 min, factures 1 h, expiration 6 h) | `association.json` (**heures/licences/versements : données Render**) |
| 🗒️・fs25-logs | `FS25_ACTIVITE_CHANNEL_ID` | Journal d'activité (échanges, industrie, contrats, accords) — filtré par `ROUTES` | — | `core/agrilog.js` | — |

### Les exploitations / 🤝 NÉGOCIATIONS
| Salon | Env | Contenu | Actions | Code | Données |
|---|---|---|---|---|---|
| #ferme-<nom> (catégorie `EXPLOITATIONS_CATEGORY_ID`, défaut codé) | — | **Privé** : HUB de la ferme (« ⚙️ Gérer », « 🏭 Industrie », « 🏪 Marché », « 👑 Administrateur ») + panneau des travaux autorisés | `hub_expl_gerer_`, `nv_usine`, `nv_marche`, `cred_admin_`, `ind_*`, `asup_*`, `cred_*` | `farm/salon-exploitation.js`, `industrie.js`, `credit.js`, `activites-sup.js`, `droits-texte.js` | `exploitations.json` (`salonId`, `salonHub`, `salonDroits`, `salonH`) |
| 🤝・nego-… | — | Salons de négociation contrat/besoin | `contrat_deal_*` | `commands/contrat.js` | `contrat-sessions.json` |

### 🎮 JEUX DIVERS
| 🎮・partage-tes-jeux | — | « PARTAGE TES JEUX » | `jeux_new`, `jeux_wish`… | `community/jeux.js` | `jeux.json` |
| ⭐・wishlist | — | liste de souhaits | idem | `jeux.js` | `jeux.json` |

### 🎫 SUPPORT
| 📩・ouvrir-ticket | `TICKET_CHANNEL_ID`, `TICKET_LOG_CHANNEL_ID`, catégorie `TICKET_CATEGORY_ID` | « SUPPORT · OUVRIR UN TICKET » ; salons `ticket-*` (accueil + Prise en charge / Clôturer) | `ticket_create`, `ticket_take_<id>`, `ticket_close_<id>` | `moderation/tickets.js` (réactive les tickets de l'ancien bot au démarrage) | historique dans `members.json` |
| asso-… | — | ticket spécial association | idem | `tickets.ouvrirSalon` (appelé par `association.js`) | — |

### 📊 STAFF
| Salon | Env | Contenu | Code |
|---|---|---|---|
| 📋・staff-logs | `LOG_CHANNEL_ID` | Logs du bot, sanctions, départs, « 🔄 Panneaux actualisés » (rapport groupé 15 s) | `core/logger.js`, `panneau-sync.js`, `core/restart.js` |
| ouvrier-ia | `FS25_OUVRIERS_CHANNEL_ID` | Annonces des ouvriers IA | `fs25-bridge.js` |
| 🔑・staff-info, 💬・staff-général, ⚠️・staff-alertes, 🛠️・staff-commandes, sihg-refonte | — | manuel | — |
| test-asso, association-stat | — | **tests** (à nettoyer si inutiles) | `association.js` (stats) |

---
## 3. Commandes slash (enregistrées avec `node src/deploy-commands.js`)
`/xp-admin ajouter|retirer|bareme|reset|backfill` · `/classement` · `/niveau` · `/anniversaire` · `/invite` · `/contrat` · `/fs25` · `/succes` · `/succes-maj` · `/boutique-admin` · `/bouton` · `/bouton-info` · `/verifier` · `/sanction` · `/banid` · `/expulsion` · `/analyse` · `/maintenance` · `/sync-db` · `/tirage-au-sort` · `/nettoyer`. Supprimée : `/loto-tirage` (mini-jeu Euro-Copains retiré le 2026-11-25).

## 4. Tâches planifiées
04 h Paris : tâche quotidienne (membres, base, statut) · 05 h : redémarrage quotidien · 06 h : salon des succès · lundi : défis hebdo · minuit : anniversaires · classement XP : toutes les heures · pont FS25 : toutes les `FS25_REFRESH` s (FTP).

---
## 5. Salons / clés cassés (état au 2026-11-25) — supprimés avec l'ancien compte
| Clé | Module | Conséquence | À faire |
|---|---|---|---|
| `BUG_HUB_CHANNEL_ID`, `BUGS_TRAITEMENT_…`, `BUGS_CORRIGES_…` | `community/bugs.js` | Pas de HUB de bugs | recréer 3 salons ou retirer le module |
| `SUGG_CHANNEL_ID` | `suggestions.js` | Pas de suggestions | idem |
| `MAPS_CHANNEL_ID` | `maps.js` | Pas de journal des cartes | idem |
| `JOURNAL_CHANNEL_ID`, `HUB_CHANNEL_ID` | non utilisés | — | nettoyer |
| `ROLES_CHANNEL_ID` | `roles.js` | « salon introuvable » | non défini |
| `TEXT_CATEGORY_ID` | `temptext.js` | erreur « parent_id vide » au démarrage | définir ou désactiver |
| `LEVELUP_CHANNEL_ID` (1559691463561052263) | `levels.js` | salon supprimé, classement géré sous le HUB | laisser tel quel |
| `EXPLOITANT_ROLE_ID` | `farm/hub.js` | rôle Exploitant non attribué si absent | vérifier |

## 6. Diagnostic rapide : « si ça ne marche pas »
| Symptôme | Où chercher |
|---|---|
| Bot hors ligne / « Expected token to be set » | `DISCORD_TOKEN` invalide ou absent sur Render (Developer Portal → Reset Token) |
| Boutons « Deleted User » / ne répondent plus | Message de l'ancien bot : relancer le module (il republie), voir §1 |
| Panneau en double | `nettoyage.js` (liste STRICTS/SOUPLES) ; vérifier l'ID message dans le fichier de données du module |
| Données « disparues » | Regarder sur le disque **Render** (`/var/data`), pas `data/` local ; fichiers `*.backup-reset.json` |
| Classement XP figé | `levels.refreshLeaderboard` → `invitations.refreshHub` ; `invitations.json.rankMsgId` |
| Salon de ferme sans panneau | `salon-exploitation.js` (`exploitations.json` → `salonHub/salonDroits`) |
| Commande slash absente | `node src/deploy-commands.js` avec le bon `CLIENT_ID` |
| Rien ne se publie dans un salon | Avertissement `introuvable` dans les logs Render → clé du §5 |
