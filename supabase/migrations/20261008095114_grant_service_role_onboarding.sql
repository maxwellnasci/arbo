-- GRANTs que faltavam ao service_role para o onboarding de usuários (mesma
-- classe do Caso 13: service_role ignora RLS, mas NÃO ignora GRANT).
--
-- Encontrado ao escrever a Edge Function create-organization (2026-10-08):
--   - profiles: service_role só tinha SELECT/REFERENCES/TRIGGER/TRUNCATE.
--     A promoção do professor convidado (UPDATE profiles SET role/organization_id,
--     feita por invite-user desde a Etapa 3 e por create-organization) falharia
--     sempre. Sem impacto real: nenhum convite foi enviado desde 2026-10-07
--     (último em 2026-08-14) e nenhum perfil está divergente do app_metadata.
--   - invites: service_role só tinha REFERENCES/TRIGGER/TRUNCATE. O log de
--     convites (INSERT feito por invite-user) nunca gravou nada — a tabela está
--     vazia em produção; o erro só ia para o console da função.
--
-- Mínimo necessário: UPDATE em profiles e INSERT em invites (os inserts usam
-- return=minimal, sem RETURNING, então SELECT em invites não é preciso).

GRANT UPDATE ON TABLE public.profiles TO service_role;
GRANT INSERT ON TABLE public.invites TO service_role;
