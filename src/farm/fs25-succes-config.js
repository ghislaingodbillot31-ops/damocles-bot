/**
 * Liste des succès FS25 — à modifier librement.
 *
 * Chaque série a jusqu'à 50 niveaux. Un niveau atteint = un succès débloqué.
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
 */

// =================== NIVEAUX ===================
const NB_NIVEAUX = 50;
const COURBE = 2;

/**
 * Niveau i = max x (i / nb)^COURBE, arrondi (écarts qui grandissent doucement).
 * Pour les petits maximums (< 500), progression linéaire : max / nb par niveau.
 */
function niveaux(max, nb = NB_NIVEAUX) {
  const out = [];
  for (let i = 1; i <= nb; i += 1) {
    const lineaire = max < 500;
    const v = lineaire ? (max * i) / nb : max * (i / nb) ** COURBE;
    const step = lineaire ? 1 : v < 50 ? 1 : v < 200 ? 5 : v < 1000 ? 10 : 10 ** (Math.floor(Math.log10(v)) - 2) * 5;
    const r = Math.max(1, Math.round(v / step) * step);
    if (!out.length || r > out[out.length - 1]) out.push(r);
  }
  out[out.length - 1] = max;
  return out;
}

const C = {
  champs: '🚜 Travaux des champs',
  route: '🛣️ Route & conduite',
  fourrage: '🌾 Fourrage, forêt & atelier',
  elevage: '🐄 Élevage & ruches',
  argent: '💰 Argent',
  possessions: '🏠 Possessions',
  divers: '🎯 Divers',
};

module.exports = [
  // ---------------- Travaux des champs ----------------
  { id: 'labour',      category: C.champs, emoji: '🚜', name: 'Laboureur',             source: { stat: 'plowedHectares' },     unit: 'ha', tiers: niveaux(10000) },
  { id: 'dechaumage',  category: C.champs, emoji: '⚙️', name: 'Déchaumeur',            source: { stat: 'cultivatedHectares' }, unit: 'ha', tiers: niveaux(10000) },
  { id: 'semis',       category: C.champs, emoji: '🌱', name: 'Semeur',                source: { stat: 'sownHectares' },       unit: 'ha', tiers: niveaux(10000) },
  { id: 'pulve',       category: C.champs, emoji: '💧', name: 'Pulvérisateur',         source: { stat: 'sprayedHectares' },    unit: 'ha', tiers: niveaux(10000) },
  // Le jeu compte la fauche (Mower) et la moisson (Cutter) dans la même stat
  { id: 'moisson',     category: C.champs, emoji: '🌾', name: 'Moissonneur & Faucheur', source: { stat: 'threshedHectares' },  unit: 'ha', tiers: niveaux(10000) },
  { id: 'travail',     category: C.champs, emoji: '🧑‍🌾', name: 'Bourreau de travail',  source: { stat: 'workedHectares' },     unit: 'ha', tiers: niveaux(50000) },
  { id: 'heures',      category: C.champs, emoji: '⏱️', name: 'Acharné',               source: { stat: 'workedTime' }, scale: 1 / 60, unit: 'h', tiers: niveaux(5000) },
  { id: 'semences',    category: C.champs, emoji: '🫘', name: 'Semencier',             source: { stat: 'seedUsage' },          unit: 'L', tiers: niveaux(2000000) },

  // ---------------- Route & conduite ----------------
  { id: 'distance',    category: C.route, emoji: '🛣️', name: 'Routier',                source: { stat: 'traveledDistance' },   unit: 'km', tiers: niveaux(20000) },
  { id: 'tracteur',    category: C.route, emoji: '🚜', name: 'Tractoriste',            source: { stat: 'tractorDistance' },    unit: 'km', tiers: niveaux(10000) },
  { id: 'camion',      category: C.route, emoji: '🚛', name: 'Camionneur',             source: { stat: 'truckDistance' },      unit: 'km', tiers: niveaux(10000) },
  { id: 'voiture',     category: C.route, emoji: '🚗', name: 'Pilote',                 source: { stat: 'carDistance' },        unit: 'km', tiers: niveaux(5000) },
  { id: 'gasoil',      category: C.route, emoji: '⛽', name: 'Gros buveur de gasoil',   source: { stat: 'fuelUsage' },          unit: 'L', tiers: niveaux(1000000) },

  // ---------------- Fourrage, forêt & atelier ----------------
  { id: 'bottes',      category: C.fourrage, emoji: '🟫', name: 'Botteleur',           source: { stat: 'baleCount' },          unit: 'bottes', tiers: niveaux(10000) },
  { id: 'enrubannage', category: C.fourrage, emoji: '⚪', name: 'Enrubanneur',         source: { stat: 'wrappedBales' },       unit: 'bottes', tiers: niveaux(10000) },
  { id: 'plantation',  category: C.fourrage, emoji: '🌳', name: 'Planteur',            source: { stat: 'plantedTreeCount' },   unit: 'arbres', tiers: niveaux(5000) },
  { id: 'bucheron',    category: C.fourrage, emoji: '🪓', name: 'Bûcheron',            source: { stat: 'cutTreeCount' },       unit: 'arbres', tiers: niveaux(5000) },
  { id: 'mecanicien',  category: C.fourrage, emoji: '🔧', name: 'Mécanicien',          source: { stat: 'repairVehicleCount' }, unit: 'réparations', tiers: niveaux(1000) },
  { id: 'missions',    category: C.fourrage, emoji: '📋', name: 'Prestataire',         source: { stat: 'missionCount' },       unit: 'contrats', tiers: niveaux(1000) }, // nom à vérifier (incrémenté par stats:updateMissionDone)

  // ---------------- Élevage & ruches ----------------
  { id: 'naissances',  category: C.elevage, emoji: '🐣', name: 'Éleveur',             source: { statPrefix: 'breed' },         unit: 'naissances', tiers: niveaux(5000) }, // stats statsBreedingName (préfixe à vérifier)
  { id: 'prod_lait',   category: C.elevage, emoji: '🥛', name: 'Producteur laitier',  source: { produced: ['MILK', 'GOATMILK', 'BUFFALOMILK'] }, unit: 'L', tiers: niveaux(5000000) },
  { id: 'prod_laine',  category: C.elevage, emoji: '🐑', name: 'Tondeur',             source: { produced: ['WOOL'] },  unit: 'L', tiers: niveaux(200000) },
  { id: 'prod_oeufs',  category: C.elevage, emoji: '🥚', name: 'Aviculteur',          source: { produced: ['EGG'] },   unit: 'œufs', tiers: niveaux(200000) },
  { id: 'prod_fumier', category: C.elevage, emoji: '💩', name: 'Roi du fumier',       source: { produced: ['MANURE', 'LIQUIDMANURE'] }, unit: 'L', tiers: niveaux(10000000) },
  { id: 'prod_miel',   category: C.elevage, emoji: '🍯', name: 'Apiculteur',          source: { produced: ['HONEY'] }, unit: 'L', tiers: niveaux(200000) },
  { id: 'cheval_km',   category: C.elevage, emoji: '🐎', name: 'Cavalier',            source: { stat: 'horseDistance' },  unit: 'km', tiers: niveaux(1000) },
  { id: 'cheval_saut', category: C.elevage, emoji: '🏇', name: 'Sauteur d\'obstacles', source: { stat: 'horseJumpCount' }, unit: 'sauts', tiers: niveaux(1000) },

  // ---------------- Argent ----------------
  { id: 'eur_ventes',   category: C.argent, emoji: '🏪', name: 'Grand négociant',     source: { moneyIn: ['SOLD_PRODUCTS', 'HARVEST_INCOME'] }, unit: '€', tiers: niveaux(100000000) },
  { id: 'eur_animaux',  category: C.argent, emoji: '🐄', name: 'Marchand de bétail',  source: { moneyIn: ['SOLD_ANIMALS'] },   unit: '€', tiers: niveaux(10000000) },
  { id: 'eur_contrats', category: C.argent, emoji: '🤝', name: 'Entrepreneur',        source: { moneyIn: ['MISSIONS'] },       unit: '€', tiers: niveaux(20000000) },
  { id: 'eur_loyers',   category: C.argent, emoji: '🏡', name: 'Rentier',             source: { moneyIn: ['PROPERTY_INCOME'] }, unit: '€', tiers: niveaux(5000000) },
  { id: 'eur_total',    category: C.argent, emoji: '💶', name: 'Magnat',              source: { moneyIn: '*' },                unit: '€', tiers: niveaux(200000000) },
  { id: 'eur_depenses', category: C.argent, emoji: '💸', name: 'Panier percé',        source: { moneyOut: '*' },               unit: '€', tiers: niveaux(200000000) },
  { id: 'eur_carbu',    category: C.argent, emoji: '⛽', name: 'Client de la pompe',  source: { moneyOut: ['PURCHASE_FUEL'] }, unit: '€', tiers: niveaux(5000000) },

  // ---------------- Possessions (valeur actuelle) ----------------
  { id: 'vehicules',   category: C.possessions, emoji: '🚜', name: 'Collectionneur',     source: { stat: '_ownedVehicles' },        unit: 'véhicules', tiers: niveaux(250) },
  { id: 'usines',      category: C.possessions, emoji: '🏭', name: 'Industriel',         source: { stat: '_ownedProductionPoints' }, unit: 'usines', tiers: niveaux(50) },
  { id: 'ruches',      category: C.possessions, emoji: '🐝', name: 'Roi des abeilles',   source: { stat: '_ownedBeehives' },        unit: 'ruches', tiers: niveaux(100) },

  // ---------------- Divers ----------------
  { id: 'chien',       category: C.divers, emoji: '🐕', name: 'Ami des chiens',       source: { stat: 'petDogCount' },        unit: 'caresses', tiers: niveaux(1000) },
];
