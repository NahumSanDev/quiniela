'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Match {
  id: number;
  externalId: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  startTime: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  groupStage: string | null;
  venueName: string | null;
  venueCity: string | null;
  venueCountry: string | null;
}

interface GroupInfo {
  id: string;
  name: string;
  code: string;
}

interface GroupMembership {
  group: GroupInfo;
  role: string;
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  points: number;
  createdAt: string;
  _count: { predictions: number };
  groupMemberships: GroupMembership[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  totalUsers: number;
  totalMatches: number;
  totalPredictions: number;
  finishedMatches: number;
}

export default function AdminPanel() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'matches' | 'users' | 'sync' | 'create-match'>('stats');
  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState<Pagination | null>(null);
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [matchesTab, setMatchesTab] = useState<'upcoming' | 'finished'>('upcoming');

  async function fetchData() {
    setLoading(true);
    try {
      const headers = { 'x-admin-key': adminKey };

      const [statsRes, usersRes, matchesRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers }),
        fetch(`${API_URL}/api/admin/users?page=${usersPage}&limit=20`, { headers }),
        fetch(`${API_URL}/api/admin/matches`, { headers })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data || data);
        if (data.pagination) setUsersPagination(data.pagination);
      }
      if (matchesRes.ok) setMatches(await matchesRes.json());

      setIsAuthenticated(true);
    } catch (error) {
      setMessage('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [usersPage]);

  async function handleSync() {
    setSyncing(true);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/api/admin/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ leagueId: 1, season: 2026 })
      });
      const data = await res.json();
      setMessage(data.message || data.error);
      if (res.ok) fetchData();
    } catch (error) {
      setMessage('Error en sincronización');
    } finally {
      setSyncing(false);
    }
  }

  async function handleUpdateMatch(id: number, homeScore: number, awayScore: number, status: string) {
    try {
      await fetch(`${API_URL}/api/admin/matches/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ homeScore, awayScore, status })
      });
      fetchData();
    } catch (error) {
      setMessage('Error al actualizar');
    }
  }

  async function handleDeleteMatch(id: number) {
    if (!confirm('¿Eliminar este partido?')) return;
    try {
      await fetch(`${API_URL}/api/admin/matches/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey }
      });
      fetchData();
    } catch (error) {
      setMessage('Error al eliminar');
    }
  }

  async function handleCreateMatch(formData: FormData) {
    try {
      const startTimeInput = formData.get('startTime') as string;
      const localDate = new Date(startTimeInput);
      const isoWithTimezone = localDate.toISOString();

      const body = {
        homeTeam: formData.get('homeTeam'),
        awayTeam: formData.get('awayTeam'),
        homeFlag: `${formData.get('homeFlag1')},${formData.get('homeFlag2')}`,
        awayFlag: `${formData.get('awayFlag1')},${formData.get('awayFlag2')}`,
        startTime: isoWithTimezone,
        groupStage: formData.get('groupStage'),
        venueName: formData.get('venueName'),
        venueCity: formData.get('venueCity'),
        venueCountry: formData.get('venueCountry'),
        externalId: `manual-${Date.now()}`
      };
      const res = await fetch(`${API_URL}/api/admin/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setMessage('Partido creado exitosamente');
        setShowCreateMatch(false);
        fetchData();
      } else {
        setMessage('Error al crear partido');
      }
    } catch (error) {
      setMessage('Error al crear partido');
    }
  }

  async function handleUpdateMatchFull(id: number, formData: FormData) {
    try {
      const startTimeInput = formData.get('startTime') as string;
      const localDate = new Date(startTimeInput);
      const isoWithTimezone = localDate.toISOString();

      const body = {
        homeTeam: formData.get('homeTeam'),
        awayTeam: formData.get('awayTeam'),
        homeFlag: `${formData.get('homeFlag1')},${formData.get('homeFlag2')}`,
        awayFlag: `${formData.get('awayFlag1')},${formData.get('awayFlag2')}`,
        startTime: isoWithTimezone,
        homeScore: formData.get('homeScore') ? parseInt(formData.get('homeScore') as string) : null,
        awayScore: formData.get('awayScore') ? parseInt(formData.get('awayScore') as string) : null,
        status: formData.get('status'),
        groupStage: formData.get('groupStage'),
        venueName: formData.get('venueName'),
        venueCity: formData.get('venueCity'),
        venueCountry: formData.get('venueCountry')
      };
      const res = await fetch(`${API_URL}/api/admin/matches/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setMessage('Partido actualizado');
        setEditingMatch(null);
        fetchData();
      } else {
        setMessage('Error al actualizar');
      }
    } catch (error) {
      setMessage('Error al actualizar');
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function MatchFormModal({ match, onClose, onSubmit }: { match?: Match | null; onClose: () => void; onSubmit: (data: FormData) => void }) {
    const isEdit = !!match;
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">{isEdit ? 'Editar Partido' : 'Crear Partido'}</h2>
            <button onClick={onClose} className="text-white/60 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-white/60 text-sm mb-1">Equipo Local</label>
                <input name="homeTeam" defaultValue={match?.homeTeam} required className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-white/60 text-sm mb-1">Equipo Visitante</label>
                <input name="awayTeam" defaultValue={match?.awayTeam} required className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-white/60 text-sm mb-1">Color 1 Local</label>
                <div className="flex gap-2">
                  <input name="homeFlag1" type="color" defaultValue={match?.homeFlag?.split(',')[0] || '#00ff00'} className="w-10 h-10 rounded-lg cursor-pointer" />
                  <input name="homeFlag2" type="color" defaultValue={match?.homeFlag?.split(',')[1] || '#ffffff'} className="w-10 h-10 rounded-lg cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="block text-white/60 text-sm mb-1">Color 1 Visitante</label>
                <div className="flex gap-2">
                  <input name="awayFlag1" type="color" defaultValue={match?.awayFlag?.split(',')[0] || '#ff0000'} className="w-10 h-10 rounded-lg cursor-pointer" />
                  <input name="awayFlag2" type="color" defaultValue={match?.awayFlag?.split(',')[1] || '#ffffff'} className="w-10 h-10 rounded-lg cursor-pointer" />
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-white/60 text-sm mb-1">Fecha y Hora</label>
              <input name="startTime" type="datetime-local" defaultValue={match?.startTime ? new Date(match.startTime).toISOString().slice(0, 16) : ''} required className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500" />
            </div>
            <div className="mb-4">
              <label className="block text-white/60 text-sm mb-1">Fase/Grupo</label>
              <input name="groupStage" defaultValue={match?.groupStage || ''} placeholder="Grupo A, Octavos, Final..." className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500" />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-white/60 text-sm mb-1">Estadio</label>
                <input name="venueName" defaultValue={match?.venueName || ''} placeholder="Nombre" className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-white/60 text-sm mb-1">Ciudad</label>
                <input name="venueCity" defaultValue={match?.venueCity || ''} placeholder="Ciudad" className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-white/60 text-sm mb-1">Pais</label>
                <input name="venueCountry" defaultValue={match?.venueCountry || ''} placeholder="Pais" className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500" />
              </div>
            </div>
            {isEdit && (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-white/60 text-sm mb-1">Marcador Local</label>
                    <input name="homeScore" type="number" defaultValue={match?.homeScore ?? ''} min="0" className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-white/60 text-sm mb-1">Marcador Visitante</label>
                    <input name="awayScore" type="number" defaultValue={match?.awayScore ?? ''} min="0" className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-white/60 text-sm mb-1">Estado</label>
                  <select name="status" defaultValue={match?.status} className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500">
                    <option value="SCHEDULED">Programado</option>
                    <option value="LIVE">En juego</option>
                    <option value="FINISHED">Finalizado</option>
                    <option value="POSTPONED">Pospuesto</option>
                    <option value="CANCELLED">Cancelado</option>
                  </select>
                </div>
              </>
            )}
            <div className="flex gap-3">
              <button type="submit" className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400">
                {isEdit ? 'Actualizar' : 'Crear Partido'}
              </button>
              <button type="button" onClick={onClose} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-amber-500/20 rounded-3xl blur-xl" />
            <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8">
              <h1 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-emerald-400 to-amber-400 bg-clip-text text-transparent">
                Panel de Admin
              </h1>

              {message && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {message}
                </div>
              )}

              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Clave de administrador"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500 mb-4"
              />

              <button
                onClick={fetchData}
                className="w-full py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400 transition-colors"
              >
                Acceder
              </button>

              <a href="/" className="block text-center mt-4 text-white/60 hover:text-white">
                ← Volver al inicio
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
        >
          <div>
            <a href="/" className="text-emerald-400 hover:text-emerald-300 text-sm mb-2 block">
              ← Volver
            </a>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-amber-400 bg-clip-text text-transparent">
              Panel de Admin
            </h1>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30"
          >
            Cerrar
          </button>
        </motion.header>

        {message && (
          <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
            {message}
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap">
          {['stats', 'matches', 'users', 'sync'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {tab === 'stats' && '📊 Estadísticas'}
              {tab === 'matches' && '⚽ Partidos'}
              {tab === 'users' && '👥 Usuarios'}
              {tab === 'sync' && '🔄 Sincronizar API'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
            />
          </div>
        ) : (
          <>
            {activeTab === 'stats' && stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                  <div className="text-4xl font-bold text-emerald-400">{stats.totalUsers}</div>
                  <div className="text-white/60">Usuarios</div>
                </div>
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                  <div className="text-4xl font-bold text-amber-400">{stats.totalMatches}</div>
                  <div className="text-white/60">Partidos</div>
                </div>
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                  <div className="text-4xl font-bold text-white">{stats.totalPredictions}</div>
                  <div className="text-white/60">Predicciones</div>
                </div>
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                  <div className="text-4xl font-bold text-purple-400">{stats.finishedMatches}</div>
                  <div className="text-white/60">Finalizados</div>
                </div>
              </div>
            )}

            {activeTab === 'matches' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMatchesTab('upcoming')}
                      className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                        matchesTab === 'upcoming'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      Por Jugar ({matches.filter(m => m.status !== 'FINISHED').length})
                    </button>
                    <button
                      onClick={() => setMatchesTab('finished')}
                      className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                        matchesTab === 'finished'
                          ? 'bg-amber-500 text-white'
                          : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      Finalizados ({matches.filter(m => m.status === 'FINISHED').length})
                    </button>
                  </div>
                  <button
                    onClick={() => { setShowCreateMatch(true); setEditingMatch(null); }}
                    className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400 flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Crear Partido
                  </button>
                </div>
                {matches
                  .filter(match => matchesTab === 'upcoming' ? match.status !== 'FINISHED' : match.status === 'FINISHED')
                  .sort((a, b) => {
                    if (matchesTab === 'upcoming') {
                      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
                    }
                    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
                  })
                  .map((match) => (
                  <div
                    key={match.id}
                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        {match.homeFlag.includes(',') ? (
                          <div className="flex items-center gap-2 rounded-full overflow-hidden">
                            {match.homeFlag.split(',').map((color, i) => (
                              <div key={i} style={{ backgroundColor: color, width: 20, height: 40 }} />
                            ))}
                          </div>
                        ) : (
                          <img src={`https://flagcdn.com/w160/${match.homeFlag}.png`} alt="" className="w-10 h-10 rounded-full" />
                        )}
                        <div>
                          <div className="text-white font-bold">{match.homeTeam}</div>
                          <div className="text-white/40 text-sm">{match.groupStage || 'World Cup'}</div>
                        </div>
                      </div>

                      <div className="px-4 py-2 bg-black/30 rounded-xl flex items-center gap-4">
                        <input
                          type="number"
                          defaultValue={match.homeScore ?? 0}
                          className="w-12 text-center bg-white/10 rounded-lg text-white"
                          min="0"
                          id={`home-${match.id}`}
                        />
                        <span className="text-white">vs</span>
                        <input
                          type="number"
                          defaultValue={match.awayScore ?? 0}
                          className="w-12 text-center bg-white/10 rounded-lg text-white"
                          min="0"
                          id={`away-${match.id}`}
                        />
                      </div>

                      <div className="flex items-center gap-4">
                          <div className="text-white font-bold">{match.awayTeam}</div>
                          {match.awayFlag.includes(',') ? (
                            <div className="flex items-center gap-2 rounded-full overflow-hidden">
                              {match.awayFlag.split(',').map((color, i) => (
                                <div key={i} style={{ backgroundColor: color, width: 20, height: 40 }} />
                              ))}
                            </div>
                          ) : (
                            <img src={`https://flagcdn.com/w160/${match.awayFlag}.png`} alt="" className="w-10 h-10 rounded-full" />
                          )}
                        </div>

                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={match.status}
                          className="bg-white/10 text-white px-3 py-2 rounded-xl"
                          id={`status-${match.id}`}
                        >
                          <option value="SCHEDULED">Programado</option>
                          <option value="LIVE">En juego</option>
                          <option value="FINISHED">Finalizado</option>
                        </select>
                        <button
                          onClick={() => {
                            const homeScore = parseInt((document.getElementById(`home-${match.id}`) as HTMLInputElement).value);
                            const awayScore = parseInt((document.getElementById(`away-${match.id}`) as HTMLInputElement).value);
                            const status = (document.getElementById(`status-${match.id}`) as HTMLSelectElement).value;
                            handleUpdateMatch(match.id, homeScore, awayScore, status);
                          }}
                          className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingMatch(match)}
                          className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteMatch(match.id)}
                          className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-white/40">
                      {formatDate(match.startTime)} • {match.externalId}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-4">
                {users.map((user, index) => (
                  <div
                    key={user.id}
                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 flex items-center justify-center text-white font-bold">
                      #{index + 1 + (usersPage - 1) * 20}
                    </div>
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                      {user.image ? (
                        <img src={user.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{user.name?.[0]?.toUpperCase() || 'U'}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-bold">{user.name || 'Sin nombre'}</div>
                      <div className="text-white/60 text-sm">{user.email}</div>
                      {user.groupMemberships && user.groupMemberships.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {user.groupMemberships.map((gm) => (
                            <span
                              key={gm.group.id}
                              className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs"
                            >
                              {gm.group.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue={user.points}
                        className="w-20 text-center bg-white/10 text-white rounded-lg px-2 py-1"
                        min="0"
                        id={`points-${user.id}`}
                      />
                      <button
                        onClick={async () => {
                          const points = parseInt((document.getElementById(`points-${user.id}`) as HTMLInputElement).value);
                          await fetch(`${API_URL}/api/admin/users/${user.id}`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              'x-admin-key': adminKey
                            },
                            body: JSON.stringify({ points })
                          });
                          fetchData();
                        }}
                        className="px-3 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 text-sm"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('¿Eliminar este usuario y todas sus predicciones?')) return;
                          await fetch(`${API_URL}/api/admin/users/${user.id}`, {
                            method: 'DELETE',
                            headers: { 'x-admin-key': adminKey }
                          });
                          fetchData();
                        }}
                        className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-400">{user.points} pts</div>
                      <div className="text-white/40 text-sm">{user._count.predictions} predicciones</div>
                    </div>
                  </div>
                ))}

                {usersPagination && usersPagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <button
                      onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                      disabled={usersPage === 1}
                      className="px-4 py-2 bg-white/10 text-white rounded-lg disabled:opacity-50 hover:bg-white/20"
                    >
                      Anterior
                    </button>
                    <span className="px-4 py-2 text-white/60">
                      {usersPage} / {usersPagination.totalPages}
                    </span>
                    <button
                      onClick={() => setUsersPage(p => Math.min(usersPagination.totalPages, p + 1))}
                      disabled={usersPage === usersPagination.totalPages}
                      className="px-4 py-2 bg-white/10 text-white rounded-lg disabled:opacity-50 hover:bg-white/20"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'sync' && (
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
                <div className="text-6xl mb-4">🔄</div>
                <h3 className="text-xl font-bold text-white mb-2">Sincronizar con API-Football</h3>
                <p className="text-white/60 mb-6">
                  Sincroniza partidos programados y actualiza resultados en tiempo real
                </p>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50"
                >
                  {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {(showCreateMatch || editingMatch) && (
        <MatchFormModal
          match={editingMatch}
          onClose={() => { setShowCreateMatch(false); setEditingMatch(null); }}
          onSubmit={editingMatch ? (data) => handleUpdateMatchFull(editingMatch.id, data) : handleCreateMatch}
        />
      )}
    </main>
  );
}