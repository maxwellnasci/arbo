import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import {
  Building2, Copy, Plus, X, Check, MessageCircle, Link2, Pencil, PauseCircle, PlayCircle, Trash2, AlertTriangle,
} from 'lucide-react'
import { useSuperAdminOrganizations } from '../../hooks/useSuperAdminOrganizations'
import { useBrand } from '../../contexts/BrandContext'
import {
  buildWelcomeWhatsappMessage,
  deleteConfirmationMatches,
  isDefaultOrganization,
  studentAccessUrl,
  type ManagedOrganization,
} from '../../lib/superAdmin'
import {
  AI_TONE_MAX_LENGTH,
  slugify,
  validateCreateOrganizationInput,
  validateUpdateOrganizationInput,
  type CreateOrganizationInput,
  type InputErrors,
  type UpdateInputErrors,
} from '../../../supabase/functions/_shared/organizationInput'
import { brandFromOrganization, pickTextOnBrand } from '../../lib/brand'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import BrandColorField from '../../components/admin/BrandColorField'
import BrandPreview from '../../components/admin/BrandPreview'
import BrandLogo from '../../components/shared/BrandLogo'
import LogoPicker from '../../components/admin/LogoPicker'
import { EMPTY_LOGO_SELECTION, effectiveLogoUrl, type LogoSelection } from '../../lib/logoSelection'
import styles from './AdminSuperClientes.module.css'

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage)
  } catch {
    toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.')
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

type CreatedState = { organization: ManagedOrganization; studentUrl: string; adminEmail: string }

// Painel Super Admin — gestão de assessorias (só o dono da plataforma; a rota
// é protegida por SuperAdminRoute e o servidor exige is_super_admin).
export default function AdminSuperClientes() {
  const { organizations, isLoading, error, createOrganization, updateOrganization, setActive, deleteOrganization } =
    useSuperAdminOrganizations()
  const { brand, commitBrand } = useBrand()
  const [showForm, setShowForm] = useState(false)
  const [created, setCreated] = useState<CreatedState | null>(null)
  const [editing, setEditing] = useState<ManagedOrganization | null>(null)
  const [toggling, setToggling] = useState<ManagedOrganization | null>(null)
  const [deleting, setDeleting] = useState<ManagedOrganization | null>(null)

  async function handleToggleConfirm() {
    const org = toggling
    setToggling(null)
    if (!org) return
    const result = await setActive(org.id, !org.is_active)
    if (!result.ok) {
      toast.error(`Não foi possível ${org.is_active ? 'pausar' : 'reativar'}: ${result.error}`)
      return
    }
    toast.success(org.is_active ? `${displayName(org)} foi pausada.` : `${displayName(org)} foi reativada.`)
  }

  function handleSaved(org: ManagedOrganization) {
    setEditing(null)
    // Editou a própria assessoria (vitrine): aplica a marca nova na hora.
    if (org.id === brand.id) commitBrand(brandFromOrganization(org))
    toast.success('Assessoria atualizada!')
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Clientes</h1>
          <p className={styles.subtitle}>Assessorias e boxes que usam o Arbo.</p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setShowForm(true)}>
          <Plus size={16} /> Novo Cliente
        </button>
      </header>

      {isLoading && <p className={styles.muted}>Carregando assessorias...</p>}
      {error && <p className={styles.errorText}>Erro ao carregar: {error}</p>}

      {!isLoading && !error && (
        <div className={styles.grid}>
          {organizations.map(org => {
            const url = studentAccessUrl(window.location.origin, org.slug)
            const isDefault = isDefaultOrganization(org)
            return (
              <article key={org.id} className={`${styles.card} ${org.is_active ? '' : styles.cardPaused}`}>
                <div className={styles.cardTop}>
                  <BrandLogo
                    brand={{ slug: org.slug, brandName: displayName(org), logoUrl: org.logo_url }}
                    size={40}
                    alt=""
                    className={styles.swatch}
                    style={{ '--brand-logo-bg': org.primary_color, '--brand-logo-fg': pickTextOnBrand(org.primary_color) } as CSSProperties}
                  />
                  <div className={styles.cardInfo}>
                    <h2 className={styles.cardName}>{displayName(org)}</h2>
                    <span className={styles.cardSlug}>/a/{org.slug}</span>
                  </div>
                  <span className={org.is_active ? styles.badgeActive : styles.badgePaused}>
                    {org.is_active ? 'Ativo' : 'Pausado'}
                  </span>
                </div>
                <dl className={styles.meta}>
                  <div><dt>Cor</dt><dd>{org.primary_color}</dd></div>
                  <div><dt>Cadastro</dt><dd>{formatDate(org.created_at)}</dd></div>
                  {org.coach_display_name && <div><dt>Treinador</dt><dd>{org.coach_display_name}</dd></div>}
                </dl>
                <button type="button" className={styles.secondaryBtn} onClick={() => copyText(url, 'Link dos alunos copiado!')}>
                  <Copy size={14} /> Copiar Link dos Alunos
                </button>
                <div className={styles.cardActions}>
                  <button type="button" className={styles.actionBtn} onClick={() => setEditing(org)}>
                    <Pencil size={14} /> Editar
                  </button>
                  {!isDefault && (
                    <button type="button" className={styles.actionBtn} onClick={() => setToggling(org)}>
                      {org.is_active ? <><PauseCircle size={14} /> Pausar</> : <><PlayCircle size={14} /> Reativar</>}
                    </button>
                  )}
                  {!isDefault && (
                    <button type="button" className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={() => setDeleting(org)}>
                      <Trash2 size={14} /> Excluir
                    </button>
                  )}
                </div>
                {isDefault && <span className={styles.hint}>Vitrine da plataforma: não pode ser pausada nem excluída.</span>}
              </article>
            )
          })}
          {organizations.length === 0 && (
            <p className={styles.muted}>
              <Building2 size={16} /> Nenhuma assessoria cadastrada.
            </p>
          )}
        </div>
      )}

      {showForm && (
        <NovaAssessoriaModal
          onClose={() => setShowForm(false)}
          onSubmit={createOrganization}
          onCreated={(state) => {
            setShowForm(false)
            setCreated(state)
          }}
        />
      )}

      {created && <SucessoModal created={created} onClose={() => setCreated(null)} />}

      {editing && (
        <EditarAssessoriaModal
          organization={editing}
          onClose={() => setEditing(null)}
          onSubmit={updateOrganization}
          onSaved={handleSaved}
        />
      )}

      {deleting && (
        <ExcluirAssessoriaModal
          organization={deleting}
          onClose={() => setDeleting(null)}
          onSubmit={deleteOrganization}
          onDeleted={(warning) => {
            toast.success(`${displayName(deleting)} foi excluída.`)
            if (warning) toast.error(warning)
            setDeleting(null)
          }}
        />
      )}

      {toggling && createPortal(
        <ConfirmModal
          isOpen
          type="warning"
          title={toggling.is_active ? `Pausar ${displayName(toggling)}?` : `Reativar ${displayName(toggling)}?`}
          description={toggling.is_active
            ? 'Professor e alunos deixam de acessar os dados e passam a ver a tela "Assessoria temporariamente pausada". Nada é apagado — dá para reativar a qualquer momento.'
            : 'Professor e alunos voltam a acessar o app normalmente.'}
          confirmText={toggling.is_active ? 'Pausar' : 'Reativar'}
          onConfirm={handleToggleConfirm}
          onCancel={() => setToggling(null)}
        />,
        document.body,
      )}
    </div>
  )
}

function displayName(org: ManagedOrganization): string {
  return org.brand_name || org.name
}

function EditarAssessoriaModal({ organization, onClose, onSubmit, onSaved }: {
  organization: ManagedOrganization
  onClose: () => void
  onSubmit: ReturnType<typeof useSuperAdminOrganizations>['updateOrganization']
  onSaved: (org: ManagedOrganization) => void
}) {
  const isDefault = isDefaultOrganization(organization)
  const [name, setName] = useState(organization.name)
  const [brandName, setBrandName] = useState(organization.brand_name ?? '')
  const [slug, setSlug] = useState(organization.slug)
  const [coachDisplayName, setCoachDisplayName] = useState(organization.coach_display_name ?? '')
  const [primaryColor, setPrimaryColor] = useState(organization.primary_color.toUpperCase())
  const [secondaryColor, setSecondaryColor] = useState<string | null>(organization.secondary_color?.toUpperCase() ?? null)
  const [accentColor, setAccentColor] = useState<string | null>(organization.accent_color?.toUpperCase() ?? null)
  const [aiTone, setAiTone] = useState(organization.ai_tone ?? '')
  const [logo, setLogo] = useState<LogoSelection>(EMPTY_LOGO_SELECTION)
  const [errors, setErrors] = useState<UpdateInputErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = validateUpdateOrganizationInput({
      name, slug, brandName, coachDisplayName, primaryColor, secondaryColor, accentColor, aiTone,
    })
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    setErrors({})
    setIsSaving(true)
    const result = await onSubmit(organization, parsed.value, { file: logo.file, remove: logo.remove })
    setIsSaving(false)
    if (!result.ok) {
      setFormError(result.error)
      if (result.fields) setErrors(result.fields)
      return
    }
    onSaved(result.organization)
  }

  return createPortal(
    <div className={styles.overlay} onClick={isSaving ? undefined : onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} role="dialog" aria-modal="true" aria-labelledby="editar-assessoria-title" onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 id="editar-assessoria-title" className={styles.modalTitle}>Editar Assessoria</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose} disabled={isSaving} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span className={styles.label}>Nome da Assessoria</span>
            <input className={styles.input} value={name} maxLength={120} onChange={e => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)} />
            {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Logo</span>
            <LogoPicker
              slug={organization.slug}
              brandName={brandName.trim() || name}
              currentUrl={organization.logo_url}
              value={logo}
              onChange={setLogo}
              onInvalid={message => toast.error(message)}
              monogramColors={{ background: primaryColor, color: pickTextOnBrand(primaryColor) }}
              size={56}
            />
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Nome da Marca (opcional)</span>
            <input className={styles.input} value={brandName} maxLength={80} placeholder={name || 'Igual ao nome'}
              onChange={e => setBrandName(e.target.value)} aria-invalid={Boolean(errors.brandName)} />
            <span className={styles.hint}>Como a marca aparece no app. Vazio = usa o nome da assessoria.</span>
            {errors.brandName && <span className={styles.fieldError}>{errors.brandName}</span>}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Slug do link</span>
            <div className={styles.slugRow}>
              <span className={styles.slugPrefix}>/a/</span>
              <input className={styles.input} value={slug} maxLength={50} disabled={isDefault}
                onChange={e => setSlug(e.target.value.toLowerCase())} aria-invalid={Boolean(errors.slug)} />
            </div>
            <span className={styles.hint}>
              {isDefault
                ? 'O link da vitrine Arbo Run é fixo.'
                : 'Trocar o slug muda o link dos alunos — o link antigo deixa de funcionar.'}
            </span>
            {errors.slug && <span className={styles.fieldError}>{errors.slug}</span>}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Treinador Principal (opcional)</span>
            <input className={styles.input} value={coachDisplayName} maxLength={80} placeholder="Ex.: Coach Carlos"
              onChange={e => setCoachDisplayName(e.target.value)} aria-invalid={Boolean(errors.coachDisplayName)} />
            {errors.coachDisplayName && <span className={styles.fieldError}>{errors.coachDisplayName}</span>}
          </label>

          <BrandColorField label="Cor Primária" value={primaryColor} onChange={v => { if (v) setPrimaryColor(v) }}
            error={errors.primaryColor} />
          <BrandColorField label="Cor Secundária (opcional)" value={secondaryColor} onChange={setSecondaryColor}
            fallback={primaryColor} optional error={errors.secondaryColor} />
          <BrandColorField label="Cor de Destaque (opcional)" value={accentColor} onChange={setAccentColor}
            fallback={primaryColor} optional error={errors.accentColor} />

          <BrandPreview
            slug={organization.slug}
            brandName={brandName.trim() || name}
            logoUrl={effectiveLogoUrl(organization.logo_url, logo)}
            coachName={coachDisplayName}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            accentColor={accentColor}
          />

          <label className={styles.field}>
            <span className={styles.label}>Tom da IA (opcional)</span>
            <textarea className={`${styles.input} ${styles.textarea}`} value={aiTone} maxLength={AI_TONE_MAX_LENGTH} rows={3}
              placeholder="Ex.: direto e motivador, com linguagem de box de CrossFit"
              onChange={e => setAiTone(e.target.value)} aria-invalid={Boolean(errors.aiTone)} />
            <span className={styles.hint}>{aiTone.length}/{AI_TONE_MAX_LENGTH} · estilo dos recados automáticos da IA.</span>
            {errors.aiTone && <span className={styles.fieldError}>{errors.aiTone}</span>}
          </label>

          {formError && <p className={styles.formError} role="alert">{formError}</p>}

          <button type="submit" className={styles.primaryBtn} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  )
}

function ExcluirAssessoriaModal({ organization, onClose, onSubmit, onDeleted }: {
  organization: ManagedOrganization
  onClose: () => void
  onSubmit: ReturnType<typeof useSuperAdminOrganizations>['deleteOrganization']
  onDeleted: (warning?: string) => void
}) {
  const [typed, setTyped] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const blocked = isDefaultOrganization(organization)
  const matches = deleteConfirmationMatches(typed, organization.name)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!matches || blocked) return
    setFormError(null)
    setIsDeleting(true)
    const result = await onSubmit(organization.id, typed.trim())
    setIsDeleting(false)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    onDeleted(result.warning)
  }

  return createPortal(
    <div className={styles.overlay} onClick={isDeleting ? undefined : onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="excluir-assessoria-title" onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 id="excluir-assessoria-title" className={styles.modalTitle}>Excluir {displayName(organization)}</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose} disabled={isDeleting} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.dangerBox}>
          <AlertTriangle size={18} aria-hidden="true" />
          <p>
            Isso apaga <strong>para sempre</strong> a assessoria, as contas do professor e dos alunos, treinos, turmas,
            check-ins, recordes, mensagens, a logo e os vídeos dos treinos. Não dá para desfazer. Se for só temporário, use <strong>Pausar</strong>.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span className={styles.label}>Digite <strong>{organization.name}</strong> para confirmar</span>
            <input className={styles.input} value={typed} autoComplete="off" disabled={blocked}
              onChange={e => setTyped(e.target.value)} aria-label="Nome da assessoria para confirmar a exclusão" />
          </label>

          {formError && <p className={styles.formError} role="alert">{formError}</p>}

          <button type="submit" className={styles.dangerBtn} disabled={!matches || blocked || isDeleting}>
            <Trash2 size={16} /> {isDeleting ? 'Excluindo...' : 'Excluir definitivamente'}
          </button>
          <button type="button" className={styles.ghostBtn} onClick={onClose} disabled={isDeleting}>Cancelar</button>
        </form>
      </div>
    </div>,
    document.body,
  )
}

function NovaAssessoriaModal({ onClose, onSubmit, onCreated }: {
  onClose: () => void
  onSubmit: ReturnType<typeof useSuperAdminOrganizations>['createOrganization']
  onCreated: (state: CreatedState) => void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [primaryColor, setPrimaryColor] = useState('#E8521A')
  const [hexInput, setHexInput] = useState('#E8521A')
  const [coachDisplayName, setCoachDisplayName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [logo, setLogo] = useState<LogoSelection>(EMPTY_LOGO_SELECTION)
  const [errors, setErrors] = useState<InputErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function handleName(value: string) {
    setName(value)
    // Slug acompanha o nome até ser editado à mão.
    if (!slugEdited) setSlug(slugify(value))
  }

  function handleHex(value: string) {
    const normalized = (value.startsWith('#') ? value : `#${value}`).toUpperCase()
    setHexInput(normalized)
    if (/^#[0-9A-F]{6}$/.test(normalized)) setPrimaryColor(normalized)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const input = { name, slug, primaryColor: hexInput, adminEmail, coachDisplayName }
    const parsed = validateCreateOrganizationInput(input)
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    setErrors({})
    setIsSaving(true)
    const result = await onSubmit(parsed.value as CreateOrganizationInput, logo.file)
    setIsSaving(false)
    if (!result.ok) {
      setFormError(result.error)
      if (result.fields) setErrors(result.fields)
      return
    }
    if (result.logoError) {
      toast.error(`Assessoria criada, mas a logo não foi enviada (${result.logoError}). Envie de novo pelo Editar.`)
    }
    onCreated({ organization: result.organization, studentUrl: result.studentAccessUrl, adminEmail: parsed.value.adminEmail })
  }

  return createPortal(
    <div className={styles.overlay} onClick={isSaving ? undefined : onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="nova-assessoria-title" onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 id="nova-assessoria-title" className={styles.modalTitle}>Cadastrar Nova Assessoria</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose} disabled={isSaving} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span className={styles.label}>Nome da Assessoria</span>
            <input className={styles.input} value={name} maxLength={120} placeholder="Ex.: Alpha Cross"
              onChange={e => handleName(e.target.value)} aria-invalid={Boolean(errors.name)} />
            {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Slug do link</span>
            <div className={styles.slugRow}>
              <span className={styles.slugPrefix}>/a/</span>
              <input className={styles.input} value={slug} maxLength={50} placeholder="alpha-cross"
                onChange={e => { setSlugEdited(true); setSlug(e.target.value.toLowerCase()) }}
                aria-invalid={Boolean(errors.slug)} />
            </div>
            <span className={styles.hint}>Os alunos entram por {studentAccessUrl(window.location.origin, slug || 'slug')}</span>
            {errors.slug && <span className={styles.fieldError}>{errors.slug}</span>}
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Logo (opcional)</span>
            <LogoPicker
              slug={slug || 'nova-assessoria'}
              brandName={name || 'Nova Assessoria'}
              currentUrl={null}
              value={logo}
              onChange={setLogo}
              onInvalid={message => toast.error(message)}
              monogramColors={{ background: primaryColor, color: pickTextOnBrand(primaryColor) }}
              size={56}
            />
            <span className={styles.hint}>A logo sobe logo depois do cadastro, antes de você mandar o link ao professor.</span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Cor Primária</span>
            <div className={styles.colorRow}>
              <input type="color" className={styles.colorPicker} value={primaryColor.toLowerCase()}
                onChange={e => { setPrimaryColor(e.target.value.toUpperCase()); setHexInput(e.target.value.toUpperCase()) }}
                aria-label="Escolher cor primária" />
              <input className={`${styles.input} ${styles.hexInput}`} value={hexInput} maxLength={7}
                onChange={e => handleHex(e.target.value)} aria-label="Cor primária em hexadecimal"
                aria-invalid={Boolean(errors.primaryColor)} />
              <span className={styles.colorPreview} style={{ background: primaryColor, color: pickTextOnBrand(primaryColor) }}>
                Aa
              </span>
            </div>
            {errors.primaryColor && <span className={styles.fieldError}>{errors.primaryColor}</span>}
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Nome do Treinador Principal (opcional)</span>
            <input className={styles.input} value={coachDisplayName} maxLength={80} placeholder="Ex.: Coach Carlos"
              onChange={e => setCoachDisplayName(e.target.value)} aria-invalid={Boolean(errors.coachDisplayName)} />
            {errors.coachDisplayName && <span className={styles.fieldError}>{errors.coachDisplayName}</span>}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>E-mail do Professor / Responsável</span>
            <input className={styles.input} type="email" inputMode="email" autoComplete="off" value={adminEmail}
              placeholder="professor@exemplo.com" onChange={e => setAdminEmail(e.target.value)}
              aria-invalid={Boolean(errors.adminEmail)} />
            <span className={styles.hint}>Recebe o convite e entra como professor (admin) desta assessoria.</span>
            {errors.adminEmail && <span className={styles.fieldError}>{errors.adminEmail}</span>}
          </label>

          {formError && <p className={styles.formError} role="alert">{formError}</p>}

          <button type="submit" className={styles.primaryBtn} disabled={isSaving}>
            {isSaving ? 'Cadastrando e enviando convite...' : 'Cadastrar e enviar convite'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  )
}

function SucessoModal({ created, onClose }: { created: CreatedState; onClose: () => void }) {
  const message = buildWelcomeWhatsappMessage({
    organizationName: created.organization.brand_name || created.organization.name,
    coachName: created.organization.coach_display_name,
    adminEmail: created.adminEmail,
    studentUrl: created.studentUrl,
  })

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="sucesso-title" onClick={e => e.stopPropagation()}>
        <div className={styles.successIcon}><Check size={28} /></div>
        <h2 id="sucesso-title" className={styles.successTitle}>Convite enviado para {created.adminEmail}!</h2>
        <p className={styles.successText}>
          <strong>{created.organization.brand_name || created.organization.name}</strong> foi cadastrada. O professor recebe o
          e-mail para criar a senha e já entra como admin da assessoria.
        </p>

        <div className={styles.linkBox}>
          <Link2 size={16} aria-hidden="true" />
          <span className={styles.linkText}>{created.studentUrl}</span>
          <button type="button" className={styles.iconBtn} onClick={() => copyText(created.studentUrl, 'Link dos alunos copiado!')} aria-label="Copiar link dos alunos">
            <Copy size={16} />
          </button>
        </div>

        <pre className={styles.messagePreview}>{message}</pre>

        <button type="button" className={styles.whatsappBtn} onClick={() => copyText(message, 'Mensagem copiada! Cole no WhatsApp do professor.')}>
          <MessageCircle size={16} /> Copiar Mensagem para WhatsApp
        </button>
        <button type="button" className={styles.ghostBtn} onClick={onClose}>Fechar</button>
      </div>
    </div>,
    document.body,
  )
}
