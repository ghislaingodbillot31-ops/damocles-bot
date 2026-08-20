// Script de migration - Lance UNE SEULE FOIS
// node src/migrate-to-mongo.js

require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs   = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PATH     = path.join(__dirname, '..', 'data', 'members.json');

async function migrate() {
  console.log('🍃 Connexion MongoDB...');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db  = client.db('damocles');
  const col = db.collection('members');

  // Vider la collection existante
  await col.deleteMany({});
  console.log('🗑️ Collection vidée');

  // Charger members.json
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const members = Object.values(data);
  console.log('📂 ' + members.length + ' membres à migrer...');

  // Insérer par batch de 100
  for (let i = 0; i < members.length; i += 100) {
    const batch = members.slice(i, i + 100);
    await col.insertMany(batch);
    console.log('✅ ' + Math.min(i + 100, members.length) + '/' + members.length);
  }

  // Créer un index sur id
  await col.createIndex({ id: 1 }, { unique: true });
  console.log('📊 Index créé sur id');

  const count = await col.countDocuments();
  console.log('\n✅ Migration terminée — ' + count + ' membres dans MongoDB');

  await client.close();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Erreur migration :', err.message);
  process.exit(1);
});
