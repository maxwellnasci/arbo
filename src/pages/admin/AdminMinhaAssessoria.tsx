import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus, Trash2, Save, AlertTriangle } from 'lucide-react'
import { useBrand } from '../../contexts/BrandContext'
import { useOrganizationBranding } from '../../hooks/useOrganizationBranding'
import BrandColorField from '../../components/admin/BrandColorField'
import BrandPreview from '../../components/admin/BrandPreview'
import {
  DARK_APP_BACKGROUND,
  contrastRatio,
  pickTextOnBrand,
  type Brand,
} from '../../lib/brand'
import { LOGO_MIME_TYPES, validateLogoFile } from '../../lib/brandAssets'
import arboLogo from '../../assets/arbo-run-logo.webp'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [brandName, setBrandName] = useState(brand.brandName)
  const [coachDisplayName, setCoachDisplayName] = useState(brand.coachDisplayName ?? '')
  const [primaryColor, setPrimaryColor] = useState(brand.primaryColor.toUpperCase())
  const [secondaryColor, setSecondaryColor] = useState<string | null>(brand.secondaryColor?.toUpperCase() ?? null)
  const [accentColor, setAccentColor] = useState<string | null>(brand.accentColor?.toUpperCase() ?? null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)

  // Prévia local da logo escolhida — nenhum upload antes de salvar. A URL é
  // criada no handler (não em memo/efeito) e revogada na troca/desmontagem.
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  function replacePreview(file: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = file ? URL.createObjectURL(file) : null
    setFilePreviewUrl(previewUrlRef.current)
    setLogoFile(file)
  }

  const previewLogo = filePreviewUrl ?? (removeLogo ? null : brand.logoUrl) ?? arboLogo
  const hasCustomLogo = Boolean(logoFile || (brand.logoUrl && !removeLogo))

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
    logoFile !== null ||
    removeLogo

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return
    const invalid = validateLogoFile(file)
    if (invalid) {
      toast.error(invalid)
      return
    }
    replacePreview(file)
    setRemoveLogo(false)
  }

  function handleRemoveLogo() {
    replacePreview(null)
    setRemoveLogo(Boolean(brand.logoUrl))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (nameError || !isDirty) return
    const saved = await save(brand, {
      brandName: trimmedName,
      coachDisplayName,
      primaryColor,
      secondaryColor,
      accentColor,
      logoFile,
      removeLogo,
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
          <div className={styles.logoRow}>
            <div className={styles.logoBox}>
              <img src={previewLogo} alt="Prévia da logo" className={styles.logoImg} />
            </div>
            <div className={styles.logoActions}>
              <input
                ref={fileInputRef}
                type="file"
                accept={LOGO_MIME_TYPES.join(',')}
                className={styles.hiddenInput}
                onChange={handleFileChange}
              />
              <button type="button" className={styles.secondaryBtn} onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={16} /> {hasCustomLogo ? 'Trocar logo' : 'Enviar logo'}
              </button>
              {hasCustomLogo && (
                <button type="button" className={styles.ghostBtn} onClick={handleRemoveLogo}>
                  <Trash2 size={16} /> Remover
                </button>
              )}
              <span className={styles.hint}>PNG ou WebP, até 2 MB. Fundo transparente fica melhor.</span>
            </div>
          </div>
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
          logoUrl={filePreviewUrl ?? (removeLogo ? null : brand.logoUrl)}
          coachName={coachDisplayName}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          accentColor={accentColor}
        />
      </section>
    </form>
  )
}
