// Vérifie que tous les écrans se construisent (limites Discord comprises) : DATA_DIR=<tmp> node src/multifruit/test-vues.js
const J = require('./systems/jeu'), V = require('./ui/vues');
const { ActionRowBuilder } = require('discord.js');
const U = 'v1';
J.creerEntreprise(U, 'Vues Co');
J.acheterMachine(U, 'pressoir_manuel'); J.acheterMachine(U, 'remplisseuse_manuelle');
J.acheterFruits(U, 'pomme', 2); J.commanderContenants(U, 'pet_1l', 30); J.lancerPressage(U, 'pomme', 10);
require('./db/db').db.prepare('UPDATE multifruit_lots SET fin = 0').run();
const e = J.etat(U);
const m = J.maxPressage(e, 'pomme'); if (!(m.max > 0)) throw new Error('max pressage');
for (const v of [V.vueHub(e), V.vueAchatFruits(e), V.vuePressage(e), V.vueBouteille(e), V.vueBouteilleContenant(e, e.cuves[0].id), V.vueContenants(e), V.vueUsine(e)]) {
  for (const row of v.components) JSON.stringify(row.toJSON());
  for (const row of v.components) for (const c of row.components) for (const o of (c.options || [])) if ((o.data.description || '').length > 100) throw new Error('description trop longue');
}
console.log('✅ vues OK', m.max, 'kg max;', J.maxBouteille(e, e.cuves[0].id, 'pet_1l').max, 'bouteilles max');
