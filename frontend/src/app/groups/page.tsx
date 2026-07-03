'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { KnockoutBetConfig, KnockoutBetRules, defaultKnockoutBetConfig, defaultKnockoutBetRules } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Group {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  isOwner: boolean;
  myRole?: string;
  useExtraBets?: boolean;
  members: { id: string; user: { id: string; name: string | null; image: string | null; points: number } }[];
}

interface RankingEntry {
  rank: number;
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  points: number;
  predictionsCount: number;
  correctPredictions: number;
  exactScores: number;
}

const BET_KEYS: (keyof KnockoutBetConfig)[] = [
  'score', 'simpleScore', 'winnerOnly', 'totalGoals', 'bothTeamsScore', 'cleanSheet', 'halfTimeScore',
  'firstGoalTeam', 'firstGoalMinute', 'redCard', 'totalCards',
  'extraTime', 'penaltyShootout',
];

const BET_LABELS: Record<string, string> = {
  score: 'Marcador Completo',
  simpleScore: 'Marcador Simple',
  winnerOnly: 'Solo Ganador',
  totalGoals: 'Goles Totales',
  bothTeamsScore: 'Ambos Anotan',
  cleanSheet: 'Valla Invicta',
  halfTimeScore: 'Marcador 1T',
  firstGoalTeam: '1er Gol Eq',
  firstGoalMinute: 'Minuto 1er Gol',
  redCard: 'Tarjeta Roja',
  totalCards: 'Total Tarjetas',
  extraTime: 'Tiempos Extra',
  penaltyShootout: 'Penales',
};

export default function GroupsPage() {
  const [user, setUser] = useState<any>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [rankingRound, setRankingRound] = useState<string>('all');
  const [settingsGroup, setSettingsGroup] = useState<string | null>(null);
  const [useExtraBets, setUseExtraBets] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [betRules, setBetRules] = useState<any>({});
  const [loadingBetRules, setLoadingBetRules] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      fetchGroups();
    } else {
      window.location.href = '/auth/signin';
    }
  }, []);

  async function fetchGroups() {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/groups/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newGroupName })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Grupo creado! Codigo: ${data.code}`);
        setNewGroupName('');
        setShowCreate(false);
        fetchGroups();
      } else {
        setMessage(data.error);
      }
    } catch (error) {
      setMessage('Error al crear grupo');
    }
  }

  async function joinGroup() {
    if (!joinCode.trim()) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/groups/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: joinCode })
      });
      const data = await res.json();
      setMessage(data.message || data.error);
      if (res.ok) {
        setJoinCode('');
        setShowJoin(false);
        fetchGroups();
      }
    } catch (error) {
      setMessage('Error al unirse al grupo');
    }
  }

  async function deleteGroup(id: string) {
    if (!confirm('¿Eliminar este grupo?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/groups/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage('Grupo eliminado');
        fetchGroups();
      }
    } catch (error) {
      setMessage('Error al eliminar');
    }
  }

  async function leaveGroup(id: string) {
    if (!confirm('¿Salir de este grupo?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/groups/${id}/leave`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage('Saliste del grupo');
        fetchGroups();
      }
    } catch (error) {
      setMessage('Error al salir');
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setMessage('Codigo copiado!');
  }

  async function viewGroupRanking(groupId: string) {
    const token = localStorage.getItem('token');
    setLoadingRanking(true);
    setSelectedGroup(groupId);
    setRankingRound('all');
    try {
      const res = await fetch(`${API_URL}/api/groups/${groupId}/ranking`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRanking(await res.json());
      }
    } catch (error) {
      setMessage('Error al cargar ranking');
    } finally {
      setLoadingRanking(false);
    }
  }

  async function fetchRankingRound(groupId: string, round: string) {
    const token = localStorage.getItem('token');
    setLoadingRanking(true);
    setRankingRound(round);
    try {
      const res = await fetch(`${API_URL}/api/groups/${groupId}/ranking?round=${round}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRanking(await res.json());
      }
    } catch (error) {
      setMessage('Error al cargar ranking');
    } finally {
      setLoadingRanking(false);
    }
  }

  function closeRanking() {
    setSelectedGroup(null);
    setRanking([]);
  }

  async function openSettings(group: Group) {
    setSettingsGroup(group.id);
    setUseExtraBets(group.useExtraBets ?? false);
    setBetRules({});
    if (group.useExtraBets) {
      setLoadingBetRules(true);
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`${API_URL}/api/groups/${group.id}/bet-rules`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setBetRules(await res.json());
        }
      } catch {} finally {
        setLoadingBetRules(false);
      }
    }
  }

  function toggleBetRule(key: string) {
    setBetRules((prev: any) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  }

  function updateBetRulePoints(key: string, value: string) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setBetRules((prev: any) => {
        const rules = { ...(prev.rules || defaultKnockoutBetRules()) };
        rules[key] = num;
        return { ...prev, rules };
      });
    }
  }

  async function saveSettings() {
    if (!settingsGroup) return;
    const token = localStorage.getItem('token');
    setSavingSettings(true);

    const betRulesPayload = useExtraBets ? betRules : null;
    if (useExtraBets && betRulesPayload && Object.keys(betRulesPayload).length > 0) {
      await fetch(`${API_URL}/api/groups/${settingsGroup}/bet-rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(betRulesPayload)
      });
    }

    try {
      const res = await fetch(`${API_URL}/api/groups/${settingsGroup}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ useExtraBets })
      });
      if (res.ok) {
        setSettingsGroup(null);
        fetchGroups();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <a href="/" className="text-emerald-400 hover:text-emerald-300 text-sm mb-2 block">← Volver</a>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-amber-400 bg-clip-text text-transparent">
            Grupos Privados
          </h1>
        </motion.header>

        {message && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
            {message}
            <button onClick={() => setMessage('')} className="float-right">x</button>
          </motion.div>
        )}

        <div className="flex gap-4 mb-6">
          <button onClick={() => { setShowCreate(true); setShowJoin(false); }} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400">
            Crear Grupo
          </button>
          <button onClick={() => { setShowJoin(true); setShowCreate(false); }} className="flex-1 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20">
            Unirse con Codigo
          </button>
        </div>

        {showCreate && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-6 bg-white/5 border border-white/10 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Crear Nuevo Grupo</h3>
            <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nombre del grupo" className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white mb-4 outline-none focus:border-emerald-500" />
            <div className="flex gap-3">
              <button onClick={createGroup} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400">Crear</button>
              <button onClick={() => setShowCreate(false)} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20">Cancelar</button>
            </div>
          </motion.div>
        )}

        {showJoin && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-6 bg-white/5 border border-white/10 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Unirse a un Grupo</h3>
            <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Codigo de 6 caracteres" className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white mb-4 outline-none focus:border-emerald-500 text-center text-2xl tracking-widest font-bold" maxLength={6} />
            <div className="flex gap-3">
              <button onClick={joinGroup} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400">Unirse</button>
              <button onClick={() => setShowJoin(false)} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20">Cancelar</button>
            </div>
          </motion.div>
        )}

        <div className="space-y-4">
          {groups.length === 0 ? (
            <p className="text-center text-white/40 py-10">No estas en ningun grupo. Crea uno o unete con un codigo.</p>
          ) : (
            groups.map((group) => (
              <motion.div key={group.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{group.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-white/40 text-sm">Codigo:</span>
                      <button onClick={() => copyCode(group.code)} className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg font-mono font-bold hover:bg-amber-500/30">
                        {group.code}
                      </button>
                    </div>
                  </div>
                  {group.isOwner && <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">Creador</span>}
                </div>

                <div className="mb-4">
                  <h4 className="text-white/60 text-sm mb-2">Miembros ({group.members?.length || 0})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {group.members
                      ?.slice()
                      .sort((a, b) => b.user.points - a.user.points)
                      .map((m, i) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <span className="w-5 text-white/40 text-sm text-right">{i + 1}.</span>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm shrink-0">
                          {m.user.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-white truncate">{m.user.name || 'Sin nombre'}</span>
                        <span className="text-emerald-400 ml-auto font-semibold">{m.user.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => viewGroupRanking(group.id)} className="flex-1 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 text-sm font-semibold">
                    Ver Ranking
                  </button>
                  {(group.isOwner || group.myRole === 'ADMIN') && (
                    <button onClick={() => openSettings(group)} className="py-2 px-4 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 text-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                  )}
                  {group.isOwner ? (
                    <button onClick={() => deleteGroup(group.id)} className="py-2 px-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 text-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  ) : (
                    <button onClick={() => leaveGroup(group.id)} className="py-2 px-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 text-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {selectedGroup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Ranking del Grupo</h2>
              <button onClick={closeRanking} className="text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: 'all', label: 'General' },
                { key: 'groups-j1', label: 'Jornada 1' },
                { key: 'groups-j2', label: 'Jornada 2' },
                { key: 'groups-j3', label: 'Jornada 3' },
                { key: 'knockout', label: 'Eliminatorias' },
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => fetchRankingRound(selectedGroup!, r.key)}
                  className={`px-3 py-1.5 text-sm rounded-lg font-semibold ${rankingRound === r.key ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {loadingRanking ? (
              <div className="flex justify-center py-8">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {ranking.map((entry, index) => (
                  <div key={entry.userId} className={`flex items-center gap-4 p-4 rounded-xl ${index === 0 ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-white/5'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-amber-500 text-black' : index === 1 ? 'bg-gray-400 text-black' : index === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-white/60'}`}>
                      {entry.rank}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{entry.name || 'Sin nombre'}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-white/50 mt-1">
                        <span> {entry.correctPredictions} predicciones</span>
                        <span className="text-amber-400">{entry.exactScores} exacto</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-400">{entry.points}</div>
                      <div className="text-xs text-white/50">puntos</div>
                    </div>
                  </div>
                ))}
                {ranking.length === 0 && <p className="text-center text-white/40 py-8">No hay miembros en este grupo</p>}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {settingsGroup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Configuración del Grupo</h2>
              <button onClick={() => setSettingsGroup(null)} className="text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div>
                  <p className="text-white font-medium">Apuestas Extra</p>
                  <p className="text-white/50 text-sm">Activar apuestas adicionales en eliminatorias</p>
                </div>
                <button
                  onClick={() => setUseExtraBets(!useExtraBets)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${useExtraBets ? 'bg-emerald-500' : 'bg-white/20'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${useExtraBets ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {useExtraBets && (
                <div className="p-4 bg-white/5 rounded-xl space-y-2">
                  <p className="text-white/80 text-sm font-semibold mb-2">Reglas de Apuestas</p>
                  {loadingBetRules ? (
                    <div className="flex justify-center py-4">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
                    </div>
                  ) : (
                    BET_KEYS.map(key => {
                      const enabled = betRules[key] ?? true;
                      const hasPoints = key !== 'score' && key !== 'simpleScore';
                      const pts = hasPoints ? (betRules.rules?.[key] ?? defaultKnockoutBetRules()[key as keyof KnockoutBetRules]) : null;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={() => toggleBetRule(key)}
                            className="w-4 h-4 rounded border-white/30 bg-white/10 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className={`text-sm flex-1 ${enabled ? 'text-white' : 'text-white/40'}`}>
                            {BET_LABELS[key]}
                          </span>
                          {pts !== null && (
                            <input
                              type="number"
                              min="0"
                              value={pts}
                              onChange={(e) => updateBetRulePoints(key, e.target.value)}
                              className={`w-14 text-center px-1 py-0.5 rounded-lg text-xs outline-none ${enabled ? 'bg-white/10 border border-white/10 text-white focus:border-emerald-500' : 'bg-white/5 border border-white/5 text-white/30'}`}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={saveSettings} disabled={savingSettings} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400 disabled:opacity-50">
                {savingSettings ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setSettingsGroup(null)} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20">Cancelar</button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}