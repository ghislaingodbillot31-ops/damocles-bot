// Niveaux d'exploitation. Tout se règle ici.

// Score minimum (somme des niveaux de succès) pour atteindre le niveau 1, 2, 3…
const PALIERS = [0, 6, 23, 51, 90, 141, 203, 276, 360, 456, 563, 681, 811, 952, 1104, 1267, 1442, 1627, 1825, 2033];

// Ferme du jeu gérée à part (hors niveaux, hors achats) : l'Association forestière
const FORET = 'a vendre';

module.exports = { PALIERS, FORET };
