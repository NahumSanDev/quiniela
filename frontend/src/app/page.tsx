'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchCard, KnockoutData } from '../components/MatchCard';
import { RankingTable } from '../components/RankingTable';
import { Match, RankingEntry, KnockoutBetConfig, KnockoutBetRules, defaultKnockoutBetConfig } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  points: number;
  isAdmin: boolean;
}

interface Group {
  id: string;
  name: string;
  code: string;
  isOwner: boolean;
  myRole: string;
  useExtraBets?: boolean;
}

function HowItWorksModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="bg-gray-900 border border-white/10 rounded-3xl p-8 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-amber-400 bg-clip-text text-transparent">
            Como Funciona el Puntaje
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex items-start gap-4 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-2xl font-bold text-black shrink-0">+3</div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Resultado Correcto</h3>
              <p className="text-white/60 text-sm">Predice correctamente quien gana o si hay empate</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-2xl font-bold text-black shrink-0">+1</div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Score Exacto</h3>
              <p className="text-white/60 text-sm">Acierta el marcador exacto del partido</p>
            </div>
          </div>

          <div className="p-4 bg-white/5 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Ejemplo</h3>
            <p className="text-white/60 text-sm mb-2">Si el partido termina 2-1 y tu prediccion es 2-1:</p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">Resultado: +3</span>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm">Exacto: +1</span>
              <span className="px-3 py-1 bg-white/10 text-white rounded-full text-sm font-semibold">Total: +4 puntos</span>
            </div>
          </div>
        </div>

        <button onClick={onClose} className="w-full mt-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 rounded-xl font-semibold text-white transition-all">
          Entendido!
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matches' | 'ranking'>('matches');
  const [matchFilter, setMatchFilter] = useState<string>('knockout');
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [rankingRound, setRankingRound] = useState<string>('all');
  const [groupBetRules, setGroupBetRules] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      fetchGroups();
    }
    fetchData();
    fetchGeneralRanking();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupRanking();
    } else {
      fetchGeneralRanking();
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupRanking();
    } else {
      fetchGeneralRanking();
    }
  }, [rankingRound]);

  async function fetchGroups(): Promise<Group[]> {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/groups/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
        const savedGroup = localStorage.getItem('selectedGroup');
        if (savedGroup && data.some((g: Group) => g.id === savedGroup)) {
          selectGroup(savedGroup);
        } else if (data.length === 1) {
          selectGroup(data[0].id);
          localStorage.setItem('selectedGroup', data[0].id);
        }
        return data;
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
    return [];
  }

  async function fetchData() {
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

      const matchesRes = await fetch(`${API_URL}/api/matches?limit=100`, { headers });

      if (matchesRes.ok) {
        const data = await matchesRes.json();
        setMatches(data.data || data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchGeneralRanking() {
    const token = localStorage.getItem('token');
    const roundParam = rankingRound !== 'all' ? `&round=${rankingRound}` : '';
    try {
      const res = await fetch(`${API_URL}/api/matches/ranking?limit=50${roundParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRanking(await res.json());
      }
    } catch (error) {
      console.error('Error fetching general ranking:', error);
    }
  }

  async function fetchGroupRanking() {
    if (!selectedGroup) return;
    const token = localStorage.getItem('token');
    try {
      const roundParam = rankingRound !== 'all' ? `?round=${rankingRound}` : '';
      const res = await fetch(`${API_URL}/api/groups/${selectedGroup}/ranking${roundParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRanking(await res.json());
      }
    } catch (error) {
      console.error('Error fetching group ranking:', error);
    }
  }

  async function selectGroup(groupId: string | null) {
    setSelectedGroup(groupId);
    setGroupBetRules(null);
    if (groupId) {
      setRankingRound('all');
      localStorage.setItem('selectedGroup', groupId);
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`${API_URL}/api/groups/${groupId}/bet-rules`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setGroupBetRules(await res.json());
        }
      } catch {}
    } else {
      localStorage.removeItem('selectedGroup');
    }
  }

  function getGroupEnabledBets(): KnockoutBetConfig {
    const group = groups.find(g => g.id === selectedGroup);
    if (!group) return defaultKnockoutBetConfig();
    if (!group.useExtraBets) {
      return {
        score: false, simpleScore: false, winnerOnly: false, totalGoals: false, bothTeamsScore: false, cleanSheet: false,
        halfTimeScore: false, firstGoalTeam: false, firstGoalMinute: false,
        redCard: false, totalCards: false, extraTime: false, penaltyShootout: false,
      };
    }
    if (!groupBetRules || Object.keys(groupBetRules).length === 0) {
      return defaultKnockoutBetConfig();
    }
    return {
      score: groupBetRules.score ?? true,
      simpleScore: groupBetRules.simpleScore ?? false,
      winnerOnly: groupBetRules.winnerOnly ?? true,
      totalGoals: groupBetRules.totalGoals ?? true,
      bothTeamsScore: groupBetRules.bothTeamsScore ?? true,
      cleanSheet: groupBetRules.cleanSheet ?? true,
      halfTimeScore: groupBetRules.halfTimeScore ?? true,
      firstGoalTeam: groupBetRules.firstGoalTeam ?? true,
      firstGoalMinute: groupBetRules.firstGoalMinute ?? true,
      redCard: groupBetRules.redCard ?? true,
      totalCards: groupBetRules.totalCards ?? true,
      extraTime: groupBetRules.extraTime ?? true,
      penaltyShootout: groupBetRules.penaltyShootout ?? true,
    };
  }

  function getGroupPointValues(): KnockoutBetRules | null {
    if (!selectedGroup) return null;
    const group = groups.find(g => g.id === selectedGroup);
    if (!group || !group.useExtraBets) return null;
    return groupBetRules?.rules || null;
  }

  async function handlePredict(matchId: number, homeScore: number, awayScore: number, knockout?: KnockoutData, winner?: string | null, isWinnerOnly?: boolean | null, isSimpleScore?: boolean | null) {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) {
      window.location.href = '/auth/signin';
      return;
    }

    let groupId = selectedGroup;
    if (!groupId) {
      const freshGroups = await fetchGroups();
      if (freshGroups.length > 0) {
        groupId = freshGroups[0].id;
        selectGroup(groupId);
      }
    }

    const userData = JSON.parse(storedUser);

    try {
      const body: any = { homeScore, awayScore, groupId };
      if (isWinnerOnly) {
        body.winner = winner;
        body.isWinnerOnly = true;
      }
      if (isSimpleScore) {
        body.isSimpleScore = true;
      }
      if (knockout) {
        body.totalGoals = knockout.totalGoals;
        body.bothTeamsScore = knockout.bothTeamsScore;
        body.cleanSheet = knockout.cleanSheet;
        body.halfTimeHomeScore = knockout.halfTimeHomeScore;
        body.halfTimeAwayScore = knockout.halfTimeAwayScore;
        body.firstGoalTeam = knockout.firstGoalTeam;
        body.firstGoalMinute = knockout.firstGoalMinute;
        body.redCard = knockout.redCard;
        body.totalCards = knockout.totalCards;
        body.extraTime = knockout.extraTime;
        body.penaltyShootout = knockout.penaltyShootout;
      }

      const res = await fetch(`${API_URL}/api/matches/${matchId}/prediction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': userData.id
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        fetchData();
      } else {
        const error = await res.json();
        console.error('Error saving prediction:', error);
        alert(error.error || 'Error al guardar prediccion');
      }
    } catch (error) {
      console.error('Error saving prediction:', error);
    }
  }

  async function handleDeletePrediction(matchId: number) {
    if (!confirm('¿Eliminar esta prediccion?')) return;

    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) return;

    const userData = JSON.parse(storedUser);

    try {
      const res = await fetch(`${API_URL}/api/matches/${matchId}/prediction`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': userData.id
        }
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting prediction:', error);
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/auth/signin';
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <AnimatePresence>
        {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 p-6 bg-gradient-to-r from-emerald-500/20 via-purple-500/20 to-amber-500/20 rounded-3xl border border-white/10"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Copa Mundial 2026
              </h2>
              <p className="text-white/60">
                Predice los resultados, gana puntos y lleva la gloria!
              </p>
            </div>
            <button
              onClick={() => setShowHowItWorks(true)}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-semibold transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.233-1 1 1 0 011.233 1v1a5 5 0 01-5 5H7a5 5 0 015-5V7a1 1 0 011-1h2z" clipRule="evenodd" /></svg>
              Como Funciona
            </button>
          </div>
        </motion.div>

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
            {user ? (
              <>
                <a
                  href="/dashboard"
                  className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-colors flex items-center gap-2"
                >
                  <span>📊</span> Dashboard
                </a>
                <a
                  href="/groups"
                  className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors flex items-center gap-2"
                >
                  <span>👥</span> Grupos
                </a>
                {user?.isAdmin && (
                  <a
                    href="/admin"
                    className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-colors flex items-center gap-2"
                  >
                    <span>⚙️</span> Admin
                  </a>
                )}
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5">
                  {user.avatarUrl && (
                    <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                  )}
                  <div>
                    <span className="text-white/80 block">{user.name}</span>
                    <span className="text-emerald-400 text-sm font-semibold">{user.points} pts</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
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

        {user && groups.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 flex gap-2 flex-wrap items-center"
          >
            <button
              onClick={() => selectGroup(null)}
              className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                selectedGroup === null
                  ? 'bg-amber-500 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              🌍 General
            </button>
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => selectGroup(group.id)}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  selectedGroup === group.id
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {group.name} {group.myRole === 'ADMIN' ? '👑' : ''}
              </button>
            ))}
          </motion.div>
        )}

        {user && groups.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-purple-500/20 border border-purple-500/30 rounded-2xl text-center"
          >
            <p className="text-purple-300 mb-2">🎯 Unete a un grupo para hacer predicciones y competir</p>
            <a href="/groups" className="inline-block px-6 py-2 bg-purple-500 text-white rounded-xl font-semibold hover:bg-purple-400">
              Ir a Grupos
            </a>
          </motion.div>
        )}

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
            Ranking {selectedGroup ? `- ${groups.find(g => g.id === selectedGroup)?.name || ''}` : '- General'}
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
          >
            <div className="flex gap-2 mb-2 justify-center flex-wrap">
              <button
                onClick={() => setMatchFilter('groups')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  matchFilter === 'groups'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                📋 Fase de Grupos
              </button>
              <button
                onClick={() => setMatchFilter('knockout')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  matchFilter === 'knockout'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                🏆 Todas
              </button>
            </div>
            {matchFilter !== 'groups' && (
              <div className="flex gap-2 mb-6 justify-center flex-wrap">
                {[
                  { value: 'Round of 32', label: '16vos' },
                  { value: 'Round of 16', label: '8vos' },
                  { value: 'Quarter-final', label: 'Cuartos' },
                  { value: 'Semi-final', label: 'Semis' },
                  { value: 'Final', label: 'Final' },
                ].map((round) => (
                  <button
                    key={round.value}
                    onClick={() => setMatchFilter(round.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      matchFilter === round.value
                        ? 'bg-amber-500 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {round.label}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.length === 0 ? (
                <p className="col-span-full text-center text-white/40 py-20">
                  No hay partidos disponibles
                </p>
              ) : (
                matches
                  .filter(m => {
                    if (matchFilter === 'groups') return !m.isKnockout;
                    if (matchFilter === 'knockout') return m.isKnockout;
                    if (matchFilter === 'Final') return m.groupStage === 'Final' || m.groupStage === 'Third Place';
                    return m.groupStage === matchFilter;
                  })
                  .map((match, index) => {
                    const userPrediction = match.predictions?.find(
                      (p: any) => p.userId === user?.id
                    );
                    return (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <MatchCard
                          match={match}
                          prediction={userPrediction}
                          onPredict={handlePredict}
                          enabledBets={getGroupEnabledBets()}
                          pointValues={getGroupPointValues()}
                        />
                      </motion.div>
                    );
                  })
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-2xl mx-auto"
          >
            <div className="flex gap-2 mb-2 flex-wrap justify-center">
              {[
                { value: 'all', label: 'General' },
                { value: 'groups-j1', label: 'Jornada 1' },
                { value: 'groups-j2', label: 'Jornada 2' },
                { value: 'groups-j3', label: 'Jornada 3' },
                { value: 'knockout', label: 'Eliminatorias' },
              ].map((round) => (
                <button
                  key={round.value}
                  onClick={() => setRankingRound(round.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    rankingRound === round.value
                      ? 'bg-amber-500 text-white glow-gold'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {round.label}
                </button>
              ))}
            </div>
            {(rankingRound === 'knockout' || ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'].includes(rankingRound)) && (
              <div className="flex gap-2 mb-4 flex-wrap justify-center">
                {[
                  { value: 'Round of 32', label: '16vos' },
                  { value: 'Round of 16', label: '8vos' },
                  { value: 'Quarter-final', label: 'Cuartos' },
                  { value: 'Semi-final', label: 'Semis' },
                  { value: 'Final', label: 'Final' },
                ].map((round) => (
                  <button
                    key={round.value}
                    onClick={() => setRankingRound(round.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-300 ${
                      rankingRound === round.value
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {round.label}
                  </button>
                ))}
              </div>
            )}
            <RankingTable ranking={ranking} />
          </motion.div>
        )}
      </div>
    </main>
  );
}