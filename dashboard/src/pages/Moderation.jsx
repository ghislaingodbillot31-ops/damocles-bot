import React, { useState, useEffect } from 'react';

export default function Moderation() {
  const [config, setConfig] = useState({
    BANNED_WORDS: '',
    LINKS_ALLOWED_ROLES: '',
    LINKS_BLOCKED: false,
    SPAM_THRESHOLD: 5,
    SPAM_WINDOW_MS: 5000,
    RAID_THRESHOLD: 10,
    RAID_WINDOW_MS: 10000,
  });
  const [roles, setRoles] = useState([]);
  const [saved, setSaved] = useState(false);
  const [newWord, setNewWord] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/config').then(r => r.json()),
      fetch('/api/roles').then(r => r.json()).catch(() => []),
    ]).then(([cfg, ro]) => {
      setConfig(c => ({ ...c, ...cfg }));
      setRoles(ro);
    });
  }, []);

  const words = (config.BANNED_WORDS || '').split(',').map(w => w.trim()).filter(Boolean);

  function addWord() {
    if (!newWord.trim()) return;
    const updated = [...words, newWord.trim().toLowerCase()].join(',');
    setConfig(c => ({ ...c, BANNED_WORDS: updated }));
    setNewWord('');
  }

  function removeWord(word) {
    const updated = words.filter(w => w !== word).join(',');
    setConfig(c => ({ ...c, BANNED_WORDS: updated }));
  }

  const allowedRoles = (config.LINKS_ALLOWED_ROLES || '').split(',').filter(Boolean);

  function toggleRole(roleId) {
    const current = allowedRoles.includes(roleId)
      ? allowedRoles.filter(r => r !== roleId)
      : [...allowedRoles, roleId];
    setConfig(c => ({ ...c, LINKS_ALLOWED_ROLES: current.join(',') }));
  }

  async function save() {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Modération</h1>

      <div className="space-y-6">

        {/* Mots interdits */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">🚫 Mots interdits</h2>
          <p className="text-gray-400 text-sm mb-4">Les messages contenant ces mots seront supprimés automatiquement et un avertissement sera enregistré.</p>

          <div className="flex gap-2 mb-4">
            <input value={newWord}
              onChange={e => setNewWord(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addWord()}
              placeholder="Ajouter un mot..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
            <button onClick={addWord}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Ajouter
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {words.length === 0 ? (
              <span className="text-gray-500 text-sm">Aucun mot interdit</span>
            ) : words.map(w => (
              <span key={w} className="flex items-center gap-1 bg-red-900/30 border border-red-800 text-red-400 px-3 py-1 rounded-full text-sm">
                {w}
                <button onClick={() => removeWord(w)} className="hover:text-white ml-1">✕</button>
              </span>
            ))}
          </div>
        </div>

        {/* Gestion des liens */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold">🔗 Blocage des liens</h2>
              <p className="text-gray-400 text-sm mt-1">Bloquer tous les liens sauf pour les rôles autorisés</p>
            </div>
            <div onClick={() => setConfig(c => ({ ...c, LINKS_BLOCKED: !c.LINKS_BLOCKED }))}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${config.LINKS_BLOCKED ? 'bg-indigo-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${config.LINKS_BLOCKED ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
          </div>

          {config.LINKS_BLOCKED && (
            <div>
              <label className="block text-gray-400 text-xs mb-2">Rôles autorisés à poster des liens</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {roles.filter(r => !r.name.startsWith('@')).map(r => (
                  <div key={r.id} onClick={() => toggleRole(r.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      allowedRoles.includes(r.id)
                        ? 'bg-indigo-900/30 border-indigo-700 text-indigo-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}>
                    <div className={`w-2 h-2 rounded-full ${allowedRoles.includes(r.id) ? 'bg-indigo-400' : 'bg-gray-600'}`} />
                    <span className="text-sm truncate">@{r.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Seuils anti-spam / anti-raid */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">⚙️ Seuils de détection</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">Anti-spam — messages avant alerte</label>
              <input type="number" min="2" max="20"
                value={config.SPAM_THRESHOLD || 5}
                onChange={e => setConfig(c => ({ ...c, SPAM_THRESHOLD: parseInt(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Anti-spam — fenêtre (secondes)</label>
              <input type="number" min="1" max="60"
                value={Math.round((config.SPAM_WINDOW_MS || 5000) / 1000)}
                onChange={e => setConfig(c => ({ ...c, SPAM_WINDOW_MS: parseInt(e.target.value) * 1000 }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Anti-raid — joins avant kick</label>
              <input type="number" min="3" max="50"
                value={config.RAID_THRESHOLD || 10}
                onChange={e => setConfig(c => ({ ...c, RAID_THRESHOLD: parseInt(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Anti-raid — fenêtre (secondes)</label>
              <input type="number" min="1" max="60"
                value={Math.round((config.RAID_WINDOW_MS || 10000) / 1000)}
                onChange={e => setConfig(c => ({ ...c, RAID_WINDOW_MS: parseInt(e.target.value) * 1000 }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
        </div>

        <button onClick={save}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
          {saved ? '✅ Sauvegardé !' : '💾 Enregistrer'}
        </button>

      </div>
    </div>
  );
}
