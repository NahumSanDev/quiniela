'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MatchCard } from '../components/MatchCard';
import { RankingTable } from '../components/RankingTable';
import { Match, RankingEntry } from '../types';
import { signOut, useSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Home() {
  const { data: session } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matches' | 'ranking'>('matches');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [matchesRes, rankingRes] = await Promise.all([
        fetch(`${API_URL}/api/matches`),
        fetch(`${API_URL}/api/ranking`)
      ]);

      if (matchesRes.ok && rankingRes.ok) {
        setMatches(await matchesRes.json());
        setRanking(await rankingRes.json());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePredict(matchId: number, homeScore: number, awayScore: number) {
    if (!session?.user) return;

    try {
      const res = await fetch(`${API_URL}/api/matches/${matchId}/prediction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.email}`
        },
        body: JSON.stringify({ homeScore, awayScore })
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error saving prediction:', error);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-12"
        >
          <div>
            <h1 className="text-4xl font-extrabold mb-2">
              <span className="bg-gradient-to-r from-emerald-400 via-white to-amber-400 bg-clip-text text-transparent">
                Quiniela Mundial
              </span>
            </h1>
            <p className="text-white/60">Predice, gana y domina el ranking</p>
          </div>

          <div className="flex items-center gap-4">
            {session?.user ? (
              <>
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5">
                  {session.user.image && (
                    <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
                  )}
                  <span className="text-white/80">{session.user.name}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <a
                href="/auth/signin"
                className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400 transition-colors"
              >
                Iniciar sesión
              </a>
            )}
          </div>
        </motion.header>

        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center gap-2 mb-8"
        >
          <button
            onClick={() => setActiveTab('matches')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'matches'
                ? 'bg-emerald-500 text-white glow-emerald'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Partidos
          </button>
          <button
            onClick={() => setActiveTab('ranking')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'ranking'
                ? 'bg-amber-500 text-white glow-gold'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Ranking
          </button>
        </motion.nav>

        {loading ? (
          <div className="flex justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
            />
          </div>
        ) : activeTab === 'matches' ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {matches.map((match, index) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <MatchCard
                  match={match}
                  onPredict={handlePredict}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-2xl mx-auto"
          >
            <RankingTable ranking={ranking} />
          </motion.div>
        )}
      </div>
    </main>
  );
}