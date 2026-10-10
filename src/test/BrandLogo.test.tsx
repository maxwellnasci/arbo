import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { CSSProperties } from 'react'
import BrandLogo from '../components/shared/BrandLogo'
import LogoPicker from '../components/admin/LogoPicker'
import { EMPTY_LOGO_SELECTION, effectiveLogoUrl } from '../lib/logoSelection'

describe('BrandLogo', () => {
  it('assessoria com logo mostra a imagem enviada', () => {
    render(<BrandLogo brand={{ slug: 'box-azul', brandName: 'Box Azul', logoUrl: 'https://cdn.exemplo/logo.webp' }} size={48} />)
    const img = screen.getByRole('img', { name: 'Box Azul' }) as HTMLImageElement
    expect(img.tagName).toBe('IMG')
    expect(img.src).toBe('https://cdn.exemplo/logo.webp')
    expect(img.width).toBe(48)
    expect(screen.queryByTestId('brand-monogram')).toBeNull()
  })

  it('Arbo sem logo usa a logo da Arbo', () => {
    render(<BrandLogo brand={{ slug: 'arbo', brandName: 'Arbo Run', logoUrl: null }} />)
    const img = screen.getByRole('img', { name: 'Arbo Run' }) as HTMLImageElement
    expect(img.tagName).toBe('IMG')
    expect(img.getAttribute('src')).toContain('arbo-run-logo')
  })

  it('outra assessoria sem logo nunca mostra a Arbo: mostra o monograma', () => {
    const { container } = render(<BrandLogo brand={{ slug: 'run-club', brandName: 'Run Club', logoUrl: null }} size={120} />)
    expect(container.querySelector('img')).toBeNull()
    const monogram = screen.getByTestId('brand-monogram')
    expect(monogram.textContent).toBe('RC')
    expect(monogram.getAttribute('role')).toBe('img')
    expect(monogram.getAttribute('aria-label')).toBe('Run Club')
    expect(monogram.style.width).toBe('120px')
    expect(monogram.style.height).toBe('120px')
    expect(monogram.style.fontSize).toBe('48px')
  })

  it('monograma escala para tamanhos pequenos sem sumir', () => {
    render(<BrandLogo brand={{ slug: 'alpha', brandName: 'Alpha', logoUrl: null }} size={24} />)
    const monogram = screen.getByTestId('brand-monogram')
    expect(monogram.textContent).toBe('AL')
    expect(monogram.style.width).toBe('24px')
    expect(monogram.style.borderRadius).toBe('6px')
  })

  it('alt vazio deixa o monograma decorativo e aceita cores de prévia', () => {
    const style = { '--brand-logo-bg': '#1D4ED8', '--brand-logo-fg': '#ffffff' } as CSSProperties
    render(<BrandLogo brand={{ slug: 'nitro', brandName: 'CrossFit Nitro', logoUrl: null }} alt="" style={style} />)
    const monogram = screen.getByTestId('brand-monogram')
    expect(monogram.getAttribute('aria-hidden')).toBe('true')
    expect(monogram.getAttribute('role')).toBeNull()
    expect(monogram.style.getPropertyValue('--brand-logo-bg')).toBe('#1D4ED8')
    expect(monogram.textContent).toBe('CN')
  })
})

describe('LogoPicker', () => {
  beforeAll(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  it('effectiveLogoUrl: arquivo novo > removida > atual', () => {
    expect(effectiveLogoUrl('https://a/old.webp', EMPTY_LOGO_SELECTION)).toBe('https://a/old.webp')
    expect(effectiveLogoUrl('https://a/old.webp', { file: null, remove: true, previewUrl: null })).toBeNull()
    expect(effectiveLogoUrl('https://a/old.webp', { file: null, remove: false, previewUrl: 'blob:x' })).toBe('blob:x')
  })

  it('arquivo inválido não é aceito (sem upload, só aviso)', () => {
    const onChange = vi.fn()
    const onInvalid = vi.fn()
    render(<LogoPicker slug="box" brandName="Box" currentUrl={null} value={EMPTY_LOGO_SELECTION} onChange={onChange} onInvalid={onInvalid} />)
    const svg = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })
    fireEvent.change(screen.getByLabelText('Arquivo da logo'), { target: { files: [svg] } })
    expect(onInvalid).toHaveBeenCalledWith('Envie a logo em PNG ou WebP.')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('arquivo válido vira seleção com prévia local', () => {
    const onChange = vi.fn()
    render(<LogoPicker slug="box" brandName="Box" currentUrl={null} value={EMPTY_LOGO_SELECTION} onChange={onChange} onInvalid={vi.fn()} />)
    expect(screen.getByTestId('brand-monogram').textContent).toBe('BO')
    const png = new File(['x'], 'logo.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Arquivo da logo'), { target: { files: [png] } })
    expect(onChange).toHaveBeenCalledWith({ file: png, remove: false, previewUrl: 'blob:preview' })
  })

  it('remover a logo atual marca remove=true', () => {
    const onChange = vi.fn()
    render(<LogoPicker slug="box" brandName="Box" currentUrl="https://a/old.webp" value={EMPTY_LOGO_SELECTION} onChange={onChange} onInvalid={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Remover/ }))
    expect(onChange).toHaveBeenCalledWith({ file: null, remove: true, previewUrl: null })
  })
})
