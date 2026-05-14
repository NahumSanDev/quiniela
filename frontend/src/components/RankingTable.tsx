import { motion } from 'framer-motion';
import { RankingEntry } from '../types';

interface RankingTableProps {
  ranking: RankingEntry[];
}

function PodiumPlace({ entry, position }: { entry: RankingEntry; position: number }) {
  const podiumWidth = position === 1 ? 'w-36' : position === 2 ? 'w-32' : 'w-28';
  const podiumHeight = position === 1 ? 'h-44' : position === 2 ? 'h-36' : 'h-32';
  
  const medals = {
    1: { bg: 'bg-gradient-to-b from-amber-400 to-amber-600', crown: '👑', text: 'text-amber-900', height: 'h-16' },
    2: { bg: 'bg-gradient-to-b from-gray-300 to-gray-500', crown: '🥈', text: 'text-gray-700', height: 'h-14' },
    3: { bg: 'bg-gradient-to-b from-amber-700 to-amber-900', crown: '🥉', text: 'text-amber-200', height: 'h-12' }
  };

  const style = medals[position as keyof typeof medals] || medals[3];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: position * 0.15, duration: 0.5 }}
      className="flex flex-col items-center"
    >
      <div className="relative mb-2">
        <div className={`absolute -top-6 left-1/2 -translate-x-1/2 text-3xl`}>
          {style.crown}
        </div>
        <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center overflow-hidden shadow-lg">
          {entry.avatarUrl ? (
            <img src={entry.avatarUrl} alt={entry.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-white">{entry.name?.[0]?.toUpperCase() || '?'}</span>
          )}
        </div>
      </div>
      
      <p className="text-white font-semibold text-sm mb-1 truncate max-w-[100px]">{entry.name || 'Anonimo'}</p>
      <div className={`${podiumWidth} ${podiumHeight} ${style.bg} rounded-t-2xl flex flex-col items-center justify-start pt-6 shadow-xl relative`}>
        <span className={`text-xs ${style.text} font-bold`}>{position}</span>
        <div className="mt-auto mb-3 text-center">
          <p className={`text-2xl font-black ${style.text}`}>{entry.points}</p>
          <p className={`text-xs ${style.text} opacity-70`}>pts</p>
        </div>
      </div>
    </motion.div>
  );
}

export function RankingTable({ ranking }: RankingTableProps) {
  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  if (ranking.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🏆</div>
        <p className="text-white/40">No hay ranking disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {top3.length > 0 && (
        <div className="mb-8">
          <h2 className="text-center text-xl font-bold text-white/80 mb-6">Podio</h2>
          <div className="flex items-end justify-center gap-2 md:gap-6 px-4">
            {top3[1] && <PodiumPlace entry={top3[1]} position={2} />}
            {top3[0] && <PodiumPlace entry={top3[0]} position={1} />}
            {top3[2] && <PodiumPlace entry={top3[2]} position={3} />}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <h2 className="text-center text-lg font-bold text-white/60 mb-4">Resto del Ranking</h2>
          <div className="space-y-2">
            {rest.map((entry, index) => (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-sm">
                  {entry.rank}
                </div>

                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                  {entry.avatarUrl ? (
                    <img src={entry.avatarUrl} alt={entry.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-white text-sm">{entry.name?.[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>

                <span className="flex-1 font-medium text-white/90 truncate">{entry.name || 'Anonimo'}</span>
                <div className="text-right">
                  <span className="text-lg font-bold text-emerald-400">{entry.points}</span>
                  <span className="text-xs text-white/40 ml-1">pts</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}