# Multifruit (phase 1)

Jeu de gestion d'entreprise de jus, entièrement dans Discord. Module autonome : le reste du bot ne connaît que `index.js`.

## Branchement dans le bot
- `src/index.js` : 1 `require` + 1 ligne en tête de `InteractionCreate` (`multifruit.handle`).
- `src/deploy-commands.js` : 1 ligne (`...require('./multifruit').commands`). Lancer `npm run deploy` pour enregistrer les commandes.

## Base de données propre
SQLite intégrée à Node (`node:sqlite`, aucune dépendance) : `<DATA_DIR>/multifruit/multifruit.db`, tables préfixées `multifruit_`.
Chaque action = une transaction (`db/db.js`) → pas de double débit ni de double lot en cas de double clic.

## Commandes
`/creer-entreprise` · `/hub` (éphémère) · `/multifruit-installer` (admin : catégorie, 4 salons, panneau « Ouvrir mon HUB »).
Composants : `customId` en `mf:…`.

## Fichiers
- `systems/jeu.js` : toute la logique (sans Discord) · `systems/contenu.js` : charge et valide `data/`
- `ui/vues.js` : embeds et boutons · `interactions/` : boutons, menus, modales · `commands/` : slash commands
- `test.js` : auto-vérification → `DATA_DIR=<dossier temporaire> node src/multifruit/test.js`

## Ajouter du contenu (sans toucher au code)
Éditer `data/*.json` : `fruits` (+ son `jus` dans `jus.json`), `machines` (niveaux), `contenants`, `cuves`, `equilibrage`. Les erreurs de données sont listées au démarrage.
Un fruit/contenant n'est jouable que si `debloque_par_defaut: true` (le déblocage par progression arrive en phase 2).

## Règles de la phase 1
Rien ne se fabrique seul : pressage et mise en bouteille sont lancés au bouton ; les lots terminés sont réglés à l'ouverture du HUB (rattrapage, pas de tâche de fond). Le jus d'un pressage réserve la place en cuve dès le lancement. Une cuve = un seul jus.
