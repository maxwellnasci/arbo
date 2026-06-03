CREATE TABLE IF NOT EXISTS public.invites (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  role text not null check (role in ('aluno', 'admin')),
  status text not null default 'pending',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver convites" ON public.invites FOR SELECT USING (private.is_admin());
CREATE POLICY "Admins podem inserir convites" ON public.invites FOR INSERT WITH CHECK (private.is_admin());
CREATE POLICY "Admins podem atualizar convites" ON public.invites FOR UPDATE USING (private.is_admin());
CREATE POLICY "Admins podem deletar convites" ON public.invites FOR DELETE USING (private.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invites TO authenticated;
