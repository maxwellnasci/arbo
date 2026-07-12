import { useState } from 'react';
import { Calendar, CheckCircle2, Clock } from 'lucide-react';
import type { DayTraining } from '../../hooks/useWeeklyPlan';
import DayPicker, { DayOfWeek } from './DayPicker';
import { VideoPlayer } from '../ui/VideoPlayer';
import styles from './FlexibleTrainingCard.module.css';

interface FlexibleTrainingCardProps {
  dayTraining: DayTraining;
  onScheduleUpdate: (trainingId: string, newDay: DayOfWeek) => Promise<void>;
  onCheckinClick: (dt: DayTraining) => void;
}

const DAYS_LABEL: Record<number, string> = {
  1: 'SEG', 2: 'TER', 3: 'QUA', 4: 'QUI', 5: 'SEX', 6: 'SÁB', 7: 'DOM'
};

export default function FlexibleTrainingCard({
  dayTraining,
  onScheduleUpdate,
  onCheckinClick,
}: FlexibleTrainingCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  const scheduledDay = dayTraining.dayOfWeek ?? 0;
  const isScheduled = dayTraining.dayOfWeek != null && dayTraining.dayOfWeek >= 1;
  const { training, checkin } = dayTraining;
  
  const handleDaySelect = async (day: DayOfWeek) => {
    try {
      setUpdating(true);
      await onScheduleUpdate(dayTraining.weeklyPlanTrainingId, day);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <h3 className={styles.title}>{training.title}</h3>
            {training.duration_minutes && (
              <span className={styles.duration}>
                <Clock size={14} />
                {training.duration_minutes} min
              </span>
            )}
          </div>
          
          {checkin ? (
            <div className={styles.statusBadgeChecked}>
              <CheckCircle2 size={14} />
              Concluído
            </div>
          ) : isScheduled ? (
            <div className={styles.statusBadgeScheduled}>
              Agendado: {DAYS_LABEL[scheduledDay]}
            </div>
          ) : (
            <div className={styles.statusBadgeUnscheduled}>
              Não agendado
            </div>
          )}
        </div>

        {training.video_url && <VideoPlayer videoUrl={training.video_url} />}

        <div className={styles.actions}>
          {!checkin && (
            <button 
              className={styles.scheduleBtn} 
              onClick={() => setPickerOpen(true)}
              disabled={updating}
            >
              <Calendar size={16} />
              {updating ? 'Salvando...' : isScheduled ? 'Alterar Dia' : 'Agendar'}
            </button>
          )}
          
          <button 
            className={styles.checkinBtn}
            onClick={() => onCheckinClick(dayTraining)}
          >
            {checkin ? 'Ver Check-in' : 'Fazer Check-in'}
          </button>
        </div>
      </div>

      <DayPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedDay={isScheduled ? (scheduledDay as DayOfWeek) : undefined}
        onSelect={handleDaySelect}
      />
    </>
  );
}
