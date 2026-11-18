// Niveaux d'exploitation. Tout se règle ici.

// Score minimum (somme des niveaux de succès) pour atteindre le niveau 1, 2, 3…
const PALIERS = [0, 5, 14, 27, 44, 65, 90, 119, 152, 189, 230, 275, 324, 377, 434, 495, 560, 629, 702, 779];

// Ferme du jeu gérée à part (hors niveaux, hors achats) : l'Association forestière
const FORET = 'a vendre';

module.exports = { PALIERS, FORET };
