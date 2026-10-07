-- Etapa 6 do white-label: marca da assessoria na tela de login (/a/:slug).
--
-- Antes do login não há JWT, e organizations só é legível pela própria
-- organização (RLS). Esta RPC expõe para `anon` apenas os campos de MARCA de
-- uma organização pelo slug — os mesmos que qualquer aluno vê na tela.
-- Fica de fora de propósito: id, coach_display_name, ai_tone, datas.
-- Não lista organizações: exige o slug exato (normalizado para minúsculas).

CREATE OR REPLACE FUNCTION public.get_brand_by_slug(p_slug text)
RETURNS TABLE (
  slug text,
  name text,
  brand_name text,
  logo_url text,
  primary_color text,
  secondary_color text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.slug, o.name, o.brand_name, o.logo_url, o.primary_color, o.secondary_color
  FROM public.organizations o
  WHERE o.slug = lower(trim(p_slug))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_brand_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_brand_by_slug(text) TO anon, authenticated, service_role;
