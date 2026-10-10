import type { CSSProperties } from 'react'
import { Sparkles, Timer, MessageCircle } from 'lucide-react'
import { brandCssVars } from '../../lib/brand'
import BrandLogo from '../shared/BrandLogo'
import styles from './BrandPreview.module.css'

type Props = {
  // slug decide o fallback sem logo: Arbo → logo da Arbo; outras → monograma
  slug: string
  brandName: string
  logoUrl: string | null
  coachName: string | null
  primaryColor: string
  secondaryColor: string | null
  accentColor: string | null
}

// Prévia ao vivo da identidade visual: topo do app do aluno (secundária),
// botão primário (texto de alto contraste calculado), card de treino com badge
// de modalidade e recado da IA (destaque). As cores entram como variáveis
// locais (--pv-*) — mesmo cálculo de fallback do app (brandCssVars), sem mexer
// na marca aplicada no resto da tela.
export default function BrandPreview({ slug, brandName, logoUrl, coachName, primaryColor, secondaryColor, accentColor }: Props) {
  const vars = brandCssVars({ primaryColor, secondaryColor, accentColor })
  const style = {
    '--pv-primary': vars['--brand-primary'],
    '--pv-secondary': vars['--brand-secondary'],
    '--pv-accent': vars['--brand-accent'],
    '--pv-on-primary': vars['--text-on-brand'],
  } as CSSProperties
  const coach = coachName?.trim() || 'seu treinador'

  return (
    <div className={styles.preview} style={style} aria-label="Prévia do app do aluno">
      <div className={styles.topbar}>
        <BrandLogo
          brand={{ slug, brandName: brandName.trim() || 'Sua marca', logoUrl }}
          size={24}
          alt=""
          className={styles.logo}
          style={{ '--brand-logo-bg': 'var(--pv-primary)', '--brand-logo-fg': 'var(--pv-on-primary)' } as CSSProperties}
        />
        <span className={styles.brandName}>{brandName.trim() || 'Sua marca'}</span>
      </div>

      <div className={styles.hero}>
        <p className={styles.eyebrow}>MEU TREINO</p>
        <p className={styles.title}>Bom treino, Ana.</p>
        <span className={styles.primaryButton}>Fazer check-in</span>
      </div>

      <div className={styles.trainingCard}>
        <div className={styles.badges}>
          <span className={styles.badgeRun}>Corrida</span>
          <span className={styles.badgeAccent}>Hyrox</span>
          <span className={styles.badgeOutline}>CrossFit</span>
        </div>
        <p className={styles.trainingTitle}>Hyrox simulado — 4 estações</p>
        <p className={styles.trainingMeta}>
          <Timer size={13} aria-hidden="true" /> 1 km a <strong className={styles.target}>5:10/km</strong> + SkiErg 1000 m
        </p>
      </div>

      <div className={styles.coachCard}>
        <div className={styles.coachHeader}>
          <MessageCircle size={15} aria-hidden="true" />
          <span>Recado de {coach}</span>
        </div>
        <p className={styles.coachText}>Ótimo ritmo nas transições hoje. Segura esse pace no próximo bloco!</p>
        <div className={styles.highlight}>
          <Sparkles size={13} aria-hidden="true" /> Ponto alto: melhor tempo no SkiErg
        </div>
      </div>
    </div>
  )
}
