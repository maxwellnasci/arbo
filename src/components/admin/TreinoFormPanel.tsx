import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Tag } from '../../lib/types';
import type { TrainingWithTag } from '../../hooks/useAdminTreinos';
import type { Database } from '../../lib/database.types';

type TrainingInsert = Database['public']['Tables']['trainings']['Insert'];

interface TreinoFormPanelProps {
  isOpen: boolean;
  onClose: () => void;
  treinoToEdit?: TrainingWithTag | null;
  onSubmit: (data: Omit<TrainingInsert, 'created_by'>) => void;
  tags: Tag[];
}

const typeOptions = ['corrida', 'hiit', 'recovery', 'forca', 'mobilidade'];

export function TreinoFormPanel({ isOpen, onClose, treinoToEdit, onSubmit, tags }: TreinoFormPanelProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [distanceM, setDistanceM] = useState<number | ''>('');
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('');
  const [paceMinutes, setPaceMinutes] = useState<number | ''>('');
  const [paceSeconds, setPaceSeconds] = useState<number | ''>('');
  const [sets, setSets] = useState<number | ''>('');
  const [type, setType] = useState<Database['public']['Enums']['training_type']>('corrida');
  const [tagId, setTagId] = useState('');

  useEffect(() => {
    if (treinoToEdit) {
      setTitle(treinoToEdit.title);
      setDescription(treinoToEdit.description || '');
      setDistanceM(treinoToEdit.distance_m || '');
      setDurationMinutes(treinoToEdit.duration_minutes || '');
      
      if (treinoToEdit.target_pace_seconds_per_km) {
        const totalSeconds = treinoToEdit.target_pace_seconds_per_km;
        setPaceMinutes(Math.floor(totalSeconds / 60));
        setPaceSeconds(totalSeconds % 60);
      } else {
        setPaceMinutes('');
        setPaceSeconds('');
      }
      
      setSets(treinoToEdit.sets || '');
      setType(treinoToEdit.type as Database['public']['Enums']['training_type']);
      setTagId(treinoToEdit.tag?.id || '');
    } else {
      resetForm();
    }
  }, [treinoToEdit, isOpen]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDistanceM('');
    setDurationMinutes('');
    setPaceMinutes('');
    setPaceSeconds('');
    setSets('');
    setType('corrida');
    setTagId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const paceMin = Number(paceMinutes) || 0;
    const paceSec = Number(paceSeconds) || 0;
    const totalPaceSeconds = paceMin * 60 + paceSec;

    const data: Omit<TrainingInsert, 'created_by'> = {
      title,
      description: description || null,
      distance_m: distanceM ? Number(distanceM) : null,
      duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      target_pace_seconds_per_km: totalPaceSeconds > 0 ? totalPaceSeconds : null,
      sets: sets ? Number(sets) : null,
      type,
      tag_id: tagId || null,
    };
    
    onSubmit(data);
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-white dark:focus:ring-white';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <h2 className="text-2xl tracking-wide text-gray-900 dark:text-gray-100" style={{ fontFamily: 'Bebas Neue' }}>
                {treinoToEdit ? 'EDITAR TREINO' : 'NOVO TREINO'}
              </h2>
              <button
                onClick={onClose}
                type="button"
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors dark:hover:bg-gray-800 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6 pb-24">
              {/* Title */}
              <div>
                <label htmlFor="title" className={labelClass}>Título</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Ex: Tiro 5x1000m"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className={labelClass}>Descrição (opcional)</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={inputClass}
                  placeholder="Descreva o treino..."
                />
              </div>

              {/* Type and Tag row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="type" className={labelClass}>Tipo</label>
                  <select
                    id="type"
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className={inputClass}
                  >
                    {typeOptions.map((opt) => (
                      <option key={opt} value={opt} className="capitalize">{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tag" className={labelClass}>Etiqueta (opcional)</label>
                  <select
                    id="tag"
                    value={tagId}
                    onChange={(e) => setTagId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Nenhuma</option>
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>{tag.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Distance and Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="distance" className={labelClass}>Distância (m)</label>
                  <input
                    id="distance"
                    type="number"
                    min="0"
                    value={distanceM}
                    onChange={(e) => setDistanceM(e.target.value ? Number(e.target.value) : '')}
                    className={inputClass}
                    placeholder="Ex: 5000"
                  />
                </div>
                <div>
                  <label htmlFor="duration" className={labelClass}>Duração (min)</label>
                  <input
                    id="duration"
                    type="number"
                    min="0"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value ? Number(e.target.value) : '')}
                    className={inputClass}
                    placeholder="Ex: 30"
                  />
                </div>
              </div>

              {/* Pace */}
              <div>
                <label className={labelClass}>Pace Alvo (min:seg / km)</label>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={paceMinutes}
                    onChange={(e) => setPaceMinutes(e.target.value ? Number(e.target.value) : '')}
                    className={inputClass}
                    placeholder="Min"
                  />
                  <span className="text-xl font-medium text-gray-400">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={paceSeconds}
                    onChange={(e) => setPaceSeconds(e.target.value ? Number(e.target.value) : '')}
                    className={inputClass}
                    placeholder="Seg"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {paceMinutes !== '' && paceSeconds !== '' && (
                    <>Equivale a {Number(paceMinutes) * 60 + Number(paceSeconds)} segundos por km.</>
                  )}
                </p>
              </div>

              {/* Sets */}
              <div>
                <label htmlFor="sets" className={labelClass}>Número de Séries</label>
                <input
                  id="sets"
                  type="number"
                  min="1"
                  value={sets}
                  onChange={(e) => setSets(e.target.value ? Number(e.target.value) : '')}
                  className={inputClass}
                  placeholder="Ex: 1"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-6 mt-8">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-black px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 transition-colors dark:bg-white dark:text-black dark:hover:bg-gray-200"
                >
                  {treinoToEdit ? 'Salvar Alterações' : 'Criar Treino'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
