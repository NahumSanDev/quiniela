import { useState } from 'react';
import { motion } from 'framer-motion';
import { Match, Prediction } from '../types';

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
  onPredict: (matchId: number, homeScore: number, awayScore: number) => void;
}

export function MatchCard({ match, prediction, onPredict }: MatchCardProps) {
  const [homeScore, setHomeScore] = useState(prediction?.homeScore ?? '');
  const [awayScore, setAwayScore] = useState(prediction?.awayScore ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLocked = match.status === 'LIVE' || match.status === 'FINISHED' || isMatchStarted();
  const isFinished = match.status === 'FINISHED';

  function isMatchStarted(): boolean {
    const now = new Date();
    const startTime = new Date(match.startTime);
    return now >= startTime;
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getPointsBadge(): { text: string; color: string } | null {
    if (!prediction || prediction.points === 0) return null;
    return {
      text: `+${prediction.points}${prediction.bonus ? ' ⭐' : ''}`,
      color: prediction.bonus ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'
    };
  }

  async function handleSubmit() {
    if (isLocked) return;

    const home = parseInt(String(homeScore));
    const away = parseInt(String(awayScore));

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) return;

    setIsSubmitting(true);
    try {
      await onPredict(match.id, home, away);
    } finally {
      setIsSubmitting(false);
    }
  }

  const badge = getPointsBadge();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-amber-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className={`
        relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6
        transition-all duration-300 hover:border-white/20
        ${isLocked ? 'opacity-75' : ''}
      `}>
        {isLocked && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 rounded-full">
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-semibold text-amber-400">
              {isFinished ? 'Finalizado' : 'En juego'}
            </span>
          </div>
        )}

        {match.groupStage && (
          <div className="absolute top-4 left-4 px-3 py-1 bg-white/5 rounded-full">
            <span className="text-xs font-medium text-white/60">{match.groupStage}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 mb-6 pt-8">
          <div className="flex-1 text-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="relative inline-block"
            >
              <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/20 flex">
                {match.homeFlag.split(',').map((color, i) => (
                  <div key={i} style={{ backgroundColor: color, flex: 1 }} />
                ))}
              </div>
            </motion.div>
            <p className="mt-3 text-sm font-semibold text-white/90">{match.homeTeam}</p>
          </div>

          <div className="flex flex-col items-center">
            {match.homeScore !== null && match.awayScore !== null ? (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-3 px-6 py-3 bg-black/40 rounded-2xl"
              >
                <span className="text-4xl font-bold text-white">{match.homeScore}</span>
                <span className="text-2xl text-white/40">-</span>
                <span className="text-4xl font-bold text-white">{match.awayScore}</span>
              </motion.div>
            ) : (
              <div className="px-6 py-3">
                <span className="text-2xl font-bold text-white/40">VS</span>
              </div>
            )}
          </div>

          <div className="flex-1 text-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="relative inline-block"
            >
              <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/20 flex">
                {match.awayFlag.split(',').map((color, i) => (
                  <div key={i} style={{ backgroundColor: color, flex: 1 }} />
                ))}
              </div>
            </motion.div>
            <p className="mt-3 text-sm font-semibold text-white/90">{match.awayTeam}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">{formatDate(match.startTime)}</span>

          {!isLocked && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setHomeScore(String(Math.max(0, (parseInt(String(homeScore)) || 0) - 1)))}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  className="w-12 h-10 text-center bg-white/10 rounded-lg text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  min="0"
                  max="20"
                />
                <button
                  onClick={() => setHomeScore(String((parseInt(String(homeScore)) || 0) + 1))}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white font-bold"
                >
                  +
                </button>
              </div>

              <span className="text-white/40">:</span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setAwayScore(String(Math.max(0, (parseInt(String(awayScore)) || 0) - 1)))}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  className="w-12 h-10 text-center bg-white/10 rounded-lg text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  min="0"
                  max="20"
                />
                <button
                  onClick={() => setAwayScore(String((parseInt(String(awayScore)) || 0) + 1))}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white font-bold"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {badge && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`px-3 py-1 rounded-full text-sm font-bold ${badge.color}`}
            >
              {badge.text}
            </motion.span>
          )}
        </div>

        {!isLocked && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={isSubmitting || homeScore === '' || awayScore === ''}
            className="w-full mt-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-gray-500 disabled:to-gray-600 rounded-xl font-semibold text-white transition-all duration-300 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Guardando...' : prediction ? 'Actualizar' : 'Guardar'}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}