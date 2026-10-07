import { Bot, Sparkles, Target, BarChart3 } from 'lucide-react'
import type { CoachFeedback } from '../../lib/stravaAnalysis'
import styles from './CoachFeedbackCard.module.css'

type Props = {
  title: string
  // Linha discreta abaixo do título (ex.: no admin, deixar claro que o aluno já recebeu).
  caption?: string
  feedback: CoachFeedback | null
  isLoading?: boolean
  loadingText?: string
  // 'surface' para cards soltos na página (aluno); 'inset' quando o card fica
  // dentro de outra seção com fundo de superfície (admin).
  tone?: 'surface' | 'inset'
}

// Cross-role (aluno lê o recado, admin vê o que a IA enviou) — mesmo padrão de
// CheckinDetailModal/PaceCalculator em components/shared.
export function CoachFeedbackCard({
  title,
  caption,
  feedback,
  isLoading = false,
  loadingText = 'Analisando seu último treino...',
  tone = 'surface',
}: Props) {
  if (!feedback && !isLoading) return null

  return (
    <div className={`${styles.card} ${tone === 'inset' ? styles.inset : ''}`}>
      <div className={styles.header}>
        <Bot size={16} aria-hidden="true" />
        <div className={styles.headerText}>
          <span className={styles.title}>{title}</span>
          {caption && <span className={styles.caption}>{caption}</span>}
        </div>
      </div>

      {!feedback ? (
        <span className={styles.loading}>{loadingText}</span>
      ) : (
        <div className={styles.body}>
          <p className={styles.message}>{feedback.message}</p>

          {feedback.highlight && (
            <div className={styles.highlight}>
              <Sparkles size={14} aria-hidden="true" />
              <span>{feedback.highlight}</span>
            </div>
          )}

          <div className={styles.row}>
            <Target size={14} aria-hidden="true" />
            <span>
              <strong className={styles.rowLabel}>Próximo passo: </strong>
              {feedback.nextStep}
            </span>
          </div>

          <div className={styles.summary}>
            <BarChart3 size={13} aria-hidden="true" />
            <span>{feedback.summary}</span>
          </div>
        </div>
      )}
    </div>
  )
}
