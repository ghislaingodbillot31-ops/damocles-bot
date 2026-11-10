// Niveaux d'exploitation, points et activités. Tout se règle ici.

// Score minimum (somme des niveaux de succès) pour atteindre le niveau 1, 2, 3…
const PALIERS = [0, 5, 14, 27, 44, 65, 90, 119, 152, 189, 230, 275, 324, 377, 434, 495, 560, 629, 702, 779];

const POINTS_DEPART = 3;                       // niveau 1 ; +1 par niveau gagné ensuite
const pointsGagnes = niveau => POINTS_DEPART + niveau - 1;
const coutUsines = n => (n * (n + 3)) / 2;     // la Nième usine coûte N+1 : 2, 5, 9, 14…

// Ferme du jeu gérée à part (hors niveaux, hors achats) : l'Association forestière
const FORET = 'a vendre';

const ACTIVITES = [
  { id: 'cereales', groupe: '🌱 Cultures', nom: "Céréalier", emoji: '🌾', cout: 1, res: "blé, orge, avoine, maïs grain, sorgho" },
  { id: 'oleagineux', groupe: '🌱 Cultures', nom: "Oléagineux", emoji: '🌻', cout: 2, res: "colza, tournesol, soja" },
  { id: 'racines', groupe: '🌱 Cultures', nom: "Maraîcher racines", emoji: '🥕', cout: 3, res: "carottes, panais, betteraves rouges, pommes de terre, betteraves sucrières" },
  { id: 'verts', groupe: '🌱 Cultures', nom: "Maraîcher verts", emoji: '🥦', cout: 4, res: "épinards, pois, haricots verts" },
  { id: 'tropicales', groupe: '🌱 Cultures', nom: "Tropical", emoji: '🌴', cout: 3, res: "canne à sucre, coton" },
  { id: 'riz', groupe: '🌱 Cultures', nom: "Riziculteur", emoji: '🍚', cout: 4, res: "riz, riz long grain" },
  { id: 'fourrager', groupe: '🌱 Cultures', nom: "Fourrager", emoji: '🌿', cout: 1, res: "herbe, foin, paille, balles enrubannées" },
  { id: 'ensileur', groupe: '🌱 Cultures', nom: "Ensileur", emoji: '🌽', cout: 2, res: "maïs ensilage, luzerne, ensilage d'herbe" },
  { id: 'vigne', groupe: '🍇 Vignes & vergers', nom: "Viticulteur", emoji: '🍇', cout: 5, res: "raisin" },
  { id: 'olives', groupe: '🍇 Vignes & vergers', nom: "Oléiculteur", emoji: '🫒', cout: 5, res: "olives" },
  { id: 'fruits', groupe: '🏡 Serres', nom: "Serriste fruits", emoji: '🍅', cout: 3, res: "tomates, fraises, piments" },
  { id: 'feuilles', groupe: '🏡 Serres', nom: "Serriste feuilles", emoji: '🥬', cout: 2, res: "salades, chou chinois" },
  { id: 'bulbes', groupe: '🏡 Serres', nom: "Serriste bulbes", emoji: '🧄', cout: 2, res: "ail, oignons nouveaux" },
  { id: 'champignon', groupe: '🏡 Serres', nom: "Champignonniste", emoji: '🍄', cout: 3, res: "champignons" },
  { id: 'laitier', groupe: '🐾 Élevage', nom: "Bovin laitier", emoji: '🐄', cout: 4, res: "vaches laitières" },
  { id: 'allaitant', groupe: '🐾 Élevage', nom: "Bovin allaitant", emoji: '🐂', cout: 3, res: "vaches à viande" },
  { id: 'buffles', groupe: '🐾 Élevage', nom: "Éleveur de buffles", emoji: '🐃', cout: 5, res: "buffles" },
  { id: 'ovin', groupe: '🐾 Élevage', nom: "Ovin", emoji: '🐑', cout: 2, res: "moutons" },
  { id: 'caprin', groupe: '🐾 Élevage', nom: "Caprin", emoji: '🐐', cout: 2, res: "chèvres" },
  { id: 'porcin', groupe: '🐾 Élevage', nom: "Porcin", emoji: '🐷', cout: 3, res: "porcs" },
  { id: 'aviculteur', groupe: '🐾 Élevage', nom: "Aviculteur", emoji: '🐔', cout: 1, res: "poules" },
  { id: 'equin', groupe: '🐾 Élevage', nom: "Équin", emoji: '🐴', cout: 4, res: "chevaux" },
  { id: 'apiculteur', groupe: '🐾 Élevage', nom: "Apiculteur", emoji: '🐝', cout: 2, res: "abeilles" },
];

// Activités de l'Association forestière : hors système, non achetables
const FORET_ACTIVITES = [['Bûcheron', 'grumes'], ['Bois de chauffage', 'bûches'], ['Plaquettes', 'plaquettes'], ['Populiculteur', 'peupliers']];
const NIVEAUX_INDUSTRIE = ['Artisan', 'Atelier', 'Petite entreprise', 'PME', 'Manufacture', 'Industriel', 'Groupe industriel', 'Grand groupe', 'Conglomérat', "Magnat de l'industrie"];

module.exports = { FORET_ACTIVITES, NIVEAUX_INDUSTRIE, PALIERS, pointsGagnes, coutUsines, FORET, ACTIVITES, parId: Object.fromEntries(ACTIVITES.map(a => [a.id, a])) };
