#!/bin/bash
# Pousse le code actuel sur damocles-bot/dominius (branche surveillée par Render) SANS réécrire l'historique :
# un commit normal est ajouté par-dessus l'ancien dominius (l'ancien code reste dans l'historique et dans la branche dominius-avant).
set -e
cd "$(dirname "$0")"
git remote get-url damocles >/dev/null 2>&1 || git remote add damocles https://github.com/ghislaingodbillot31-ops/damocles-bot.git
git fetch damocles dominius
NEW=$(git commit-tree 'HEAD^{tree}' -p FETCH_HEAD -m "Remplace le code par MonCopainBot (Le Coin des Copains)

Ancien code conservé dans la branche dominius-avant.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>")
git push damocles "$NEW":refs/heads/dominius
echo "OK : Render va redéployer (3 à 5 minutes)."
