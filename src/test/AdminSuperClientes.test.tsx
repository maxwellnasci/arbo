import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminSuperClientes from '../pages/admin/AdminSuperClientes'

const createOrganization = vi.fn()

vi.mock('../hooks/useSuperAdminOrganizations', () => ({
  useSuperAdminOrganizations: () => ({
    organizations: [
      {
        id: 'org-1', name: 'Arbo Run', slug: 'arbo', brand_name: 'Arbo Run', primary_color: '#E8521A',
        coach_display_name: null, logo_url: null, created_at: '2026-10-07T09:00:00Z',
      },
    ],
    isLoading: false,
    error: null,
    createOrganization,
  }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe('AdminSuperClientes', () => {
  beforeEach(() => createOrganization.mockReset())

  it('lista as assessorias com o slug do link', () => {
    render(<AdminSuperClientes />)
    expect(screen.getByText('Arbo Run')).toBeTruthy()
    expect(screen.getByText('/a/arbo')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Copiar Link dos Alunos/ })).toBeTruthy()
  })

  it('sugere o slug pelo nome e não chama o servidor com formulário inválido', () => {
    render(<AdminSuperClientes />)
    fireEvent.click(screen.getByRole('button', { name: /Novo Cliente/ }))
    fireEvent.change(screen.getByPlaceholderText('Ex.: Alpha Cross'), { target: { value: 'Alpha Cross São Paulo' } })
    expect((screen.getByPlaceholderText('alpha-cross') as HTMLInputElement).value).toBe('alpha-cross-sao-paulo')

    fireEvent.change(screen.getByPlaceholderText('professor@exemplo.com'), { target: { value: 'sem-arroba' } })
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar e enviar convite/ }))
    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy()
    expect(createOrganization).not.toHaveBeenCalled()
  })

  it('cadastra e mostra o modal de sucesso com e-mail, link e mensagem do WhatsApp', async () => {
    createOrganization.mockResolvedValue({
      ok: true,
      organization: {
        id: 'org-2', name: 'Alpha Cross', slug: 'alpha-cross', brand_name: 'Alpha Cross', primary_color: '#E8521A',
        coach_display_name: 'Coach Carlos', logo_url: null, created_at: '2026-10-08T10:00:00Z',
      },
      studentAccessUrl: 'https://arbo.mxos.com.br/a/alpha-cross',
    })

    render(<AdminSuperClientes />)
    fireEvent.click(screen.getByRole('button', { name: /Novo Cliente/ }))
    fireEvent.change(screen.getByPlaceholderText('Ex.: Alpha Cross'), { target: { value: 'Alpha Cross' } })
    fireEvent.change(screen.getByPlaceholderText('Ex.: Coach Carlos'), { target: { value: 'Coach Carlos' } })
    fireEvent.change(screen.getByPlaceholderText('professor@exemplo.com'), { target: { value: 'Coach@Exemplo.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar e enviar convite/ }))

    await waitFor(() => expect(screen.getByText('Convite enviado para coach@exemplo.com!')).toBeTruthy())
    expect(createOrganization).toHaveBeenCalledWith({
      name: 'Alpha Cross',
      slug: 'alpha-cross',
      primaryColor: '#E8521A',
      adminEmail: 'coach@exemplo.com',
      coachDisplayName: 'Coach Carlos',
    })
    expect(screen.getAllByText('https://arbo.mxos.com.br/a/alpha-cross').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Copiar Mensagem para WhatsApp/ })).toBeTruthy()
  })

  it('mostra o erro do servidor no campo (ex.: slug em uso)', async () => {
    createOrganization.mockResolvedValue({
      ok: false,
      error: 'Esse slug já está em uso. Escolha outro link.',
      fields: { slug: 'Slug já em uso.' },
    })
    render(<AdminSuperClientes />)
    fireEvent.click(screen.getByRole('button', { name: /Novo Cliente/ }))
    fireEvent.change(screen.getByPlaceholderText('Ex.: Alpha Cross'), { target: { value: 'Arbo' } })
    fireEvent.change(screen.getByPlaceholderText('professor@exemplo.com'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar e enviar convite/ }))
    await waitFor(() => expect(screen.getByText('Slug já em uso.')).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toContain('slug já está em uso')
  })
})
