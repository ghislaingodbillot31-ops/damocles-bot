/**
 * Liste des succès FS25 — à modifier librement.
 *
 * Chaque série a 25 niveaux (sauf mention). Un niveau atteint = un succès débloqué.
 * Toutes les sources ci-dessous ont été vérifiées dans le code de FS25
 * (FS25 Community LUADOC), sauf mention "à vérifier".
 *
 * source :
 *   { stat: 'plowedHectares' }          statistique de ferme mise à jour par le jeu
 *   { stat: ['a', 'b'] }                plusieurs stats additionnées
 *   { statPrefix: 'breed' }             toutes les stats commençant par ce préfixe
 *   { produced: ['MILK'] }              production des animaux / ruches (compteur du mod)
 *   { moneyIn: ['SOLD_ANIMALS'] }       € gagnés par type de mouvement ('*' = tous)
 *   { moneyOut: ['PURCHASE_FUEL'] }     € dépensés par type ('*' = tous)
 *   { stat: '_ownedVehicles' }          possessions actuelles (compteur du mod)
 * scale : facteur appliqué à la valeur (ex. 1/60 pour passer des minutes aux heures)
 *
 * tiers :
 *   palier(pas, supplément, nb)  niveau 1 = pas ; écart entre le niveau n et le suivant = pas + n × supplément
 *   proposition(max)             courbe douce proposée (départ à 1, écarts qui grandissent), le dernier niveau = max
 *   lineaire(max)                un pas fixe par niveau, le dernier niveau = max
 */

const NB_NIVEAUX = 25;

// Niveau n = pas × n + supplément × n(n-1)/2
function palier(pas, supplement = 0, nb = NB_NIVEAUX) {
  return Array.from({ length: nb }, (_, i) => pas * (i + 1) + (supplement * i * (i + 1)) / 2);
}

const lineaire = (max, nb = NB_NIVEAUX) => Array.from({ length: nb }, (_, i) => (max * (i + 1)) / nb);

function arrondi(v) {
  if (v < 20) return Math.max(1, Math.round(v));
  if (v < 100) return Math.round(v / 5) * 5;
  const p = 10 ** (Math.floor(Math.log10(v)) - 1);
  return Math.round(v / p) * p;
}

function proposition(max, nb = NB_NIVEAUX) {
  const out = [];
  for (let i = 1; i <= nb; i += 1) {
    let r = arrondi(max * (i / nb) ** 2.8);
    const prev = out[out.length - 1] || 0;
    if (r <= prev) r = prev + (prev < 20 ? 1 : prev < 100 ? 5 : 10 ** (Math.floor(Math.log10(prev)) - 1));
    out.push(r);
  }
  out[nb - 1] = max;
  return out;
}

const C = {
  champs: '🚜 Travaux des champs',
  route: '🛣️ Route & conduite',
  fourrage: '🌾 Fourrage, forêt & atelier',
  elevage: '🐄 Élevage & ruches',
  argent: '💰 Argent',
  possessions: '🏠 Possessions',
};

module.exports = [
  // ---------------- Travaux des champs ----------------
  { id: 'labour',      category: C.champs, emoji: '🚜', name: 'Laboureur',             source: { stat: 'plowedHectares' },     unit: 'ha', tiers: palier(20, 10) },
  { id: 'dechaumage',  category: C.champs, emoji: '⚙️', name: 'Travailleur du sol',            source: { stat: 'cultivatedHectares' }, unit: 'ha', tiers: palier(20, 10) },
  { id: 'semis',       category: C.champs, emoji: '🌱', name: 'Semeur',                source: { stat: 'sownHectares' },       unit: 'ha', tiers: palier(20, 10) },
  { id: 'pulve',       category: C.champs, emoji: '💧', name: 'Soigneur des sols',         source: { stat: 'sprayedHectares' },    unit: 'ha', tiers: palier(50, 10) },
  // Le jeu compte la fauche (Mower) et la moisson (Cutter) dans la même stat
  { id: 'moisson',     category: C.champs, emoji: '🌾', name: 'Récolteur', source: { stat: 'threshedHectares' },  unit: 'ha', tiers: palier(50, 10) },
  { id: 'travail',     category: C.champs, emoji: '🧑‍🌾', name: 'Maître des champs',  source: { stat: 'workedHectares' },     unit: 'ha', tiers: proposition(20000) },
  { id: 'heures',      category: C.champs, emoji: '⏱️', name: 'Heures sup\'',               source: { stat: 'workedTime' }, scale: 1 / 60, unit: 'h', tiers: proposition(2000) },
  { id: 'semences',    category: C.champs, emoji: '🫘', name: 'Sac de graines',             source: { stat: 'seedUsage' },          unit: 'L', tiers: palier(1000, 500) },

  // ---------------- Route & conduite ----------------
  { id: 'distance',    category: C.route, emoji: '🛣️', name: 'Bouffeur de bitume',                source: { stat: 'traveledDistance' },   unit: 'km', tiers: proposition(10000) },
  { id: 'tracteur',    category: C.route, emoji: '🚜', name: 'Tractoriste',            source: { stat: 'tractorDistance' },    unit: 'km', tiers: proposition(5000) },
  { id: 'camion',      category: C.route, emoji: '🚛', name: 'Camionneur',             source: { stat: 'truckDistance' },      unit: 'km', tiers: proposition(5000) },
  { id: 'voiture',     category: C.route, emoji: '🚗', name: 'Chauffeur du dimanche',                 source: { stat: 'carDistance' },        unit: 'km', tiers: proposition(2000) },
  { id: 'gasoil',      category: C.route, emoji: '⛽', name: 'Gros buveur de gasoil',   source: { stat: 'fuelUsage' },          unit: 'L', tiers: palier(500, 200) },

  // ---------------- Fourrage, forêt & atelier ----------------
  { id: 'bottes',      category: C.fourrage, emoji: '🟫', name: 'Botteleur',           source: { stat: 'baleCount' },          unit: 'balles', tiers: palier(50, 30) },
  { id: 'enrubannage', category: C.fourrage, emoji: '⚪', name: 'Enrubanneur',         source: { stat: 'wrappedBales' },       unit: 'balles', tiers: palier(50, 30) },
  { id: 'plantation',  category: C.fourrage, emoji: '🌳', name: 'Reboiseur',            source: { stat: 'plantedTreeCount' },   unit: 'arbres', tiers: proposition(2000) },
  { id: 'bucheron',    category: C.fourrage, emoji: '🪓', name: 'Bûcheron',            source: { stat: 'cutTreeCount' },       unit: 'arbres', tiers: proposition(2000) },
  { id: 'mecanicien',  category: C.fourrage, emoji: '🔧', name: 'Mécanicien',          source: { stat: 'repairVehicleCount' }, unit: 'réparations', tiers: palier(2, 1) },
  { id: 'missions',    category: C.fourrage, emoji: '📋', name: 'Sous-traitant',         source: { stat: 'missionCount' },       unit: 'contrats', tiers: palier(2, 2) }, // nom à vérifier (incrémenté par stats:updateMissionDone)

  // ---------------- Élevage & ruches ----------------
  { id: 'naissances',  category: C.elevage, emoji: '🐣', name: 'Naisseur',             source: { statPrefix: 'breed' },         unit: 'naissances', tiers: palier(15, 30) }, // stats statsBreedingName (préfixe à vérifier)
  { id: 'prod_lait',   category: C.elevage, emoji: '🥛', name: 'Producteur laitier',  source: { produced: ['MILK', 'GOATMILK', 'BUFFALOMILK'] }, unit: 'L', tiers: palier(1500, 3500) },
  { id: 'prod_laine',  category: C.elevage, emoji: '🐑', name: 'Tondeur',             source: { produced: ['WOOL'] },  unit: 'L', tiers: palier(1000, 3500) },
  { id: 'prod_oeufs',  category: C.elevage, emoji: '🥚', name: 'Aviculteur',          source: { produced: ['EGG'] },   unit: 'œufs', tiers: palier(500, 2500) },
  { id: 'prod_fumier', category: C.elevage, emoji: '💩', name: 'Roi du fumier',       source: { produced: ['MANURE', 'LIQUIDMANURE'] }, unit: 'L', tiers: proposition(5000000) },
  { id: 'prod_miel',   category: C.elevage, emoji: '🍯', name: 'Roi du miel',          source: { produced: ['HONEY'] }, unit: 'L', tiers: proposition(50000) },
  { id: 'cheval_km',   category: C.elevage, emoji: '🐎', name: 'Cavalier',            source: { stat: 'horseDistance' },  unit: 'km', tiers: proposition(500) },
  { id: 'cheval_saut', category: C.elevage, emoji: '🏇', name: 'Sauteur d\'obstacles', source: { stat: 'horseJumpCount' }, unit: 'sauts', tiers: proposition(500) },

  // ---------------- Argent ----------------
  { id: 'eur_ventes',   category: C.argent, emoji: '🏪', name: 'Grand négociant',     source: { moneyIn: ['SOLD_PRODUCTS', 'HARVEST_INCOME'] }, unit: '€', tiers: proposition(50000000) },
  { id: 'eur_animaux',  category: C.argent, emoji: '🐄', name: 'Marchand de bétail',  source: { moneyIn: ['SOLD_ANIMALS'] },   unit: '€', tiers: proposition(5000000) },
  { id: 'eur_contrats', category: C.argent, emoji: '🤝', name: 'Chasseur de primes',        source: { moneyIn: ['MISSIONS'] },       unit: '€', tiers: proposition(10000000) },
  { id: 'eur_loyers',   category: C.argent, emoji: '🏡', name: 'Rentier',             source: { moneyIn: ['PROPERTY_INCOME'] }, unit: '€', tiers: proposition(2000000) },
  { id: 'eur_total',    category: C.argent, emoji: '💶', name: 'Magnat',              source: { moneyIn: '*' },                unit: '€', tiers: proposition(100000000) },
  { id: 'eur_depenses', category: C.argent, emoji: '💸', name: 'Panier percé',        source: { moneyOut: '*' },               unit: '€', tiers: proposition(100000000) },
  { id: 'eur_carbu',    category: C.argent, emoji: '⛽', name: 'Habitué de la station',  source: { moneyOut: ['PURCHASE_FUEL'] }, unit: '€', tiers: proposition(2000000) },

  // ---------------- Possessions (valeur actuelle) ----------------
  { id: 'vehicules',   category: C.possessions, emoji: '🚜', name: 'Collectionneur',     source: { stat: '_ownedVehicles' },        unit: 'achats', tiers: lineaire(100) },
  // Industriel : 10 niveaux seulement (comme les 10 niveaux d'industrie, 1 usine par niveau) ; Apiculteur : 1 à 5 ruches
  { id: 'usines',      category: C.possessions, emoji: '🏭', name: 'Industriel',         source: { stat: '_ownedProductionPoints' }, unit: 'usines', tiers: palier(1, 0, 10) },
  { id: 'ruches',      category: C.possessions, emoji: '🐝', name: 'Apiculteur',   source: { stat: '_ownedBeehives' },        unit: 'ruches', tiers: palier(1, 0, 5) },
];
