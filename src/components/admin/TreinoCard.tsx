import React from 'react';
import { Dumbbell, Timer, Activity, Zap, Heart } from 'lucide-react';
import type { TrainingWithTag } from '../../hooks/useAdminTreinos';

interface TreinoCardProps {
  treino: TrainingWithTag;
  onClickEdit?: () => void;
  onClickDelete?: () => void;
}

const typeIconMap: Record<string, React.ElementType> = {
  forca: Dumbbell,
  hiit: Timer,
  corrida: Activity,
  funcional: Zap,
  cardio: Heart,
};

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm) return '--:--/km';
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = secondsPerKm % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}/km`;
}

export function TreinoCard({ treino, onClickEdit, onClickDelete }: TreinoCardProps) {
  const Icon = typeIconMap[treino.type] || Activity;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:ring-gray-300 dark:bg-gray-900/50 dark:ring-gray-800 dark:hover:ring-gray-700">
      {/* Tag */}
      {treino.tag && (
        <div
          className="absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm"
          style={{ backgroundColor: treino.tag.color }}
        >
          {treino.tag.name}
        </div>
      )}

      {/* Icon and Title */}
      <div className="mb-4 flex items-center gap-3 pr-20">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition-colors duration-300 group-hover:bg-black group-hover:text-white dark:bg-gray-800 dark:text-gray-400 dark:group-hover:bg-white dark:group-hover:text-black">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{treino.title}</h3>
        </div>
      </div>

      {/* Description */}
      {treino.description && (
        <p className="mb-5 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{treino.description}</p>
      )}

      {/* Stats Grid */}
      <div className="mt-auto grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Distância</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {treino.distance_m && treino.distance_m >= 1000
              ? `${(treino.distance_m / 1000).toFixed(1)} km`
              : `${treino.distance_m || 0} m`}
          </span>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Duração</span>
          <span className="font-semibold text-gray-900 dark:text-white">{treino.duration_minutes || 0} min</span>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Pace Alvo</span>
          <span className="font-semibold text-gray-900 dark:text-white">{formatPace(treino.target_pace_seconds_per_km)}</span>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Séries</span>
          <span className="font-semibold text-gray-900 dark:text-white">{treino.sets || 1}</span>
        </div>
      </div>

      {/* Type indicator and Actions */}
      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
          {treino.type}
        </span>
        <div className="flex gap-2">
          {onClickEdit && (
            <button onClick={onClickEdit} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">Editar</button>
          )}
          {onClickDelete && (
            <button onClick={onClickDelete} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400">Excluir</button>
          )}
        </div>
      </div>
    </div>
  );
}
