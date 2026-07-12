import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './DayPicker.module.css';

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
  { value: 7, label: 'DOM' },
];

export default function DayPicker({ isOpen, onClose, onSelect, selectedDay }: DayPickerProps) {
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className={styles.overlay} onClick={onClose}>
          <motion.div
            className={styles.modal}
            onClick={e => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div className={styles.handle} />
            <h3 className={styles.title}>Escolha o dia</h3>
            <div className={styles.grid}>
              {DAYS.map((day) => (
                <button
                  key={day.value}
                  className={`${styles.dayBtn} ${day.value === 7 ? styles.fullWidth : ''} ${selectedDay === day.value ? styles.selected : ''}`}
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
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
