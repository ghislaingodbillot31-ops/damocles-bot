import React, { useState, useEffect } from 'react';

const FIELDS = [
  { section: '🎭 Rôles', fields: [
    { key: 'VERIFICATION_ROLE_ID',    label: 'Rôle Vérification' },
    { key: 'REGLEMENT_ROLE_ID',       label: 'Rôle Règlement' },
    { key: 'ACTIVE_ROLE_ID',          label: 'Rôle Actif' },
    { key: 'INACTIVE_ROLE_ID',        label: 'Rôle Inactif' },
    { key: 'REGLES_ACCEPTEES_ROLE_ID',label: 'Rôle Règles acceptées' },
    { key: 'ATTENTE_ROLE_ID',         label: 'Rôle Attente Admin' },
    { key: 'TICKET_SUPPORT_ROLE_ID',  label: 'Rôle Support Tickets' },
    { key: 'EXCLUDED_ROLE_IDS',       label: 'Rôles exclus (séparés par virgule)' },
  ]},
  { section: '💬 Salons', fields: [
    { key: 'VERIFICATION_CHANNEL_ID', label: 'Salon #verification' },
    { key: 'REGLEMENT_CHANNEL_ID',    label: 'Salon #reglement' },
    { key: 'CHAT_CHANNEL_ID',         label: 'Salon #chat' },
    { key: 'LOG_CHANNEL_ID',          label: 'Salon logs admin' },
    { key: 'STATUS_CHANNEL_ID',       label: 'Salon #status-joueurs' },
    { key: 'DAMOCLES_LOG_CHANNEL_ID', label: 'Salon #damocles-log' },
    { key: 'ROLES_CHANNEL_ID',        label: 'Salon rôles' },
    { key: 'TICKET_CATEGORY_ID',      label: 'Catégorie tickets' },
  ]},
  { section: '⚙️ Seuils sécurité', fields: [
    { key: 'RAID_THRESHOLD',  label: 'Anti-raid : nb de joins', type: 'number' },
    { key: 'RAID_WINDOW_MS',  label: 'Anti-raid : fenêtre (ms)', type: 'number' },
    { key: 'SPAM_THRESHOLD',  label: 'Anti-spam : nb messages', type: 'number' },
    { key: 'SPAM_WINDOW_MS',  label: 'Anti-spam : fenêtre (ms)', type: 'number' },
  ]},
  { section: '📅 Inactivité', fields: [
    { key: 'INACTIVE_DAYS', label: 'Jours avant inactif', type: 'number' },
    { key: 'EXPEL_DAYS',    label: 'Jours avant expulsion', type: 'number' },
  ]},
];

export default function Config() {
  const [cfg, setCfg] = useState({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/config').then(r => r.json()),
      fetch('/api/channels').then(r => r.json()).catch(() => []),
      fetch('/api/roles').then(r => r.json()).catch(() => []),
      fetch('/api/categories').then(r => r.json()).catch(() => []),
    ]).then(([config, ch, ro, cat]) => {
      setCfg(config);
      setChannels(ch);
      setRoles(ro);
      setCategories(cat);
      setLoading(false);
    });
  }, []);

  async function save() {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <div className="text-gray-400">Chargement...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Configuration</h1>
        <button onClick={save}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
          {saved ? '✅ Sauvegardé !' : '💾 Sauvegarder'}
        </button>
      </div>

      <div className="space-y-6">
        {FIELDS.map(section => (
          <div key={section.section} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">{section.section}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.fields.map(field => {
                // Détecter si c'est un ID de salon ou de rôle
                const isCategory = field.key.includes('CATEGORY');
                const isChannel  = field.key.includes('CHANNEL');
                const isRole     = field.key.includes('ROLE') && !field.key.includes('CHANNEL');
                const options    = isCategory ? categories : isChannel ? channels : isRole ? roles : null;

                return (
                  <div key={field.key}>
                    <label className="block text-gray-400 text-xs mb-1">{field.label}</label>
                    {options && options.length > 0 ? (
                      <select
                        value={cfg[field.key] || ''}
                        onChange={e => setCfg(c => ({ ...c, [field.key]: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                        <option value="">— Sélectionner —</option>
                        {options.map(o => (
                          <option key={o.id} value={o.id}>{isCategory ? '📁' : '#'}{o.name} ({o.id})</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={cfg[field.key] || ''}
                        onChange={e => setCfg(c => ({ ...c, [field.key]: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                        placeholder={field.key} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
