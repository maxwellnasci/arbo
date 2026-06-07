import { motion, AnimatePresence } from 'framer-motion';
import styles from './DayPicker.module.css';

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6;

interface DayPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (day: DayOfWeek) => void;
  selectedDay?: DayOfWeek | null;
}

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 1, label: 'SEG' },
  { value: 2, label: 'TER' },
  { value: 3, label: 'QUA' },
  { value: 4, label: 'QUI' },
  { value: 5, label: 'SEX' },
  { value: 6, label: 'SÁB' },
];

export default function DayPicker({ isOpen, onClose, onSelect, selectedDay }: DayPickerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
          >
            <h3 className={styles.title}>Escolha o dia</h3>
            <div className={styles.grid}>
              {DAYS.map((day) => (
                <button
                  key={day.value}
                  className={`${styles.dayBtn} ${selectedDay === day.value ? styles.selected : ''}`}
                  onClick={() => {
                    onSelect(day.value);
                    onClose();
                  }}
                >
                  {day.label}
                </button>
              ))}
            </div>
            <button className={styles.cancelBtn} onClick={onClose}>
              Cancelar
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
