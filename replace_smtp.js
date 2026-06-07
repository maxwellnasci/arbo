const fs = require('fs');

const smtpDetails = \### SMTP (Resend)
O SMTP externo via Resend JÁ ESTÁ CONFIGURADO no Supabase Dashboard:
- **Host:** smtp.resend.com
- **Port:** 587
- **Username:** resend
- **Status:** ✅ CONFIGURADO E FUNCIONANDO
- **Domínio de envio:** mxos.com.br
- **Limite:** sem limite de emails/hora (substituiu o limite de 3-4/hora do Supabase gratuito)\;

// CLAUDE.md
let claude = fs.readFileSync('CLAUDE.md', 'utf8');
claude = claude.replace(/### Aviso SMTP[\\s\\S]*?\\*\\*Supabase Dashboard → Authentication → Settings → SMTP Settings\\*\\*/, smtpDetails);
claude = claude.replace(/- SMTP externo \\(Resend ou AWS SES\\) antes de produção\\./, '- [x] SMTP externo via Resend já configurado.');
claude = claude.replace(/- SMTP externo \\(Resend ou AWS SES\\) antes de produção/, '- [x] SMTP externo via Resend já configurado');
claude = claude.replace(/- SMTP externo \\(Resend ou AWS SES\\)/, '- [x] SMTP externo via Resend configurado');
fs.writeFileSync('CLAUDE.md', claude);

// GEMINI.md
let gemini = fs.readFileSync('GEMINI.md', 'utf8');
gemini = gemini.replace(/### Aviso SMTP[\\s\\S]*?Dashboard → Authentication → Settings → SMTP Settings/, smtpDetails);
gemini = gemini.replace(/Lighthouse audit · SMTP externo · CI\\/CD/, 'Lighthouse audit · CI/CD');
fs.writeFileSync('GEMINI.md', gemini);

// ANTIGRAVITY.md
let antigravity = fs.readFileSync('ANTIGRAVITY.md', 'utf8');
antigravity = antigravity.replace(/\\| 6 \\| \\*\\*SMTP externo\\*\\* \\| Supabase gratuito limita 3-4 emails\\/hora[\\s\\S]*?\\| Antes de lançar \\|/, '| 6 | **SMTP externo** | ✅ **CONFIGURADO** via Resend (smtp.resend.com). Domínio: mxos.com.br. Sem limite de envios. | Concluído |');
antigravity = antigravity.replace(/Lighthouse audit · SMTP externo · CI\\/CD/, 'Lighthouse audit · CI/CD');
fs.writeFileSync('ANTIGRAVITY.md', antigravity);

// ARBO_FASE2.md
let arbo = fs.readFileSync('ARBO_FASE2.md', 'utf8');
arbo = arbo.replace(/\\| 🟢 Baixa \\| \\*\\*SMTP externo\\*\\* \\| Resend ou AWS SES para não travar com limite de 3-4 emails\\/hora do Supabase gratuito \\|/, '| ✅ Concluído | **SMTP externo** | Resend configurado (smtp.resend.com) no domínio mxos.com.br sem limite de emails/hora |');
arbo = arbo.replace(/- SMTP externo \\(Resend ou AWS SES\\) antes de produção\\./, '- [x] SMTP externo via Resend já configurado.');
fs.writeFileSync('ARBO_FASE2.md', arbo);

// CLAUDE_HISTORICO.md
let historico = fs.readFileSync('CLAUDE_HISTORICO.md', 'utf8');
historico = historico.replace(/- SMTP externo \\(Resend ou AWS SES\\)/, '- [x] SMTP externo via Resend configurado');
fs.writeFileSync('CLAUDE_HISTORICO.md', historico);

console.log('Done!');
