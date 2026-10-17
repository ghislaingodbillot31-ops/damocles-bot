import React, { useState, useEffect } from 'react';

const STATUS_COLORS = {
  active:   'text-green-400 bg-green-900/20 border-green-800',
  inactive: 'text-yellow-400 bg-yellow-900/20 border-yellow-800',
  banned:   'text-red-400 bg-red-900/20 border-red-800',
  kicked:   'text-orange-400 bg-orange-900/20 border-orange-800',
  left:     'text-gray-400 bg-gray-800 border-gray-700',
};
const STATUS_LABELS = {
  active: '✅ Actif', inactive: '🟡 Inactif',
  banned: '🔨 Banni', kicked: '👢 Expulsé', left: '🚪 Parti',
};

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}
function fmtFull(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
}
function ageDays(iso) {
  if (!iso) return '—';
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) + 'j';
}

export default function Members() {
  const [members, setMembers]   = useState([]);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [sortBy, setSortBy]     = useState('joinedAt');
  const [sortDir, setSortDir]   = useState('desc');
  const [page, setPage]         = useState(1);
  const [selected, setSelected] = useState(null);
  const [action, setAction]     = useState({ type: null, reason: '' });
  const [loading, setLoading]   = useState(true);
  const [copied, setCopied]     = useState('');
  const PER_PAGE = 30;

  useEffect(() => {
    fetch('/api/members').then(r => r.json()).then(data => {
      setMembers(data);
      setLoading(false);
    });
  }, []);

  function copy(text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(''), 2000);
    });
  }

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  const filtered = members
    .filter(m => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        m.username?.toLowerCase().includes(q) ||
        m.tag?.toLowerCase().includes(q) ||
        m.id?.includes(q);
      const matchFilter = filter === 'all' || m.status === filter;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy];
      if (!va) return 1; if (!vb) return -1;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function SortIcon({ col }) {
    if (sortBy !== col) return <span className="text-gray-700 ml-1">↕</span>;
    return <span className="text-indigo-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  async function doAction() {
    if (!selected || !action.type) return;
    await fetch('/api/members/' + selected.id + '/' + action.type, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: action.reason }),
    });
    fetch('/api/members').then(r => r.json()).then(setMembers);
    setAction({ type: null, reason: '' });
    setSelected(null);
  }

  if (loading) return <div className="text-gray-400 p-6">Chargement des {members.length || '...'} membres...</div>;

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Membres</h1>
          <p className="text-gray-400 text-sm mt-1">
            {filtered.length} affiché(s) sur {members.length} total
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-4 flex-shrink-0">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 Pseudo, tag ou ID Discord..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
          <option value="all">Tous les statuts</option>
          <option value="active">✅ Actifs</option>
          <option value="inactive">🟡 Inactifs</option>
          <option value="banned">🔨 Bannis</option>
          <option value="kicked">👢 Expulsés</option>
          <option value="left">🚪 Partis</option>
        </select>
      </div>

      {/* Tableau */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto flex-1 overflow-y-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="sticky top-0 bg-gray-900 z-10">
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                {[
                  { key: 'username',     label: 'Pseudo' },
                  { key: 'id',           label: 'ID Discord' },
                  { key: 'status',       label: 'Statut' },
                  { key: 'joinedAt',     label: 'Arrivée' },
                  { key: 'firstSeen',    label: 'Âge compte' },
                  { key: 'lastActivity', label: 'Dernière activité' },
                  { key: 'warnings',     label: 'Avert.' },
                ].map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}
                    className="px-4 py-3 text-left cursor-pointer hover:text-gray-300 select-none whitespace-nowrap">
                    {col.label}<SortIcon col={col.key} />
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {paginated.map(m => (
                <tr key={m.id} className="hover:bg-gray-800/40 transition-colors">
                  {/* Pseudo */}
                  <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                    {m.username || m.tag || '—'}
                  </td>
                  {/* ID Discord — copiable */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 font-mono text-xs">{m.id}</span>
                      <button onClick={() => copy(m.id)}
                        className="text-gray-600 hover:text-gray-300 text-xs ml-1 transition-colors"
                        title="Copier l'ID">
                        {copied === m.id ? '✅' : '📋'}
                      </button>
                    </div>
                  </td>
                  {/* Statut */}
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[m.status] || STATUS_COLORS.left}`}>
                      {STATUS_LABELS[m.status] || m.status || '?'}
                    </span>
                  </td>
                  {/* Arrivée */}
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {fmt(m.joinedAt)}
                  </td>
                  {/* Âge compte */}
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {ageDays(m.firstSeen)}
                  </td>
                  {/* Dernière activité */}
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {m.lastActivity ? fmt(m.lastActivity) : <span className="text-gray-600">Jamais</span>}
                  </td>
                  {/* Avertissements */}
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${(m.warnings?.length || 0) > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                      {m.warnings?.length || 0}/3
                    </span>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setSelected(m); setAction({ type: 'warn', reason: '' }); }}
                        className="text-xs bg-yellow-900/30 border border-yellow-800 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-900/50" title="Avertir">⚠️</button>
                      <button onClick={() => { setSelected(m); setAction({ type: 'kick', reason: '' }); }}
                        className="text-xs bg-orange-900/30 border border-orange-800 text-orange-400 px-2 py-1 rounded hover:bg-orange-900/50" title="Expulser">👢</button>
                      <button onClick={() => { setSelected(m); setAction({ type: 'ban', reason: '' }); }}
                        className="text-xs bg-red-900/30 border border-red-800 text-red-400 px-2 py-1 rounded hover:bg-red-900/50" title="Bannir">🔨</button>
                      <button onClick={() => setSelected(selected?.id === m.id && !action.type ? null : m)}
                        className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-1 rounded hover:bg-gray-700" title="Détail">👁️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 flex-shrink-0">
          <span className="text-gray-400 text-sm">
            Page {page} / {totalPages} — {filtered.length} membres
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 text-gray-400 rounded text-sm disabled:opacity-40 hover:bg-gray-700">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-400 rounded text-sm disabled:opacity-40 hover:bg-gray-700">← Précédent</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-400 rounded text-sm disabled:opacity-40 hover:bg-gray-700">Suivant →</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 text-gray-400 rounded text-sm disabled:opacity-40 hover:bg-gray-700">»</button>
          </div>
        </div>
      )}

      {/* Modal action */}
      {action.type && selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-bold mb-1">
              {action.type === 'ban' ? '🔨 Bannir' : action.type === 'kick' ? '👢 Expulser' : '⚠️ Avertir'} — {selected.username}
            </h2>
            <p className="text-gray-500 text-xs font-mono mb-4">{selected.id}</p>
            <input value={action.reason} onChange={e => setAction(a => ({ ...a, reason: e.target.value }))}
              placeholder="Raison..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm mb-4 focus:outline-none focus:border-indigo-500" />
            <div className="flex gap-3">
              <button onClick={doAction}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-medium">Confirmer</button>
              <button onClick={() => setAction({ type: null, reason: '' })}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal détail */}
      {selected && !action.type && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-white font-bold text-lg">{selected.username || selected.tag}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-5">
              {[
                { label: 'ID Discord',        value: selected.id,        copy: true },
                { label: 'Tag',               value: selected.tag || '—' },
                { label: 'Statut',            value: STATUS_LABELS[selected.status] || selected.status },
                { label: 'Arrivé le',         value: fmtFull(selected.joinedAt) },
                { label: 'Première vue',      value: fmtFull(selected.firstSeen) },
                { label: 'Dernière activité', value: fmtFull(selected.lastActivity) },
                { label: 'Avertissements',    value: (selected.warnings?.length || 0) + '/3' },
                { label: 'Ban',               value: selected.bannedAt ? fmt(selected.bannedAt) + ' — ' + (selected.banReason || '?') : '—' },
                { label: 'Expulsé le',        value: selected.kickedAt ? fmtFull(selected.kickedAt) : '—' },
                { label: 'Quitté le',         value: selected.leftAt ? fmtFull(selected.leftAt) : '—' },
              ].map(f => (
                <div key={f.label} className="bg-gray-800 rounded-lg p-3">
                  <div className="text-gray-500 text-xs mb-1">{f.label}</div>
                  <div className="text-white text-xs font-medium break-all flex items-center gap-1">
                    {f.value}
                    {f.copy && (
                      <button onClick={() => copy(f.value)}
                        className="text-gray-600 hover:text-gray-300 transition-colors" title="Copier">
                        {copied === f.value ? '✅' : '📋'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selected.warnings?.length > 0 && (
              <div className="mb-5">
                <div className="text-gray-400 text-xs uppercase mb-2">Avertissements</div>
                <div className="space-y-2">
                  {selected.warnings.map((w, i) => (
                    <div key={i} className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-2 text-xs">
                      <span className="text-yellow-400">{fmt(w.date)}</span>
                      <span className="text-gray-300 ml-2">{w.reason}</span>
                      {w.moderator && <span className="text-gray-500 ml-2">par {w.moderator}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.history?.length > 0 && (
              <div>
                <div className="text-gray-400 text-xs uppercase mb-2">Historique ({selected.history.length} événements)</div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {[...selected.history].reverse().map((h, i) => (
                    <div key={i} className="flex justify-between text-xs bg-gray-800 rounded px-3 py-1.5">
                      <span className="text-gray-300">{h.event}{h.detail ? ' — ' + h.detail : ''}</span>
                      <span className="text-gray-500 whitespace-nowrap ml-2">{fmt(h.date)}</span>
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
