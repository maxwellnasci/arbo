import re

smtp_details = '''### SMTP (Resend)
O SMTP externo via Resend JÁ ESTÁ CONFIGURADO no Supabase Dashboard:
- **Host:** smtp.resend.com
- **Port:** 587
- **Username:** resend
- **Status:** ✅ CONFIGURADO E FUNCIONANDO
- **Domínio de envio:** mxos.com.br
- **Limite:** sem limite de emails/hora (substituiu o limite de 3-4/hora do Supabase gratuito)'''

def replace_in_file(filepath, replacements):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        for p, r in replacements:
            content = re.sub(p, r, content)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f'Error in {filepath}: {e}')

replace_in_file('CLAUDE.md', [
    (r'### Aviso SMTP[\\s\\S]*?\\*\\*Supabase Dashboard → Authentication → Settings → SMTP Settings\\*\\*', smtp_details),
    (r'- SMTP externo \\(Resend ou AWS SES\\) antes de produção\\.', '- [x] SMTP externo via Resend já configurado.'),
    (r'- SMTP externo \\(Resend ou AWS SES\\) antes de produção', '- [x] SMTP externo via Resend já configurado'),
    (r'- SMTP externo \\(Resend ou AWS SES\\)', '- [x] SMTP externo via Resend configurado')
])

replace_in_file('GEMINI.md', [
    (r'### Aviso SMTP[\\s\\S]*?Dashboard → Authentication → Settings → SMTP Settings', smtp_details),
    (r'Lighthouse audit · SMTP externo · CI/CD', 'Lighthouse audit · CI/CD')
])

replace_in_file('ANTIGRAVITY.md', [
    (r'\\| 6 \\| \\*\\*SMTP externo\\*\\* \\| Supabase gratuito limita 3-4 emails/hora[\\s\\S]*?\\| Antes de lançar \\|', '| 6 | **SMTP externo** | ✅ **CONFIGURADO** via Resend (smtp.resend.com). Domínio: mxos.com.br. Sem limite de envios. | Concluído |'),
    (r'Lighthouse audit · SMTP externo · CI/CD', 'Lighthouse audit · CI/CD')
])

replace_in_file('ARBO_FASE2.md', [
    (r'\\| 🟢 Baixa \\| \\*\\*SMTP externo\\*\\* \\| Resend ou AWS SES para não travar com limite de 3-4 emails/hora do Supabase gratuito \\|', '| ✅ Concluído | **SMTP externo** | Resend configurado (smtp.resend.com) no domínio mxos.com.br sem limite de emails/hora |'),
    (r'- SMTP externo \\(Resend ou AWS SES\\) antes de produção\\.', '- [x] SMTP externo via Resend já configurado.')
])

replace_in_file('CLAUDE_HISTORICO.md', [
    (r'- SMTP externo \\(Resend ou AWS SES\\)', '- [x] SMTP externo via Resend configurado')
])

print('Done!')
