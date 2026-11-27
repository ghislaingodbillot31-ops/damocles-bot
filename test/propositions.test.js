const assert = require('assert');
process.env.DATA_DIR = require('os').tmpdir() + '/prop-test-' + Date.now();
require('fs').mkdirSync(process.env.DATA_DIR, { recursive: true });
const p = require('../src/community/propositions');

(async () => {
  const sent = [];
  const channel = { send: async (m) => { sent.push(m); return { id: 'm' + sent.length }; } };
  const client = { channels: { cache: { get: () => channel } } };
  const replies = [];
  const fields = { titre: ' Nouveau mod ', texte: 'x'.repeat(300) };
  await p.handleModal({ customId: 'prop_modal_mod', client, user: { id: 'u1' }, fields: { getTextInputValue: (k) => fields[k] }, reply: async (r) => replies.push(r) });
  const s = p._store().items[1];
  assert.strictEqual(s.texte.length, 200);          // description limitée à 200 caractères
  assert.strictEqual(s.titre, 'Nouveau mod');
  assert.strictEqual(s.cat, 'mod');

  const voter = async (id, uid) => { let out; await p.handleVote({ customId: id, user: { id: uid }, update: async (m) => { out = m; } }); return out; };
  let m = await voter('prop_pour_1', 'a');
  await voter('prop_pour_1', 'b');
  m = await voter('prop_contre_1', 'c');
  const labels = m.components[0].components.map((b) => b.data.label);
  assert.deepStrictEqual(labels, ['👍 Pour · 2', '👎 Contre · 1', '👥 Votants']);
  m = await voter('prop_pour_1', 'a');                  // recliquer retire le vote
  assert.strictEqual(m.components[0].components[0].data.label, '👍 Pour · 1');
  m = await voter('prop_contre_1', 'b');                // l'autre bouton change le vote
  assert.deepStrictEqual(m.components[0].components.map((b) => b.data.label), ['👍 Pour · 0', '👎 Contre · 2', '👥 Votants']);

  let v;
  await p.handleVotants({ customId: 'prop_votants_1', reply: async (r) => { v = r; } });
  assert.ok(v.embeds[0].fields[1].value.includes('<@b>') && v.embeds[0].fields[1].value.includes('<@c>'));
  assert.ok(v.embeds[0].fields[0].value.includes('Personne'));
  console.log('ok');
})();
