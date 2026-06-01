import React, { useState, useEffect } from 'react';

const STATUS_COLORS = {
  active:   'text-green-400 bg-green-900/20 border-green-800',
  inactive: 'text-yellow-400 bg-yellow-900/20 border-yellow-800',
  banned:   'text-red-400 bg-red-900/20 border-red-800',
  kicked:   'text-orange-400 bg-orange-900/20 border-orange-800',
  left:     'text-gray-400 bg-gray-900/20 border-gray-800',
};

const STATUS_LABELS = {
  active: '✅ Actif', inactive: '🟡 Inactif',
  banned: '🔨 Banni', kicked: '👢 Expulsé', left: '🚪 Parti',
};

export default function Members() {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState({ type: null, reason: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/members').then(r => r.json()).then(data => {
      setMembers(data);
      setLoading(false);
    });
  }, []);

  const filtered = members.filter(m => {
    const matchSearch = m.username?.toLowerCase().includes(search.toLowerCase()) || m.id?.includes(search);
    const matchFilter = filter === 'all' || m.status === filter;
    return matchSearch && matchFilter;
  });

  async function doAction() {
    if (!selected || !action.type) return;
    const res = await fetch('/api/members/' + selected.id + '/' + action.type, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: action.reason }),
    });
    const data = await res.json();
    if (data.success) {
      fetch('/api/members').then(r => r.json()).then(setMembers);
      setAction({ type: null, reason: '' });
      setSelected(null);
    }
  }

  if (loading) return <div className="text-gray-400">Chargement...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Membres</h1>

      <div className="flex gap-3 mb-6">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par pseudo ou ID..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white text-sm focus:outline-none">
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
          <option value="banned">Bannis</option>
          <option value="kicked">Expulsés</option>
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 px-4 py-3 text-xs text-gray-500 uppercase border-b border-gray-800">
          <div>Membre</div><div>ID</div><div>Statut</div><div>Actions</div>
        </div>
        <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
          {filtered.slice(0, 100).map(m => (
            <div key={m.id} className="grid grid-cols-4 px-4 py-3 items-center hover:bg-gray-800/50">
              <div className="text-white text-sm font-medium">{m.username || 'Inconnu'}</div>
              <div className="text-gray-500 text-xs font-mono">{m.id}</div>
              <div>
                <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[m.status] || STATUS_COLORS.left}`}>
                  {STATUS_LABELS[m.status] || m.status}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setSelected(m); setAction({ type: 'warn', reason: '' }); }}
                  className="text-xs bg-yellow-900/30 border border-yellow-800 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-900/50">
                  ⚠️
                </button>
                <button onClick={() => { setSelected(m); setAction({ type: 'kick', reason: '' }); }}
                  className="text-xs bg-orange-900/30 border border-orange-800 text-orange-400 px-2 py-1 rounded hover:bg-orange-900/50">
                  👢
                </button>
                <button onClick={() => { setSelected(m); setAction({ type: 'ban', reason: '' }); }}
                  className="text-xs bg-red-900/30 border border-red-800 text-red-400 px-2 py-1 rounded hover:bg-red-900/50">
                  🔨
                </button>
                <button onClick={() => setSelected(selected?.id === m.id ? null : m)}
                  className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-1 rounded hover:bg-gray-700">
                  👁️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {filtered.length > 100 && (
        <p className="text-gray-500 text-sm mt-2">Affichage de 100/{filtered.length} membres</p>
      )}

      {/* Modal action */}
      {action.type && selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-bold mb-4">
              {action.type === 'ban' ? '🔨 Bannir' : action.type === 'kick' ? '👢 Expulser' : '⚠️ Avertir'} — {selected.username}
            </h2>
            <input value={action.reason} onChange={e => setAction(a => ({ ...a, reason: e.target.value }))}
              placeholder="Raison..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm mb-4 focus:outline-none focus:border-indigo-500" />
            <div className="flex gap-3">
              <button onClick={doAction}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                Confirmer
              </button>
              <button onClick={() => setAction({ type: null, reason: '' })}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel détail membre */}
      {selected && !action.type && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-bold">{selected.username}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">ID</span><span className="text-white font-mono">{selected.id}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Statut</span><span>{STATUS_LABELS[selected.status]}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Arrivé le</span><span className="text-white">{selected.joinedAt ? new Date(selected.joinedAt).toLocaleDateString('fr-FR') : '?'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Dernière activité</span><span className="text-white">{selected.lastActivity ? new Date(selected.lastActivity).toLocaleDateString('fr-FR') : 'Jamais'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Avertissements</span><span className="text-yellow-400">{selected.warnings?.length || 0}/3</span></div>
            </div>
            {selected.history?.length > 0 && (
              <div className="mt-4">
                <div className="text-gray-400 text-xs uppercase mb-2">Historique</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selected.history.slice(-10).reverse().map((h, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-300">{h.event}</span>
                      <span className="text-gray-500">{new Date(h.date).toLocaleDateString('fr-FR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
