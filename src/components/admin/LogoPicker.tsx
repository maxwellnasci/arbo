import { useEffect, useRef, type CSSProperties } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import BrandLogo from '../shared/BrandLogo'
import { LOGO_MIME_TYPES, validateLogoFile } from '../../lib/brandAssets'
import { effectiveLogoUrl, type LogoSelection } from '../../lib/logoSelection'
import styles from './LogoPicker.module.css'

// Seleção de logo sem upload (o arquivo só sobe quando o formulário salva).
type Props = {
  slug: string
  brandName: string
  currentUrl: string | null
  value: LogoSelection
  onChange: (value: LogoSelection) => void
  onInvalid: (message: string) => void
  // cores do monograma na prévia (ex.: cor escolhida e ainda não salva)
  monogramColors?: { background: string; color: string }
  size?: number
}

export default function LogoPicker({
  slug, brandName, currentUrl, value, onChange, onInvalid, monogramColors, size = 72,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  // A URL de prévia é criada no handler (não em efeito) e revogada na troca e
  // ao desmontar.
  const blobUrlRef = useRef<string | null>(null)
  useEffect(() => () => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
  }, [])

  function setBlob(file: File | null): string | null {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    blobUrlRef.current = file ? URL.createObjectURL(file) : null
    return blobUrlRef.current
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return
    const invalid = validateLogoFile(file)
    if (invalid) {
      onInvalid(invalid)
      return
    }
    onChange({ file, remove: false, previewUrl: setBlob(file) })
  }

  function handleRemove() {
    onChange({ file: null, remove: Boolean(currentUrl), previewUrl: setBlob(null) })
  }

  const logoUrl = effectiveLogoUrl(currentUrl, value)
  const hasLogo = Boolean(logoUrl)
  const monogramStyle = monogramColors
    ? ({ '--brand-logo-bg': monogramColors.background, '--brand-logo-fg': monogramColors.color } as CSSProperties)
    : undefined

  return (
    <div className={styles.row}>
      <div className={styles.box} style={{ width: size + 16, height: size + 16 }}>
        <BrandLogo
          brand={{ slug, brandName: brandName.trim() || 'Sua marca', logoUrl }}
          size={size}
          alt="Prévia da logo"
          style={monogramStyle}
        />
      </div>
      <div className={styles.actions}>
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_MIME_TYPES.join(',')}
          className={styles.hiddenInput}
          onChange={handleFile}
          aria-label="Arquivo da logo"
        />
        <button type="button" className={styles.uploadBtn} onClick={() => inputRef.current?.click()}>
          <ImagePlus size={16} /> {hasLogo ? 'Trocar logo' : 'Enviar logo'}
        </button>
        {hasLogo && (
          <button type="button" className={styles.removeBtn} onClick={handleRemove}>
            <Trash2 size={16} /> Remover
          </button>
        )}
        <span className={styles.hint}>
          PNG ou WebP, até 2 MB. Fundo transparente fica melhor.
          {!hasLogo && slug !== 'arbo' && ' Sem logo, o app mostra as iniciais na cor da marca.'}
        </span>
      </div>
    </div>
  )
}
