import React, { useState, useEffect } from 'react';

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${color || 'text-white'}`}>{value ?? '—'}</div>
      {sub && <div className="text-gray-600 text-xs mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [analyseResult, setAnalyseResult] = useState(null);

  function load() {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function runAnalyse() {
    setAnalysing(true);
    setAnalyseResult(null);
    try {
      const res  = await fetch('/api/analyse', { method: 'POST' });
      const data = await res.json();
      setAnalyseResult(data);
      load();
    } catch {}
    setAnalysing(false);
  }

  // Calcul cohérence
  const dbTotal    = stats ? (stats.active + stats.inactive + stats.left + stats.kicked + stats.banned) : 0;
  const nonPresent = stats ? (stats.left + stats.kicked) : 0;

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
          <button onClick={load}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm transition-colors">
            🔄 Rafraîchir
          </button>
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

      {/* Ligne 1 — Vue globale */}
      <p className="text-gray-500 text-xs uppercase mb-2 mt-2">Vue globale</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="👥" label="Membres Discord"  value={stats?.memberCount} color="text-white"        sub="Actuellement sur le serveur" />
        <StatCard icon="🗄️" label="En base de données" value={stats?.total}     color="text-indigo-400"   sub={`Dont ${nonPresent} partis/expulsés`} />
        <StatCard icon="✅" label="Présents actifs"  value={stats?.active}      color="text-green-400"    sub="Statut actif en DB" />
        <StatCard icon="🟡" label="Présents inactifs" value={stats?.inactive}   color="text-yellow-400"   sub="Statut inactif en DB" />
      </div>

      {/* Ligne 2 — Alertes */}
      <p className="text-gray-500 text-xs uppercase mb-2">Alertes & sanctions</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="⚠️"  label="Liste expulsion"  value={stats?.toExpel}  color="text-orange-400"  sub="+40j d'inactivité" />
        <StatCard icon="🔨"  label="Bannis"           value={stats?.banned}   color="text-red-400"     sub="Bannis en DB" />
        <StatCard icon="⚠️"  label="Avertis"          value={stats?.warned}   color="text-yellow-400"  sub="Avec avertissements" />
        <StatCard icon="🚪"  label="Partis / Expulsés" value={nonPresent}     color="text-gray-400"    sub={`${stats?.left ?? 0} partis · ${stats?.kicked ?? 0} expulsés`} />
      </div>

      {/* Cohérence */}
      {stats && stats.total !== dbTotal && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-3 text-xs text-yellow-400">
          ⚠️ Écart détecté : {stats.total} en DB mais {dbTotal} comptés par statut. Lance /analyse pour resynchroniser.
        </div>
      )}
    </div>
  );
}
