const assert = require('assert');
process.env.DATA_DIR = require('os').tmpdir() + '/avert-test-' + Date.now();
require('fs').mkdirSync(process.env.DATA_DIR, { recursive: true });
const exp = require('../src/farm/exploitation');
const credit = require('../src/farm/credit');
const { PermissionFlagsBits } = require('discord.js');

(async () => {
  const e0 = exp.createExploitation('owner', 'owner#1', 'Ferme Test');
  exp.addOuvrier(e0.id, 'ouvrier', 'ouvrier#1');
  const id = e0.id;

  const kicked = [], dms = [];
  const membre = (uid, admin) => ({
    permissions: { has: (p) => admin && p === PermissionFlagsBits.Administrator },
    kickable: true, send: async (m) => dms.push([uid, m]), kick: async (r) => kicked.push([uid, r]),
  });
  const guild = { members: { fetch: async (uid) => membre(uid, uid === 'owner') } }; // le propriétaire est administrateur : épargné
  const client = { channels: { fetch: async () => ({ send: async () => {} }) } };
  const admin = { permissions: { has: () => true }, displayName: 'Admin' };
  let rep;
  const base = (extra) => ({ member: admin, user: { id: 'adm' }, guild, client, ...extra,
    reply: async (r) => { rep = { type: 'reply', ...r }; }, update: async (r) => { rep = { type: 'update', ...r }; } });
  const modal = (raison) => credit.handle(base({ isButton: () => false, isStringSelectMenu: () => false, isModalSubmit: () => true,
    customId: 'cred_modal_avertir_' + id, fields: { getTextInputValue: () => raison } }));
  const bouton = (cid) => credit.handle(base({ isButton: () => true, isStringSelectMenu: () => false, isModalSubmit: () => false, customId: cid }));

  await modal('Comportement toxique');
  assert.strictEqual(exp.getById(id).avertissements.length, 1);
  await modal('Triche');
  assert.strictEqual(exp.getById(id).avertissements.length, 2);
  assert.ok(credit.ligneCredit(exp.getById(id)).includes('2 / 3'));
  assert.strictEqual(kicked.length, 0);

  await modal('Récidive');                                   // 3e : confirmation demandée, rien n'est encore fait
  assert.strictEqual(exp.getById(id).avertissements.length, 2);
  assert.ok(rep.embeds[0].title.includes('3e avertissement') && rep.components.length === 1);
  assert.strictEqual(kicked.length, 0);

  await bouton('cred_warnno_' + id);                         // annulé : rien ne change
  assert.strictEqual(exp.getById(id).avertissements.length, 2);

  await modal('Récidive');
  await bouton('cred_warnok_' + id);                         // confirmé : l'ouvrier est expulsé, le propriétaire (admin) est épargné
  assert.deepStrictEqual(kicked.map((k) => k[0]), ['ouvrier']);
  assert.ok(kicked[0][1].includes('Récidive'));
  assert.strictEqual(dms.length, 1);                         // MP envoyé avant l'expulsion
  const e = exp.getById(id);
  assert.strictEqual(e.avertissements.length, 0);            // compteur remis à zéro
  assert.strictEqual(e.avertHisto.length, 3);                // historique conservé
  console.log('ok');
})().catch((err) => { console.error(err); process.exit(1); });
