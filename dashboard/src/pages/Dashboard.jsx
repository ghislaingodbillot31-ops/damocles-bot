import React, { useState, useEffect } from 'react';

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${color || 'text-white'}`}>{value ?? '—'}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [analyseResult, setAnalyseResult] = useState(null);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats);
    const interval = setInterval(() => {
      fetch('/api/stats').then(r => r.json()).then(setStats);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  async function runAnalyse() {
    setAnalysing(true);
    setAnalyseResult(null);
    try {
      const res = await fetch('/api/analyse', { method: 'POST' });
      const data = await res.json();
      setAnalyseResult(data);
      fetch('/api/stats').then(r => r.json()).then(setStats);
    } catch {}
    setAnalysing(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Tableau de bord</h1>
          <p className="text-gray-400 text-sm mt-1">{stats?.guildName || '...'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${stats?.botOnline ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>
            <div className={`w-2 h-2 rounded-full ${stats?.botOnline ? 'bg-green-400' : 'bg-red-400'}`} />
            {stats?.botOnline ? 'En ligne' : 'Hors ligne'}
          </div>
          <button onClick={runAnalyse} disabled={analysing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {analysing ? '⏳ Analyse...' : '🔍 Lancer /analyse'}
          </button>
        </div>
      </div>

      {analyseResult && (
        <div className="bg-indigo-900/20 border border-indigo-800 rounded-xl p-4 mb-6 text-sm">
          ✅ Analyse terminée — <strong>{analyseResult.inactive}</strong> inactifs | <strong>{analyseResult.reactivated}</strong> réactivés | <strong>{analyseResult.toExpel}</strong> à expulser
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="👥" label="Membres total"     value={stats?.total}    />
        <StatCard icon="✅" label="Actifs"            value={stats?.active}   color="text-green-400" />
        <StatCard icon="🟡" label="Inactifs"          value={stats?.inactive} color="text-yellow-400" />
        <StatCard icon="⚠️" label="Liste expulsion"   value={stats?.toExpel}  color="text-orange-400" />
        <StatCard icon="🔨" label="Bannis"            value={stats?.banned}   color="text-red-400" />
        <StatCard icon="⚠️" label="Avertis"           value={stats?.warned}   color="text-yellow-400" />
      </div>
    </div>
  );
}
