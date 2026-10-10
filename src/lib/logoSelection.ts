// Escolha da logo num formulário, SEM upload: o arquivo só sobe quando o
// formulário salva (LogoPicker + useOrganizationBranding/useSuperAdminOrganizations).
export type LogoSelection = {
  file: File | null
  // remover a logo atual (volta ao monograma / logo padrão)
  remove: boolean
  // URL local (blob:) do arquivo escolhido, só para prévia
  previewUrl: string | null
}

export const EMPTY_LOGO_SELECTION: LogoSelection = { file: null, remove: false, previewUrl: null }

// Logo que a prévia deve mostrar: arquivo novo > removida > atual.
export function effectiveLogoUrl(currentUrl: string | null, selection: LogoSelection): string | null {
  return selection.previewUrl ?? (selection.remove ? null : currentUrl)
}
