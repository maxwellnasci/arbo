-- Etapa 5 do white-label: bucket público `brand-assets` para a logo da assessoria.
--
-- Caminho dos arquivos: {organization_id}/logo-{timestamp}.{png|webp}
--   - nome único por upload: a URL pública muda a cada troca de logo, então o
--     cache do service worker (imagens CacheFirst 30 dias) e da CDN nunca
--     serve logo antiga.
-- Leitura: pública pela URL (bucket public). NÃO há policy de SELECT para
--   anon — ninguém lista o conteúdo do bucket.
-- Escrita (upload/troca/remoção): só admin, e só dentro da pasta da PRÓPRIA
--   organização (claim app_metadata.org_id).
-- Limites aplicados pelo próprio Storage (servidor): 2 MB, PNG/WebP. SVG fica
--   de fora de propósito (pode carregar script).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('brand-assets', 'brand-assets', true, 2097152, ARRAY['image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- SELECT para o admin na própria pasta: necessário para o Storage conferir o
-- objeto em upsert/remoção (as operações fazem RETURNING).
DROP POLICY IF EXISTS brand_assets_admin_select ON storage.objects;
CREATE POLICY brand_assets_admin_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (SELECT private.is_admin())
    AND (storage.foldername(name))[1] = (SELECT private.current_org_id())::text
  );

DROP POLICY IF EXISTS brand_assets_admin_insert ON storage.objects;
CREATE POLICY brand_assets_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND (SELECT private.is_admin())
    AND (storage.foldername(name))[1] = (SELECT private.current_org_id())::text
  );

DROP POLICY IF EXISTS brand_assets_admin_update ON storage.objects;
CREATE POLICY brand_assets_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (SELECT private.is_admin())
    AND (storage.foldername(name))[1] = (SELECT private.current_org_id())::text
  )
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND (SELECT private.is_admin())
    AND (storage.foldername(name))[1] = (SELECT private.current_org_id())::text
  );

DROP POLICY IF EXISTS brand_assets_admin_delete ON storage.objects;
CREATE POLICY brand_assets_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (SELECT private.is_admin())
    AND (storage.foldername(name))[1] = (SELECT private.current_org_id())::text
  );
