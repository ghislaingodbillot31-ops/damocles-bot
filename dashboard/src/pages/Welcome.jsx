import React, { useState, useEffect } from 'react';

export default function Welcome() {
  const [config, setConfig] = useState({
    WELCOME_CHANNEL_ID: '',
    LEAVE_CHANNEL_ID: '',
    WELCOME_ENABLED: true,
    LEAVE_ENABLED: true,
    WELCOME_MESSAGE: 'Bienvenue {user} sur le serveur ! 🎉',
    LEAVE_MESSAGE: '{user} a quitté le serveur.',
    WELCOME_COLOR: '5865F2',
  });
  const [channels, setChannels] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/config').then(r => r.json()),
      fetch('/api/channels').then(r => r.json()).catch(() => []),
    ]).then(([cfg, ch]) => {
      setConfig(c => ({ ...c, ...cfg }));
      setChannels(ch);
    });
  }, []);

  async function save() {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const VARIABLES = [
    { var: '{user}',        desc: 'Mention du membre' },
    { var: '{username}',    desc: 'Pseudo du membre' },
    { var: '{server}',      desc: 'Nom du serveur' },
    { var: '{membercount}', desc: 'Nombre de membres' },
    { var: '{inviter}',     desc: 'Invité par...' },
    { var: '{invite}',      desc: 'Lien d\'invitation utilisé' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Arrivées & Départs</h1>

      <div className="space-y-6">

        {/* Message de bienvenue */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">👋 Message de bienvenue</h2>
            <div onClick={() => setConfig(c => ({ ...c, WELCOME_ENABLED: !c.WELCOME_ENABLED }))}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${config.WELCOME_ENABLED ? 'bg-indigo-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${config.WELCOME_ENABLED ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">Salon de bienvenue</label>
              <select value={config.WELCOME_CHANNEL_ID || ''}
                onChange={e => setConfig(c => ({ ...c, WELCOME_CHANNEL_ID: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                <option value="">— Sélectionner —</option>
                {channels.map(c => <option key={c.id} value={c.id}>[{c.category || '—'}] #{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Couleur de l'embed (hex)</label>
              <div className="flex gap-2">
                <input value={config.WELCOME_COLOR || '5865F2'}
                  onChange={e => setConfig(c => ({ ...c, WELCOME_COLOR: e.target.value.replace('#', '') }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="5865F2" maxLength={6} />
                <div className="w-10 h-10 rounded-lg border border-gray-700" style={{ backgroundColor: '#' + (config.WELCOME_COLOR || '5865F2') }} />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-400 text-xs mb-1">Message de bienvenue</label>
            <textarea value={config.WELCOME_MESSAGE || ''}
              onChange={e => setConfig(c => ({ ...c, WELCOME_MESSAGE: e.target.value }))}
              rows={4} style={{ whiteSpace: 'pre-wrap' }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-y"
              placeholder="Bienvenue {user} sur le serveur !" />
          </div>

          {/* Aperçu */}
          <div className="bg-gray-800 rounded-xl p-4 border-l-4 mb-4" style={{ borderColor: '#' + (config.WELCOME_COLOR || '5865F2') }}>
            <p className="text-gray-300 text-sm whitespace-pre-wrap">
              {(config.WELCOME_MESSAGE || 'Bienvenue {user} !')
                .replace('{user}', '@Joueur')
                .replace('{username}', 'Joueur')
                .replace('{server}', 'Mon Serveur')
                .replace('{membercount}', '512')
                .replace('{inviter}', '@Admin')
                .replace('{invite}', 'discord.gg/xxx')}
            </p>
          </div>
        </div>

        {/* Message de départ */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">🚪 Message de départ</h2>
            <div onClick={() => setConfig(c => ({ ...c, LEAVE_ENABLED: !c.LEAVE_ENABLED }))}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${config.LEAVE_ENABLED ? 'bg-indigo-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${config.LEAVE_ENABLED ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-400 text-xs mb-1">Salon de départ</label>
            <select value={config.LEAVE_CHANNEL_ID || ''}
              onChange={e => setConfig(c => ({ ...c, LEAVE_CHANNEL_ID: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
              <option value="">— Même salon que bienvenue —</option>
              {channels.map(c => <option key={c.id} value={c.id}>[{c.category || '—'}] #{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-1">Message de départ</label>
            <textarea value={config.LEAVE_MESSAGE || ''}
              onChange={e => setConfig(c => ({ ...c, LEAVE_MESSAGE: e.target.value }))}
              rows={3} style={{ whiteSpace: 'pre-wrap' }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-y"
              placeholder="{username} a quitté le serveur." />
          </div>
        </div>

        {/* Variables disponibles */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-3">📌 Variables disponibles</h2>
          <div className="grid grid-cols-2 gap-2">
            {VARIABLES.map(v => (
              <div key={v.var} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
                <code className="text-indigo-400 text-sm">{v.var}</code>
                <span className="text-gray-400 text-xs">{v.desc}</span>
              </div>
            ))}
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
