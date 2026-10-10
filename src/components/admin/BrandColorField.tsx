import { useState } from 'react'
import { isHexColor } from '../../lib/brand'
import styles from './BrandColorField.module.css'

type Props = {
  label: string
  hint?: string
  // null = cor opcional não definida (o app usa a cor de fallback)
  value: string | null
  onChange: (value: string | null) => void
  // Cor mostrada no seletor quando value é null (ex.: a primária).
  fallback?: string
  // Cor opcional: permite limpar e voltar ao fallback.
  optional?: boolean
  error?: string
}

// Seletor de cor (picker + hexadecimal). O texto hex só propaga quando é um
// #RRGGBB válido; o pai remonta o campo (key) para resetar o valor digitado.
export default function BrandColorField({ label, hint, value, onChange, fallback = '#E8521A', optional, error }: Props) {
  const [hexInput, setHexInput] = useState(value?.toUpperCase() ?? '')
  const shown = (value ?? fallback).toLowerCase()
  const invalid = hexInput !== '' && !isHexColor(hexInput)

  function handleHex(raw: string) {
    if (raw === '' && optional) {
      setHexInput('')
      onChange(null)
      return
    }
    const normalized = (raw.startsWith('#') ? raw : `#${raw}`).toUpperCase()
    setHexInput(normalized)
    if (isHexColor(normalized)) onChange(normalized)
  }

  function handlePicker(raw: string) {
    setHexInput(raw.toUpperCase())
    onChange(raw.toUpperCase())
  }

  function handleClear() {
    setHexInput('')
    onChange(null)
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.row}>
        <input
          type="color"
          className={`${styles.picker} ${value === null ? styles.pickerInherited : ''}`}
          value={shown}
          onChange={e => handlePicker(e.target.value)}
          aria-label={`Escolher ${label.toLowerCase()}`}
        />
        <input
          className={styles.hex}
          value={hexInput}
          maxLength={7}
          placeholder={optional ? 'Igual à principal' : '#RRGGBB'}
          onChange={e => handleHex(e.target.value)}
          aria-label={`${label} em hexadecimal`}
          aria-invalid={invalid || Boolean(error)}
        />
        {optional && value !== null && (
          <button type="button" className={styles.clear} onClick={handleClear}>
            Usar a principal
          </button>
        )}
      </div>
      {invalid && <span className={styles.error}>Use o formato #RRGGBB.</span>}
      {!invalid && error && <span className={styles.error}>{error}</span>}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
