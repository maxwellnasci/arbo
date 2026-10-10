// Monograma da marca: iniciais usadas quando a assessoria ainda não tem logo
// (nunca mostrar a logo da Arbo para alunos de outro box).
//   "Run Club"        → "RC"
//   "CrossFit Nitro"  → "CN"
//   "Alpha"           → "AL"
//   "Box da Vila"     → "BV" (conectivos não contam)

const CONNECTORS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'the', 'of', 'and'])

export function brandInitials(name: string | null | undefined): string {
  const words = (name ?? '')
    .split(/[\s\-_/.&+]+/)
    .map(word => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)

  if (words.length === 0) return '?'

  const significant = words.filter(word => !CONNECTORS.has(word.toLocaleLowerCase('pt-BR')))
  const picked = significant.length > 0 ? significant : words

  const initials = picked.length === 1
    ? Array.from(picked[0]).slice(0, 2).join('')
    : Array.from(picked[0])[0] + Array.from(picked[1])[0]

  return initials.toLocaleUpperCase('pt-BR')
}
