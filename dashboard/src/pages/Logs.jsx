import React, { useState, useEffect } from 'react';

export default function Logs() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/members').then(r => r.json()).then(data => {
      setMembers(data);
      setLoading(false);
    });
  }, []);

  // Extraire tous les événements de l'historique
  const allEvents = members.flatMap(m =>
    (m.history || []).map(h => ({ ...h, username: m.username, userId: m.id }))
  ).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 200);

  const EVENT_ICONS = {
    join: '👋', leave: '🚪', ban: '🔨', kick: '👢',
    warning: '⚠️', message: '💬', vocal: '🎙️',
    activated: '✅', verification_refused: '⛔',
    ticket_created: '🎫', ticket_closed: '🔒',
  };

  if (loading) return <div className="text-gray-400">Chargement...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Logs</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 px-4 py-3 text-xs text-gray-500 uppercase border-b border-gray-800">
          <div>Événement</div><div>Membre</div><div>Détail</div><div>Date</div>
        </div>
        <div className="divide-y divide-gray-800 max-h-screen overflow-y-auto">
          {allEvents.map((e, i) => (
            <div key={i} className="grid grid-cols-4 px-4 py-3 items-center text-sm hover:bg-gray-800/30">
              <div className="flex items-center gap-2">
                <span>{EVENT_ICONS[e.event] || '📌'}</span>
                <span className="text-gray-300">{e.event}</span>
              </div>
              <div className="text-white">{e.username}</div>
              <div className="text-gray-400 text-xs truncate">{e.detail || '—'}</div>
              <div className="text-gray-500 text-xs">
                {new Date(e.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
