import { useState } from 'react'
import { toast } from 'sonner'
import { Save, AlertTriangle } from 'lucide-react'
import { useBrand } from '../../contexts/BrandContext'
import { useOrganizationBranding } from '../../hooks/useOrganizationBranding'
import BrandColorField from '../../components/admin/BrandColorField'
import BrandPreview from '../../components/admin/BrandPreview'
import LogoPicker from '../../components/admin/LogoPicker'
import { EMPTY_LOGO_SELECTION, effectiveLogoUrl, type LogoSelection } from '../../lib/logoSelection'
import {
  DARK_APP_BACKGROUND,
  contrastRatio,
  pickTextOnBrand,
  type Brand,
} from '../../lib/brand'
import styles from './AdminMinhaAssessoria.module.css'

export default function AdminMinhaAssessoria() {
  const { brand, isLoading } = useBrand()

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Minha Assessoria</h1>
      <p className={styles.subtitle}>
        Identidade visual que seus alunos veem no app: logo, nome e cores.
      </p>
      {!brand.id ? (
        <p className={styles.muted}>{isLoading ? 'Carregando assessoria...' : 'Não foi possível carregar a assessoria.'}</p>
      ) : (
        // key: remonta o formulário com os valores salvos sempre que a marca muda
        <BrandingForm
          key={`${brand.id}-${brand.primaryColor}-${brand.secondaryColor}-${brand.accentColor}-${brand.logoUrl}-${brand.brandName}`}
          brand={brand}
        />
      )}
    </div>
  )
}

function BrandingForm({ brand }: { brand: Brand }) {
  const { commitBrand } = useBrand()
  const { save, isSaving } = useOrganizationBranding()

  const [brandName, setBrandName] = useState(brand.brandName)
  const [coachDisplayName, setCoachDisplayName] = useState(brand.coachDisplayName ?? '')
  const [primaryColor, setPrimaryColor] = useState(brand.primaryColor.toUpperCase())
  const [secondaryColor, setSecondaryColor] = useState<string | null>(brand.secondaryColor?.toUpperCase() ?? null)
  const [accentColor, setAccentColor] = useState<string | null>(brand.accentColor?.toUpperCase() ?? null)
  // Logo escolhida — nenhum upload antes de salvar.
  const [logo, setLogo] = useState<LogoSelection>(EMPTY_LOGO_SELECTION)

  const textOnBrand = pickTextOnBrand(primaryColor)
  const buttonContrast = contrastRatio(primaryColor, textOnBrand)
  const backgroundContrast = contrastRatio(primaryColor, DARK_APP_BACKGROUND)

  const trimmedName = brandName.trim()
  const nameError = trimmedName.length === 0 ? 'Informe o nome da marca.' : null
  const isDirty =
    trimmedName !== brand.brandName ||
    coachDisplayName.trim() !== (brand.coachDisplayName ?? '') ||
    primaryColor.toLowerCase() !== brand.primaryColor.toLowerCase() ||
    (secondaryColor ?? '').toLowerCase() !== (brand.secondaryColor ?? '').toLowerCase() ||
    (accentColor ?? '').toLowerCase() !== (brand.accentColor ?? '').toLowerCase() ||
    logo.file !== null ||
    logo.remove

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (nameError || !isDirty) return
    const saved = await save(brand, {
      brandName: trimmedName,
      coachDisplayName,
      primaryColor,
      secondaryColor,
      accentColor,
      logoFile: logo.file,
      removeLogo: logo.remove,
    })
    if (!saved) {
      toast.error('Não foi possível salvar a marca. Tente novamente.')
      return
    }
    commitBrand(saved)
    toast.success('Marca atualizada! Seus alunos já veem a nova identidade.')
  }

  return (
    <form className={styles.layout} onSubmit={handleSubmit}>
      <section className={styles.card}>
        <div className={styles.field}>
          <span className={styles.label}>Logo</span>
          <LogoPicker
            slug={brand.slug}
            brandName={trimmedName || brand.brandName}
            currentUrl={brand.logoUrl}
            value={logo}
            onChange={setLogo}
            onInvalid={message => toast.error(message)}
            monogramColors={{ background: primaryColor, color: textOnBrand }}
          />
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Nome da marca</span>
          <input
            className={styles.input}
            value={brandName}
            maxLength={80}
            onChange={e => setBrandName(e.target.value)}
            placeholder="Ex.: Box Azul Running"
          />
          {nameError && <span className={styles.error}>{nameError}</span>}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Nome de exibição do treinador</span>
          <input
            className={styles.input}
            value={coachDisplayName}
            maxLength={80}
            onChange={e => setCoachDisplayName(e.target.value)}
            placeholder="Ex.: Prof. Carlos"
          />
          <span className={styles.hint}>Como o treinador aparece para os alunos.</span>
        </label>

        <div className={styles.field}>
          <BrandColorField
            label="Cor principal"
            value={primaryColor}
            onChange={v => { if (v) setPrimaryColor(v) }}
            hint={`Botões e destaques principais. Texto sobre a cor: ${textOnBrand === '#ffffff' ? 'branco' : 'escuro'} · contraste ${buttonContrast.toFixed(1)}:1`}
          />
          {backgroundContrast < 3 && (
            <span className={styles.warning}>
              <AlertTriangle size={14} /> Cor muito escura: títulos e ícones nessa cor ficam difíceis de ler no fundo escuro do app.
            </span>
          )}
        </div>

        <BrandColorField
          label="Cor secundária (opcional)"
          value={secondaryColor}
          onChange={setSecondaryColor}
          fallback={primaryColor}
          optional
          hint="Rótulos e números do topo do app do aluno. Vazio = igual à principal."
        />

        <BrandColorField
          label="Cor de destaque (opcional)"
          value={accentColor}
          onChange={setAccentColor}
          fallback={primaryColor}
          optional
          hint="Badges (ex.: Hyrox), metas dos blocos e o ponto alto do recado da IA. Vazio = igual à principal."
        />

        <button type="submit" className={styles.saveBtn} disabled={isSaving || !isDirty || Boolean(nameError)}>
          <Save size={16} /> {isSaving ? 'Salvando...' : 'Salvar marca'}
        </button>
      </section>

      <section className={styles.card} aria-label="Prévia">
        <span className={styles.label}>Prévia</span>
        <BrandPreview
          brandName={trimmedName}
          slug={brand.slug}
          logoUrl={effectiveLogoUrl(brand.logoUrl, logo)}
          coachName={coachDisplayName}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          accentColor={accentColor}
        />
      </section>
    </form>
  )
}
