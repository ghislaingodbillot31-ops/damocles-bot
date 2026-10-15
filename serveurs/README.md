# Serveurs

Le code (`src/`) est commun. Chaque serveur Discord a sa configuration :

| Serveur | Config | Données | Lancement |
|---|---|---|---|
| EUROAGRI (prod Render) | `.env` à la racine / variables Render | `data/` + disque Render | `npm start` |
| DOMINIUS | `serveurs/dominius/.env` | `serveurs/dominius/data/` | `npm run dominius` |

`serveurs/euroagri/` : scripts ponctuels de l'ancien serveur (`node serveurs/euroagri/<script>.js`, depuis la racine).
`serveurs/dominius/` : `setup-dominius.js` (création des salons), `.env`, `.env.nouveau`, `nouveau-serveur.env`.

DOMINIUS : `npm run deploy:dominius` enregistre les commandes, `VERIF_MODE=code` active la vérification par code.
Deux bots avec le même token ne peuvent pas tourner en même temps : une 2e application Discord est nécessaire pour les faire cohabiter.
