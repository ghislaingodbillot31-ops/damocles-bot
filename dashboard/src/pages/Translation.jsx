import React, { useState, useEffect } from 'react';

export default function Translation() {
  const [config, setConfigState] = useState({ enabled: false, channels: [] });
  const [channels, setChannels]  = useState([]);
  const [loading, setLoading]    = useState(true);
  const [saving, setSaving]      = useState(false);
  const [success, setSuccess]    = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/translation').then(r => r.json()).catch(() => ({ enabled: false, channels: [] })),
      fetch('/api/channels').then(r => r.json()).catch(() => []),
    ]).then(([cfg, ch]) => {
      setConfigState(cfg);
      setChannels(ch);
      setLoading(false);
    });
  }, []);

  function toggleChannel(id) {
    setConfigState(c => ({
      ...c,
      channels: c.channels.includes(id)
        ? c.channels.filter(x => x !== id)
        : [...c.channels, id],
    }));
  }

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/translation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setSuccess('Configuration sauvegardée !');
      setTimeout(() => setSuccess(''), 3000);
    } catch {}
    setSaving(false);
  }

  if (loading) return <div className="text-gray-400">Chargement...</div>;

  // Grouper les salons par catégorie
  const categories = {};
  for (const ch of channels) {
    const cat = ch.category || '— Sans catégorie —';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(ch);
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🌐 Traduction automatique</h1>
          <p className="text-gray-400 text-sm mt-1">FR ↔ EN — Réponse discrète sous le message original</p>
        </div>
        {/* Toggle global */}
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">{config.enabled ? 'Activé' : 'Désactivé'}</span>
          <button onClick={() => setConfigState(c => ({ ...c, enabled: !c.enabled }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-indigo-600' : 'bg-gray-700'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${config.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-green-900/20 border border-green-800 text-green-400 rounded-lg px-4 py-3 mb-4 text-sm flex-shrink-0">
          ✅ {success}
        </div>
      )}

      {/* Explication */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex-shrink-0">
        <div className="flex gap-4 text-sm">
          <div className="flex-1">
            <div className="text-gray-400 text-xs uppercase mb-2">Comment ça marche</div>
            <div className="space-y-1.5 text-gray-300 text-xs">
              <div className="flex items-start gap-2"><span>🇬🇧</span><span>Un membre écrit en anglais → le bot répond avec la traduction en 🇫🇷 français</span></div>
              <div className="flex items-start gap-2"><span>🇫🇷</span><span>Un membre écrit en français → le bot répond avec la traduction en 🇬🇧 anglais</span></div>
              <div className="flex items-start gap-2"><span>🤫</span><span>La réponse est discrète (embed simple, sans ping)</span></div>
              <div className="flex items-start gap-2"><span>⚡</span><span>Uniquement dans les salons sélectionnés ci-dessous</span></div>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-gray-400 text-xs uppercase mb-2">Aperçu</div>
            <div className="bg-gray-800 rounded-lg p-3 text-xs space-y-2">
              <div className="text-gray-300">👤 <span className="text-white">Player123</span> : Hello, can I join the server?</div>
              <div className="border-l-2 border-blue-500 pl-2">
                <div className="text-gray-500">DAMOCLES Bot</div>
                <div className="text-blue-300">🇬🇧 → 🇫🇷 Français</div>
                <div className="text-gray-300 italic">Bonjour, puis-je rejoindre le serveur ?</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sélection des salons */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Salons activés ({config.channels.length})</h2>
          <div className="flex gap-2">
            <button onClick={() => setConfigState(c => ({ ...c, channels: channels.map(ch => ch.id) }))}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded border border-indigo-800 hover:bg-indigo-900/20 transition-colors">
              Tout sélectionner
            </button>
            <button onClick={() => setConfigState(c => ({ ...c, channels: [] }))}
              className="text-xs text-gray-400 hover:text-gray-300 px-2 py-1 rounded border border-gray-700 hover:bg-gray-800 transition-colors">
              Tout désélectionner
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(categories).map(([cat, chs]) => (
            <div key={cat}>
              <div className="text-gray-500 text-xs uppercase mb-2 flex items-center gap-2">
                <span>📁</span>{cat}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {chs.map(ch => {
                  const active = config.channels.includes(ch.id);
                  return (
                    <button key={ch.id} onClick={() => toggleChannel(ch.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-all ${
                        active
                          ? 'border-indigo-600 bg-indigo-900/20 text-white'
                          : 'border-gray-800 text-gray-400 hover:border-gray-600 hover:bg-gray-800'
                      }`}>
                      <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border text-xs ${
                        active ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-600'
                      }`}>
                        {active ? '✓' : ''}
                      </span>
                      <span className="truncate">#{ch.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bouton save */}
      <div className="mt-4 flex-shrink-0">
        <button onClick={save} disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
          {saving ? '⏳ Enregistrement...' : '💾 Enregistrer la configuration'}
        </button>
      </div>
    </div>
  );
}
