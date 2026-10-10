import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminSuperClientes from '../pages/admin/AdminSuperClientes'

const createOrganization = vi.fn()
const updateOrganization = vi.fn()
const setActive = vi.fn()
const deleteOrganization = vi.fn()
const commitBrand = vi.fn()

const ORG_BASE = {
  brand_name: null, primary_color: '#E8521A', secondary_color: null, accent_color: null,
  coach_display_name: null, ai_tone: null, logo_url: null, is_active: true, created_at: '2026-10-07T09:00:00Z',
}

vi.mock('../hooks/useSuperAdminOrganizations', () => ({
  useSuperAdminOrganizations: () => ({
    organizations: [
      { ...ORG_BASE, id: '00000000-0000-4000-a000-000000000001', name: 'Arbo Run', slug: 'arbo', brand_name: 'Arbo Run' },
      { ...ORG_BASE, id: 'org-2', name: 'Box Azul', slug: 'box-azul', primary_color: '#1D4ED8', is_active: false },
    ],
    isLoading: false,
    error: null,
    createOrganization,
    updateOrganization,
    setActive,
    deleteOrganization,
  }),
}))

vi.mock('../contexts/BrandContext', () => ({
  useBrand: () => ({ brand: { id: '00000000-0000-4000-a000-000000000001' }, commitBrand }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe('AdminSuperClientes', () => {
  beforeAll(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  beforeEach(() => {
    createOrganization.mockReset()
    updateOrganization.mockReset()
    setActive.mockReset()
    deleteOrganization.mockReset()
    commitBrand.mockReset()
  })

  it('lista as assessorias com o slug do link', () => {
    render(<AdminSuperClientes />)
    expect(screen.getByText('Arbo Run')).toBeTruthy()
    expect(screen.getByText('/a/arbo')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Copiar Link dos Alunos/ })).toHaveLength(2)
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
        ...ORG_BASE, id: 'org-3', name: 'Alpha Cross', slug: 'alpha-cross', brand_name: 'Alpha Cross',
        coach_display_name: 'Coach Carlos', created_at: '2026-10-08T10:00:00Z',
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
    }, null)
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

  it('mostra o status Ativo/Pausado de cada assessoria', () => {
    render(<AdminSuperClientes />)
    expect(screen.getByText('Ativo')).toBeTruthy()
    expect(screen.getByText('Pausado')).toBeTruthy()
  })

  it('a vitrine Arbo não tem Pausar/Excluir; a outra tem Reativar e Excluir', () => {
    render(<AdminSuperClientes />)
    expect(screen.getAllByRole('button', { name: /Editar/ })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /^Pausar$/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: /Excluir/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Reativar/ })).toBeTruthy()
    expect(screen.getByText(/não pode ser pausada nem excluída/)).toBeTruthy()
  })

  it('reativa só depois da confirmação', async () => {
    setActive.mockResolvedValue({ ok: true })
    render(<AdminSuperClientes />)
    fireEvent.click(screen.getByRole('button', { name: /Reativar/ }))
    expect(setActive).not.toHaveBeenCalled()
    expect(screen.getByText('Reativar Box Azul?')).toBeTruthy()
    const confirmButtons = screen.getAllByRole('button', { name: 'Reativar' })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])
    await waitFor(() => expect(setActive).toHaveBeenCalledWith('org-2', true))
  })

  it('exclusão só libera com o nome exato digitado', async () => {
    deleteOrganization.mockResolvedValue({ ok: true })
    render(<AdminSuperClientes />)
    fireEvent.click(screen.getByRole('button', { name: /Excluir/ }))
    const submit = screen.getByRole('button', { name: /Excluir definitivamente/ }) as HTMLButtonElement
    const input = screen.getByLabelText('Nome da assessoria para confirmar a exclusão')

    fireEvent.change(input, { target: { value: 'box azul' } })
    expect(submit.disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'Box Azul' } })
    expect(submit.disabled).toBe(false)

    fireEvent.click(submit)
    await waitFor(() => expect(deleteOrganization).toHaveBeenCalledWith('org-2', 'Box Azul'))
  })

  it('edita a assessoria com cores opcionais e tom da IA', async () => {
    updateOrganization.mockImplementation(async (org: { id: string }) => ({
      ok: true,
      organization: { ...ORG_BASE, id: org.id, name: 'Box Azul', slug: 'box-azul' },
    }))
    render(<AdminSuperClientes />)
    fireEvent.click(screen.getAllByRole('button', { name: /Editar/ })[1])
    expect(screen.getByText('Editar Assessoria')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Cor de Destaque (opcional) em hexadecimal'), { target: { value: '#22c55e' } })
    fireEvent.change(screen.getByPlaceholderText(/direto e motivador/), { target: { value: 'Animado e direto' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }))

    await waitFor(() => expect(updateOrganization).toHaveBeenCalledWith(expect.objectContaining({ id: 'org-2' }), {
      name: 'Box Azul',
      slug: 'box-azul',
      brandName: null,
      coachDisplayName: null,
      primaryColor: '#1D4ED8',
      secondaryColor: null,
      accentColor: '#22C55E',
      aiTone: 'Animado e direto',
    }, { file: null, remove: false }))
    expect(commitBrand).not.toHaveBeenCalled()
  })

  it('slug da vitrine Arbo fica travado na edição', () => {
    render(<AdminSuperClientes />)
    fireEvent.click(screen.getAllByRole('button', { name: /Editar/ })[0])
    expect((screen.getByDisplayValue('arbo') as HTMLInputElement).disabled).toBe(true)
  })

  it('card de assessoria sem logo mostra o monograma, nunca a logo da Arbo', () => {
    render(<AdminSuperClientes />)
    const monograms = screen.getAllByTestId('brand-monogram')
    expect(monograms.map(m => m.textContent)).toEqual(['BA'])
  })

  it('logo escolhida no cadastro vai junto para o servidor', async () => {
    createOrganization.mockResolvedValue({
      ok: true,
      organization: { ...ORG_BASE, id: 'org-3', name: 'Run Club', slug: 'run-club', logo_url: 'https://cdn/logo.png' },
      studentAccessUrl: 'https://arbo.mxos.com.br/a/run-club',
    })
    render(<AdminSuperClientes />)
    fireEvent.click(screen.getByRole('button', { name: /Novo Cliente/ }))
    fireEvent.change(screen.getByPlaceholderText('Ex.: Alpha Cross'), { target: { value: 'Run Club' } })
    fireEvent.change(screen.getByPlaceholderText('professor@exemplo.com'), { target: { value: 'coach@run.com' } })
    const png = new File(['x'], 'logo.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Arquivo da logo'), { target: { files: [png] } })
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar e enviar convite/ }))

    await waitFor(() => expect(createOrganization).toHaveBeenCalledWith(expect.objectContaining({ slug: 'run-club' }), png))
  })

  it('logo que falhou no cadastro avisa sem perder o convite', async () => {
    const { toast } = await import('sonner')
    createOrganization.mockResolvedValue({
      ok: true,
      organization: { ...ORG_BASE, id: 'org-4', name: 'Nitro', slug: 'nitro' },
      studentAccessUrl: 'https://arbo.mxos.com.br/a/nitro',
      logoError: 'storage fora do ar',
    })
    render(<AdminSuperClientes />)
    fireEvent.click(screen.getByRole('button', { name: /Novo Cliente/ }))
    fireEvent.change(screen.getByPlaceholderText('Ex.: Alpha Cross'), { target: { value: 'Nitro' } })
    fireEvent.change(screen.getByPlaceholderText('professor@exemplo.com'), { target: { value: 'coach@nitro.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar e enviar convite/ }))

    await waitFor(() => expect(screen.getByText('Convite enviado para coach@nitro.com!')).toBeTruthy())
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('storage fora do ar'))
  })
})
