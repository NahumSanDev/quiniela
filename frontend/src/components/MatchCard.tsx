import { useState } from 'react';
import { motion } from 'framer-motion';
import { Match, Prediction, KnockoutBetConfig, KnockoutBetRules, defaultKnockoutBetRules } from '../types';

export interface KnockoutData {
  totalGoals: number | null;
  bothTeamsScore: boolean | null;
  cleanSheet: string | null;
  halfTimeHomeScore: number | null;
  halfTimeAwayScore: number | null;
  firstGoalTeam: string | null;
  firstGoalMinute: number | null;
  redCard: boolean | null;
  totalCards: number | null;
  extraTime: boolean | null;
  penaltyShootout: boolean | null;
}

export type PredictionMode = 'score' | 'simpleScore' | 'winner';

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
  onPredict: (matchId: number, homeScore: number, awayScore: number, knockout?: KnockoutData, winner?: string | null, isWinnerOnly?: boolean | null, isSimpleScore?: boolean | null) => void;
  enabledBets: KnockoutBetConfig;
  pointValues?: KnockoutBetRules | null;
}

export function MatchCard({ match, prediction, onPredict, enabledBets, pointValues }: MatchCardProps) {
  const pts = pointValues ?? defaultKnockoutBetRules();
  const [predictionMode, setPredictionMode] = useState<PredictionMode>(() => {
    if (prediction?.isWinnerOnly) return 'winner';
    if (!enabledBets.score && !enabledBets.simpleScore && enabledBets.winnerOnly) return 'winner';
    if (!enabledBets.score && enabledBets.simpleScore) return 'simpleScore';
    return 'score';
  });
  const [homeScore, setHomeScore] = useState(prediction?.isWinnerOnly ? '' : (prediction?.homeScore ?? ''));
  const [awayScore, setAwayScore] = useState(prediction?.isWinnerOnly ? '' : (prediction?.awayScore ?? ''));
  const [winner, setWinner] = useState<string | null>(prediction?.winner ?? null);
  const [totalGoals, setTotalGoals] = useState<number | null>(prediction?.totalGoals ?? null);
  const [bothTeamsScore, setBothTeamsScore] = useState<boolean | null>(prediction?.bothTeamsScore ?? null);
  const [cleanSheet, setCleanSheet] = useState<string | null>(prediction?.cleanSheet ?? null);
  const [htHomeScore, setHtHomeScore] = useState<number | null>(prediction?.halfTimeHomeScore ?? null);
  const [htAwayScore, setHtAwayScore] = useState<number | null>(prediction?.halfTimeAwayScore ?? null);
  const [firstGoalTeam, setFirstGoalTeam] = useState<string | null>(prediction?.firstGoalTeam ?? null);
  const [firstGoalMinute, setFirstGoalMinute] = useState<number | null>(prediction?.firstGoalMinute ?? null);
  const [redCard, setRedCard] = useState<boolean | null>(prediction?.redCard ?? null);
  const [totalCards, setTotalCards] = useState<number | null>(prediction?.totalCards ?? null);
  const [extraTime, setExtraTime] = useState<boolean | null>(prediction?.extraTime ?? null);
  const [penaltyShootout, setPenaltyShootout] = useState<boolean | null>(prediction?.penaltyShootout ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'LIVE';
  const isMatchStarted = () => {
    const now = new Date();
    const startTime = new Date(match.startTime);
    return now >= startTime;
  };
  const hasPassedByTime = () => {
    const now = new Date();
    const startTime = new Date(match.startTime);
    const threeHoursAfter = new Date(startTime.getTime() + 3 * 60 * 60 * 1000);
    return now >= threeHoursAfter;
  };
  const isLocked = isLive || isFinished || isMatchStarted();

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
    if (!prediction || (prediction.points === 0 && !prediction.extraPoints)) return null;
    const total = prediction.points + (prediction.extraPoints || 0);
    return {
      text: `+${total}${prediction.bonus ? ' ⭐' : ''}`,
      color: prediction.bonus ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'
    };
  }

  async function handleSubmit() {
    if (isLocked) return;

    const home = parseInt(String(homeScore));
    const away = parseInt(String(awayScore));

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) return;

    const knockout: KnockoutData | undefined = match.isKnockout ? {
      totalGoals,
      bothTeamsScore,
      cleanSheet,
      halfTimeHomeScore: htHomeScore,
      halfTimeAwayScore: htAwayScore,
      firstGoalTeam,
      firstGoalMinute,
      redCard,
      totalCards,
      extraTime,
      penaltyShootout,
    } : undefined;

    const isWinnerMode = predictionMode === 'winner';
    const isSimpleMode = predictionMode === 'simpleScore';
    const submitWinner = isWinnerMode ? winner : null;
    const submitIsWinnerOnly = isWinnerMode ? true : null;
    const submitIsSimpleScore = isSimpleMode ? true : null;

    setIsSubmitting(true);
    try {
      await onPredict(match.id, isWinnerMode ? 0 : home, isWinnerMode ? 0 : away, knockout, submitWinner, submitIsWinnerOnly, submitIsSimpleScore);
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
        {(isLocked || hasPassedByTime()) && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 rounded-full">
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-semibold text-amber-400">
              {isFinished ? 'Finalizado' : isLive ? 'En juego' : 'Cerrado'}
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
              {match.homeFlag.includes(',') ? (
                <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/20 flex">
                  {match.homeFlag.split(',').map((color, i) => (
                    <div key={i} style={{ backgroundColor: color, flex: 1 }} />
                  ))}
                </div>
              ) : (
                <img
                  src={`https://flagcdn.com/w160/${match.homeFlag}.png`}
                  alt={match.homeTeam}
                  className="relative w-16 h-16 rounded-full object-cover ring-2 ring-white/20"
                  loading="lazy"
                />
              )}
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
              {match.awayFlag.includes(',') ? (
                <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/20 flex">
                  {match.awayFlag.split(',').map((color, i) => (
                    <div key={i} style={{ backgroundColor: color, flex: 1 }} />
                  ))}
                </div>
              ) : (
                <img
                  src={`https://flagcdn.com/w160/${match.awayFlag}.png`}
                  alt={match.awayTeam}
                  className="relative w-16 h-16 rounded-full object-cover ring-2 ring-white/20"
                  loading="lazy"
                />
              )}
            </motion.div>
            <p className="mt-3 text-sm font-semibold text-white/90">{match.awayTeam}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">{formatDate(match.startTime)}</span>
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

        {!isLocked && (enabledBets.score || enabledBets.simpleScore) && (
          <div className="mt-3 space-y-3">
            {enabledBets.score && (
              <div onClick={() => { setPredictionMode('score'); if (predictionMode !== 'score') setWinner(null); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ${predictionMode === 'score' ? 'bg-emerald-500/20 ring-2 ring-emerald-500' : 'bg-white/5 hover:bg-white/10 opacity-70'}`}
              >
                <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap">Completo</span>
                {predictionMode === 'score' ? (
                  <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setHomeScore(String(Math.max(0, (parseInt(String(homeScore)) || 0) - 1)))} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm">-</button>
                    <input type="number" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} className="w-10 h-8 text-center bg-white/10 rounded-lg text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-sm" min="0" max="20" />
                    <span className="text-white/40 text-sm">:</span>
                    <input type="number" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} className="w-10 h-8 text-center bg-white/10 rounded-lg text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-sm" min="0" max="20" />
                    <button onClick={() => setAwayScore(String((parseInt(String(awayScore)) || 0) + 1))} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm">+</button>
                    <span className="text-amber-400 text-xs font-semibold">+3+1</span>
                  </div>
                ) : (
                  <span className="text-xs text-white/40 ml-auto">3+1 pts</span>
                )}
              </div>
            )}

            {enabledBets.simpleScore && (
              <div onClick={() => { setPredictionMode('simpleScore'); if (predictionMode !== 'simpleScore') setWinner(null); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ${predictionMode === 'simpleScore' ? 'bg-emerald-500/20 ring-2 ring-emerald-500' : 'bg-white/5 hover:bg-white/10 opacity-70'}`}
              >
                <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap">Simple</span>
                {predictionMode === 'simpleScore' ? (
                  <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setHomeScore(String(Math.max(0, (parseInt(String(homeScore)) || 0) - 1)))} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm">-</button>
                    <input type="number" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} className="w-10 h-8 text-center bg-white/10 rounded-lg text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-sm" min="0" max="20" />
                    <span className="text-white/40 text-sm">:</span>
                    <input type="number" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} className="w-10 h-8 text-center bg-white/10 rounded-lg text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-sm" min="0" max="20" />
                    <button onClick={() => setAwayScore(String((parseInt(String(awayScore)) || 0) + 1))} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm">+</button>
                    <span className="text-amber-400 text-xs font-semibold">+1</span>
                  </div>
                ) : (
                  <span className="text-xs text-white/40 ml-auto">1 pt</span>
                )}
              </div>
            )}
          </div>
        )}

        {!isLocked && match.isKnockout && enabledBets.winnerOnly && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <label className="block text-sm text-white/80 mb-1.5">
              Solo Ganador <span className="text-amber-400 font-semibold">+{pts.winnerPoints ?? 3} pts</span>
            </label>
            <div className="flex gap-2">
              {[
                { value: match.homeTeam, flag: match.homeFlag },
                { value: match.awayTeam, flag: match.awayFlag },
              ].map((opt) => (
                <button key={opt.value} onClick={() => {
                  const newWinner = winner === opt.value ? null : opt.value;
                  setWinner(newWinner);
                  if (newWinner) { setPredictionMode('winner'); setHomeScore(''); setAwayScore(''); }
                }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    winner === opt.value ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {opt.flag && !opt.flag.includes(',') && <img src={`https://flagcdn.com/w40/${opt.flag}.png`} alt="" className="w-4 h-3 rounded-sm object-cover" />}
                  {opt.value.substring(0, 12)}
                </button>
              ))}
              {winner !== null && (
                <button onClick={() => setWinner(null)} className="px-3 py-2 rounded-lg text-sm bg-white/5 text-white/40 hover:bg-white/10">✕</button>
              )}
            </div>
          </div>
        )}

        {!isLocked && match.isKnockout && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 pt-4 border-t border-white/10 space-y-4"
          >
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Predicciones Extra — Eliminatorias</p>

            {enabledBets.totalGoals && (
              <div>
                <label className="block text-sm text-white/80 mb-1.5">
                  Goles Totales <span className="text-amber-400 font-semibold">+{pts.totalGoals} pts</span>
                </label>
                <input
                  type="number"
                  value={totalGoals ?? ''}
                  onChange={(e) => setTotalGoals(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-white/10 rounded-lg text-white outline-none focus:ring-2 focus:ring-amber-500"
                  min="0" max="20"
                  placeholder="Ej: 3"
                />
              </div>
            )}

            {enabledBets.bothTeamsScore && (
              <div>
                <label className="block text-sm text-white/80 mb-1.5">
                  ¿Ambos Equipos Anotan? <span className="text-amber-400 font-semibold">+{pts.bothTeamsScore} pt</span>
                </label>
                <div className="flex gap-2">
                  {[
                    { value: true, label: 'Sí' },
                    { value: false, label: 'No' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setBothTeamsScore(bothTeamsScore === opt.value ? null : opt.value)}
                      className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                        bothTeamsScore === opt.value
                          ? 'bg-amber-500 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {bothTeamsScore !== null && (
                    <button
                      onClick={() => setBothTeamsScore(null)}
                      className="px-3 py-2 rounded-lg text-sm bg-white/5 text-white/40 hover:bg-white/10"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {enabledBets.cleanSheet && (
              <div>
                <label className="block text-sm text-white/80 mb-1.5">
                  Portería en Cero <span className="text-amber-400 font-semibold">+{pts.cleanSheet} pt</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'home', team: match.homeTeam, flag: match.homeFlag },
                    { value: 'away', team: match.awayTeam, flag: match.awayFlag },
                    { value: 'both', team: 'Ambos', flag: null },
                    { value: 'none', team: 'Ninguno', flag: null },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCleanSheet(cleanSheet === opt.value ? null : opt.value)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        cleanSheet === opt.value
                          ? 'bg-amber-500 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {opt.flag && (
                        opt.flag.includes(',') ? (
                          <div className="w-4 h-3 rounded-sm overflow-hidden flex">
                            {opt.flag.split(',').map((c, i) => <div key={i} style={{ backgroundColor: c, flex: 1 }} />)}
                          </div>
                        ) : (
                          <img src={`https://flagcdn.com/w40/${opt.flag}.png`} alt="" className="w-4 h-3 rounded-sm object-cover" />
                        )
                      )}
                      {opt.team.substring(0, 12)}
                    </button>
                  ))}
                  {cleanSheet !== null && (
                    <button
                      onClick={() => setCleanSheet(null)}
                      className="px-3 py-2 rounded-lg text-sm bg-white/5 text-white/40 hover:bg-white/10"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {enabledBets.halfTimeScore && (
              <div>
                <label className="block text-sm text-white/80 mb-1.5">
                  Marcador al Medio Tiempo <span className="text-amber-400 font-semibold">+{pts.halfTimeScore} pts</span>
                </label>
                <div className="flex items-center gap-2 max-w-[200px]">
                  <input
                    type="number"
                    value={htHomeScore ?? ''}
                    onChange={(e) => setHtHomeScore(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 bg-white/10 rounded-lg text-white text-center outline-none focus:ring-2 focus:ring-amber-500"
                    min="0" max="10" placeholder="Local"
                  />
                  <span className="text-white/40 font-bold">-</span>
                  <input
                    type="number"
                    value={htAwayScore ?? ''}
                    onChange={(e) => setHtAwayScore(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 bg-white/10 rounded-lg text-white text-center outline-none focus:ring-2 focus:ring-amber-500"
                    min="0" max="10" placeholder="Visitante"
                  />
                </div>
              </div>
            )}

            {enabledBets.firstGoalTeam && (
              <div>
                <label className="block text-sm text-white/80 mb-1.5">
                  Primer Equipo en Anotar <span className="text-amber-400 font-semibold">+{pts.firstGoalTeam} pt</span>
                </label>
                <div className="flex gap-2">
                  {[
                    { value: match.homeTeam, team: match.homeTeam, flag: match.homeFlag },
                    { value: match.awayTeam, team: match.awayTeam, flag: match.awayFlag },
                    { value: 'ninguno', team: 'Ninguno', flag: null },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFirstGoalTeam(firstGoalTeam === opt.value ? null : opt.value)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        firstGoalTeam === opt.value
                          ? 'bg-amber-500 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {opt.flag && (
                        opt.flag.includes(',') ? (
                          <div className="w-4 h-3 rounded-sm overflow-hidden flex">
                            {opt.flag.split(',').map((c, i) => <div key={i} style={{ backgroundColor: c, flex: 1 }} />)}
                          </div>
                        ) : (
                          <img src={`https://flagcdn.com/w40/${opt.flag}.png`} alt="" className="w-4 h-3 rounded-sm object-cover" />
                        )
                      )}
                      {opt.team.substring(0, 12)}
                    </button>
                  ))}
                  {firstGoalTeam !== null && (
                    <button
                      onClick={() => setFirstGoalTeam(null)}
                      className="px-3 py-2 rounded-lg text-sm bg-white/5 text-white/40 hover:bg-white/10"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {enabledBets.firstGoalMinute && (
              <div>
                <label className="block text-sm text-white/80 mb-1.5">
                  Minuto del Primer Gol <span className="text-amber-400 font-semibold">+{pts.firstGoalMinute} pts</span>
                </label>
                <input
                  type="number"
                  value={firstGoalMinute ?? ''}
                  onChange={(e) => setFirstGoalMinute(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-white/10 rounded-lg text-white outline-none focus:ring-2 focus:ring-amber-500"
                  min="0" max="120"
                  placeholder="Ej: 15"
                />
              </div>
            )}

            {enabledBets.redCard && (
              <div>
                <label className="block text-sm text-white/80 mb-1.5">
                  ¿Tarjeta Roja? <span className="text-amber-400 font-semibold">+{pts.redCard} pt</span>
                </label>
                <div className="flex gap-2">
                  {[
                    { value: true, label: 'Sí' },
                    { value: false, label: 'No' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setRedCard(redCard === opt.value ? null : opt.value)}
                      className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                        redCard === opt.value
                          ? 'bg-amber-500 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {redCard !== null && (
                    <button
                      onClick={() => setRedCard(null)}
                      className="px-3 py-2 rounded-lg text-sm bg-white/5 text-white/40 hover:bg-white/10"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {enabledBets.totalCards && (
              <div>
                <label className="block text-sm text-white/80 mb-1.5">
                  Total Tarjetas <span className="text-amber-400 font-semibold">+{pts.totalCards} pts</span>
                </label>
                <input
                  type="number"
                  value={totalCards ?? ''}
                  onChange={(e) => setTotalCards(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-white/10 rounded-lg text-white outline-none focus:ring-2 focus:ring-amber-500"
                  min="0" max="20"
                  placeholder="Ej: 4"
                />
              </div>
            )}

            {enabledBets.extraTime && (
              <div>
                <label className="block text-sm text-white/80 mb-1.5">
                  ¿Tiempos Extra? <span className="text-amber-400 font-semibold">+{pts.extraTime} pt</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExtraTime(extraTime === true ? null : true)}
                    className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                      extraTime === true
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => setExtraTime(extraTime === false ? null : false)}
                    className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                      extraTime === false
                        ? 'bg-red-500 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {enabledBets.penaltyShootout && (
              <div>
                <label className="block text-sm text-white/80 mb-1.5">
                  ¿Tanda de Penales? <span className="text-amber-400 font-semibold">+{pts.penaltyShootout} pt</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPenaltyShootout(penaltyShootout === true ? null : true)}
                    className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                      penaltyShootout === true
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => setPenaltyShootout(penaltyShootout === false ? null : false)}
                    className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                      penaltyShootout === false
                        ? 'bg-red-500 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {!isLocked && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={isSubmitting || (predictionMode === 'winner' ? !winner : (homeScore === '' || awayScore === ''))}
            className="w-full mt-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-gray-500 disabled:to-gray-600 rounded-xl font-semibold text-white transition-all duration-300 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Guardando...' : prediction ? 'Actualizar' : 'Guardar'}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}