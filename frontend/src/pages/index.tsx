import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MatchCard } from '../components/MatchCard';
import { RankingTable } from '../components/RankingTable';
import { Match, RankingEntry } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Home() {
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
    try {
      const res = await fetch(`${API_URL}/api/matches/${matchId}/prediction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': '1'
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
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-extrabold mb-4">
            <span className="bg-gradient-to-r from-emerald-400 via-white to-amber-400 bg-clip-text text-transparent">
              Quiniela Mundial
            </span>
          </h1>
          <p className="text-white/60 text-lg">Predice, gana y domina el ranking</p>
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