import { motion } from 'framer-motion';
import { RankingEntry } from '../types';

interface RankingTableProps {
  ranking: RankingEntry[];
}

function PodiumPosition({ entry, position }: { entry: RankingEntry; position: number }) {
  const podiumOrder = position === 1 ? 2 : position === 2 ? 1 : position === 3 ? 3 : position;
  const isTop3 = position <= 3;

  const colors = {
    1: { bg: 'from-amber-400 to-amber-600', glow: 'bg-amber-400', text: 'text-amber-400' },
    2: { bg: 'from-gray-300 to-gray-500', glow: 'bg-gray-300', text: 'text-gray-300' },
    3: { bg: 'from-amber-700 to-amber-900', glow: 'bg-amber-700', text: 'text-amber-700' }
  };

  const color = colors[position as keyof typeof colors] || { bg: 'from-gray-500 to-gray-700', glow: 'bg-gray-400', text: 'text-gray-400' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: position * 0.1 }}
      className={`relative ${isTop3 ? 'order-' + podiumOrder : ''}`}
    >
      <div className={`relative p-4 rounded-2xl bg-gradient-to-b ${color.bg} ${!isTop3 ? 'opacity-50' : ''}`}>
        {isTop3 && (
          <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 ${color.glow} rounded-full flex items-center justify-center`}>
            <span className="text-lg font-bold text-black">{position}</span>
          </div>
        )}

        <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
          {entry.avatarUrl ? (
            <img src={entry.avatarUrl} alt={entry.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-white">{entry.name[0]}</span>
          )}
        </div>

        <p className="text-center font-semibold text-white truncate">{entry.name}</p>
        <p className={`text-center text-2xl font-bold ${color.text}`}>{entry.points} pts</p>
      </div>
    </motion.div>
  );
}

export function RankingTable({ ranking }: RankingTableProps) {
  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <div className="space-y-6">
      {top3.length > 0 && (
        <div className="flex items-end justify-center gap-4 px-4">
          {top3[1] && <PodiumPosition entry={top3[1]} position={2} />}
          {top3[0] && <PodiumPosition entry={top3[0]} position={1} />}
          {top3[2] && <PodiumPosition entry={top3[2]} position={3} />}
        </div>
      )}

      <div className="space-y-2">
        {rest.map((entry, index) => (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: (index + 3) * 0.05 }}
            className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/60 font-bold">
              {entry.rank}
            </span>

            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
              {entry.avatarUrl ? (
                <img src={entry.avatarUrl} alt={entry.name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-white">{entry.name[0]}</span>
              )}
            </div>

            <span className="flex-1 font-medium text-white/90">{entry.name}</span>
            <span className="text-lg font-bold text-emerald-400">{entry.points} pts</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}