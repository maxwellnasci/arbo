-- Painel Super Admin: o dono da plataforma envia/troca/remove a logo de
-- QUALQUER assessoria no bucket `brand-assets` (cadastro de cliente novo e
-- edição), sem precisar entrar como o professor dela.
--
-- Regras (iguais às do admin, mas sem amarrar à própria org):
--   - só quem tem a claim app_metadata.is_super_admin (private.is_super_admin())
--   - só dentro da pasta de uma organização que EXISTE ({organization_id}/...)
--   - limites de tamanho/tipo continuam no próprio bucket (2 MB, PNG/WebP)
-- A pasta é calculada FORA da subconsulta: dentro de um SELECT em
-- organizations, `name` seria organizations.name (não o nome do arquivo).
-- As policies do admin comum (brand_assets_admin_*) não mudam; policies
-- permissivas do mesmo comando se combinam por OR.

DROP POLICY IF EXISTS brand_assets_super_admin_select ON storage.objects;
CREATE POLICY brand_assets_super_admin_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (SELECT private.is_super_admin())
    AND (storage.foldername(name))[1] IN (SELECT o.id::text FROM public.organizations o)
  );

DROP POLICY IF EXISTS brand_assets_super_admin_insert ON storage.objects;
CREATE POLICY brand_assets_super_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND (SELECT private.is_super_admin())
    AND (storage.foldername(name))[1] IN (SELECT o.id::text FROM public.organizations o)
  );

DROP POLICY IF EXISTS brand_assets_super_admin_update ON storage.objects;
CREATE POLICY brand_assets_super_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (SELECT private.is_super_admin())
    AND (storage.foldername(name))[1] IN (SELECT o.id::text FROM public.organizations o)
  )
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND (SELECT private.is_super_admin())
    AND (storage.foldername(name))[1] IN (SELECT o.id::text FROM public.organizations o)
  );

DROP POLICY IF EXISTS brand_assets_super_admin_delete ON storage.objects;
CREATE POLICY brand_assets_super_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (SELECT private.is_super_admin())
    AND (storage.foldername(name))[1] IN (SELECT o.id::text FROM public.organizations o)
  );
