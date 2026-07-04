// Inicia o fluxo OAuth do Strava — chamado via navegação direta do navegador
// (window.location.href), não via fetch. Por isso não valida JWT nem exige CORS:
// a identidade do aluno só é resolvida depois, no strava-callback, através do
// Authorization header daquela chamada (feita via fetch, essa sim autenticada).

Deno.serve((req) => {
  const url = new URL(req.url)
  const clientId = Deno.env.get('STRAVA_CLIENT_ID')
  const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'

  if (!clientId) {
    return new Response('STRAVA_CLIENT_ID não configurado.', { status: 500 })
  }

  const state = url.searchParams.get('state') ?? ''
  const redirectUri = `${siteUrl}/strava/callback`

  const authorizeUrl = new URL('https://www.strava.com/oauth/authorize')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('approval_prompt', 'force')
  authorizeUrl.searchParams.set('scope', 'activity:read_all')
  if (state) authorizeUrl.searchParams.set('state', state)

  return Response.redirect(authorizeUrl.toString(), 302)
})
