import { PauseCircle, LogOut } from 'lucide-react'
import { useBrand } from '../contexts/BrandContext'
import { useLogout } from '../hooks/useLogout'
import arboLogo from '../assets/arbo-run-logo.webp'

// Tela mostrada para alunos/professores de uma assessoria pausada pelo dono da
// plataforma. Os dados já estão bloqueados no banco; isto é só a mensagem.
export default function OrganizationPausedScreen() {
  const { brand } = useBrand()
  const logout = useLogout()

  return (
    <main style={{
      boxSizing: 'border-box',
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg-primary)',
      fontFamily: 'var(--sans)',
    }}>
      <div style={{
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '420px',
        padding: '32px 24px',
        borderRadius: '20px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-card)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '14px',
      }}>
        <img src={brand.logoUrl ?? arboLogo} alt={brand.brandName} width="64" height="64" style={{ width: 64, height: 64, objectFit: 'contain' }} />
        <PauseCircle size={28} style={{ color: 'var(--yellow-accent)' }} aria-hidden="true" />
        <h1 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)' }}>
          Assessoria temporariamente pausada
        </h1>
        <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          O acesso à <strong>{brand.brandName}</strong> está pausado no momento. Entre em contato com seu professor.
        </p>
        <button
          type="button"
          onClick={() => { void logout() }}
          style={{
            marginTop: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            borderRadius: '10px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <LogOut size={16} /> Sair
        </button>
      </div>
    </main>
  )
}
