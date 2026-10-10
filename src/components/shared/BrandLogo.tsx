import type { CSSProperties } from 'react'
import type { Brand } from '../../lib/brand'
import { brandInitials } from '../../lib/brandInitials'
import arboLogo from '../../assets/arbo-run-logo.webp'
import styles from './BrandLogo.module.css'

type Props = {
  brand: Pick<Brand, 'slug' | 'brandName' | 'logoUrl'>
  size?: number
  className?: string
  // Variáveis --brand-logo-bg / --brand-logo-fg sobrescrevem as cores do
  // monograma (ex.: prévia com cores ainda não salvas).
  style?: CSSProperties
  // '' = decorativo (o nome da marca já aparece ao lado)
  alt?: string
}

// Logo da assessoria com fallback white-label:
//   1. logo enviada → imagem
//   2. Arbo sem logo → logo da Arbo
//   3. qualquer outra assessoria sem logo → monograma com as iniciais na cor
//      da marca (alunos de um box nunca veem a logo da Arbo)
export default function BrandLogo({ brand, size = 32, className, style, alt }: Props) {
  const label = alt ?? brand.brandName
  const imageStyle: CSSProperties = { width: size, height: size, objectFit: 'contain', ...style }

  if (brand.logoUrl) {
    return <img src={brand.logoUrl} alt={label} width={size} height={size} className={className} style={imageStyle} />
  }

  if (brand.slug === 'arbo') {
    return <img src={arboLogo} alt={label} width={size} height={size} className={className} style={imageStyle} />
  }

  const initials = brandInitials(brand.brandName)
  return (
    <span
      className={[styles.monogram, className].filter(Boolean).join(' ')}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * (initials.length > 1 ? 0.4 : 0.5)),
        borderRadius: Math.max(6, Math.round(size * 0.24)),
        ...style,
      }}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      data-testid="brand-monogram"
    >
      {initials}
    </span>
  )
}
