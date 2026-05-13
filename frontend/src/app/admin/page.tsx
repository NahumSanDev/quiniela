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
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  points: number;
  createdAt: string;
  _count: { predictions: number };
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
  const [activeTab, setActiveTab] = useState<'stats' | 'matches' | 'users' | 'sync'>('stats');
  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  async function fetchData() {
    setLoading(true);
    try {
      const headers = { 'x-admin-key': adminKey };

      const [statsRes, matchesRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers }),
        fetch(`${API_URL}/api/admin/matches`, { headers }),
        fetch(`${API_URL}/api/admin/users`, { headers })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (matchesRes.ok) setMatches(await matchesRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());

      setIsAuthenticated(true);
    } catch (error) {
      setMessage('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

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

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
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
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <img src={match.homeFlag} alt="" className="w-10 h-10 rounded-full" />
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
                        <div className="flex items-center gap-4">
                          <div className="text-white font-bold">{match.awayTeam}</div>
                          <img src={match.awayFlag} alt="" className="w-10 h-10 rounded-full" />
                        </div>
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
                      #{index + 1}
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
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-400">{user.points} pts</div>
                      <div className="text-white/40 text-sm">{user._count.predictions} predicciones</div>
                    </div>
                  </div>
                ))}
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
    </main>
  );
}