// Auto-vérification de la logique : DATA_DIR=<dossier temporaire> node src/multifruit/test.js
const assert = require('assert');
const J = require('./systems/jeu');
const U = 'u1';
assert.throws(() => J.etat(U), /pas encore/);
J.creerEntreprise(U, 'Jus Test');
assert.throws(() => J.creerEntreprise('u2', 'jus test'), /déjà pris/);
assert.throws(() => J.lancerPressage(U, 'pomme', 10), /machine compatible/);
J.acheterMachine(U, 'pressoir_manuel'); J.acheterMachine(U, 'remplisseuse_manuelle');
J.acheterFruits(U, 'pomme', 2);
J.lancerPressage(U, 'pomme', 20);
assert.throws(() => J.lancerPressage(U, 'pomme', 1), /occupé|stock/);          // double lancement
assert.throws(() => J.acheterFruits(U, 'pomme', 50), /plein|Fonds/);
const { db } = require('./db/db');
db.prepare('UPDATE multifruit_lots SET fin = 0').run();                         // simule l'écoulement du temps
let e = J.etat(U);
assert.equal(e.cuves[0].volume_l, 13); assert.equal(e.cuves[0].jus_id, 'jus_pomme');
J.commanderContenants(U, 'pet_1l', 10);
J.mettreEnBouteille(U, e.cuves[0].id, 'pet_1l', 10);
db.prepare('UPDATE multifruit_lots SET fin = 0').run();
e = J.etat(U);
assert.equal(e.produits[0].quantite, 10); assert.equal(e.cuves[0].volume_l, 3);
const avant = e.ent.pieces;
J.vendre(U, 'jus_pomme', 'pet_1l', 10);
assert.equal(J.etat(U).ent.pieces, Math.round((avant + 10 * require('./systems/contenu').jus.jus_pomme.prix_vente_l * require('./systems/contenu').eq.comptoir_coef) * 100) / 100);
assert.throws(() => J.vendre(U, 'jus_pomme', 'pet_1l', 1), /Tu n'as que/);
console.log('✅ Multifruit : logique OK');
// classements
const J2 = require('./systems/jeu');
const cl = k => J2.classement(k, 50).find(r => r.nom === 'Jus Test');
assert.equal(cl('fruits_presses_kg').valeur, 20); assert.equal(cl('jus_presse_l').valeur, 13);
assert.equal(cl('bouteilles_generees').valeur, 10); assert.equal(cl('bouteilles_vendues').valeur, 10);
assert.ok(cl('pieces'));
const V = require('./ui/vues'); assert.equal(V.panneauClassements().embeds[0].fields.length, 5);
console.log('✅ classements OK');
// bons de commande : prise, limite, livraison tout-ou-rien
const lot = J2.bons(); assert.equal(lot.length, 5);
J2.accepterBon(U, lot[0].id);
assert.throws(() => J2.accepterBon(U, lot[0].id), /déjà été pris/);
assert.equal(J2.bons().length, 5);                                   // le bon pris est remplacé
const cmd = J2.etat(U).commandes[0]; assert.ok(cmd.echeance > Date.now() + 23 * 3600e3);
assert.throws(() => J2.livrerCommande(U, cmd.id), /incomplète/);
assert.ok(V.panneauMarche().components[0].components.length === 5 && V.vueHub(J2.etat(U)));
console.log('✅ bons de commande OK');
