'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  points: number;
  createdAt: string;
}

interface Stats {
  position: number;
  totalUsers: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
}

interface Prediction {
  id: number;
  homeScore: number;
  awayScore: number;
  points: number;
  bonus: boolean;
  match: {
    id: number;
    homeTeam: string;
    homeFlag: string;
    awayTeam: string;
    awayFlag: string;
    homeScore: number | null;
    awayScore: number | null;
    startTime: string;
    status: string;
  };
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'predictions'>('overview');

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth/signin';
      return;
    }

    try {
      const [profileRes, predictionsRes] = await Promise.all([
        fetch(`${API_URL}/api/user/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/user/predictions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        setUser(data.user);
        setStats(data.stats);
      }

      if (predictionsRes.ok) {
        setPredictions(await predictionsRes.json());
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/auth/signin';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
        >
          <div>
            <a href="/" className="text-emerald-400 hover:text-emerald-300 text-sm mb-2 block">
              ← Volver a partidos
            </a>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-amber-400 bg-clip-text text-transparent">
              Mi Dashboard
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
          >
            Cerrar sesión
          </button>
        </motion.header>

        <div className="relative group mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-amber-500/10 rounded-3xl blur-xl" />
          <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 flex items-center justify-center text-3xl overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{user?.name?.[0]?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-1">{user?.name}</h2>
                <p className="text-white/60">{user?.email}</p>
                <p className="text-white/40 text-sm mt-1">
                  Miembro desde {user?.createdAt && formatDate(user.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-emerald-400">{user?.points}</div>
                <div className="text-white/60">puntos</div>
                {stats && (
                  <div className="mt-2 px-3 py-1 bg-amber-500/20 rounded-full inline-block">
                    <span className="text-amber-400 font-semibold">#{1}</span>
                    <span className="text-white/60 text-sm"> de {stats.totalUsers}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
            >
              <div className="text-3xl font-bold text-emerald-400">{stats.totalPredictions}</div>
              <div className="text-white/60 text-sm">Predicciones</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
            >
              <div className="text-3xl font-bold text-amber-400">{stats.correctPredictions}</div>
              <div className="text-white/60 text-sm">Acertadas</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
            >
              <div className="text-3xl font-bold text-white">{stats.accuracy}%</div>
              <div className="text-white/60 text-sm">Precisión</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
            >
              <div className="text-3xl font-bold text-purple-400">#{stats.position}</div>
              <div className="text-white/60 text-sm">Posición</div>
            </motion.div>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('predictions')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'predictions'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Mis Predicciones
          </button>
        </div>

        {predictions.length === 0 ? (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
            <div className="text-6xl mb-4">⚽</div>
            <h3 className="text-xl font-bold text-white mb-2">Sin predicciones aún</h3>
            <p className="text-white/60">Empieza a predecir partidos y acumula puntos</p>
            <a
              href="/"
              className="inline-block mt-4 px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400 transition-colors"
            >
              Ir a partidos
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {predictions.map((prediction, index) => (
              <motion.div
                key={prediction.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <img src={prediction.match.homeFlag} alt="" className="w-8 h-8 rounded-full" />
                      <span className="text-white font-medium">{prediction.match.homeTeam}</span>
                    </div>
                    <div className="px-4 py-2 bg-black/30 rounded-xl">
                      <span className="text-2xl font-bold text-white">{prediction.homeScore}</span>
                      <span className="text-white/40 mx-2">-</span>
                      <span className="text-2xl font-bold text-white">{prediction.awayScore}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{prediction.match.awayTeam}</span>
                      <img src={prediction.match.awayFlag} alt="" className="w-8 h-8 rounded-full" />
                    </div>
                  </div>
                  <div className="text-right">
                    {prediction.match.status === 'FINISHED' ? (
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                        prediction.points > 0
                          ? prediction.bonus
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-white/10 text-white/40'
                      }`}>
                        +{prediction.points} {prediction.bonus && '⭐'}
                      </div>
                    ) : (
                      <span className="text-emerald-400 text-sm">Pendiente</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}