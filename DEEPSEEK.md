# Integração DeepSeek MCP (Poder Máximo)

Este projeto possui integração nativa com o **DeepSeek V4 Pro** (com modo Thinking habilitado) através do protocolo MCP.

## 1. O Segredo: É 100% Automático!
Você **não precisa** manter nenhum terminal WSL aberto! 
O próprio motor do Antigravity (a interface que você está usando) se encarrega de ler a configuração do MCP e **iniciar o servidor do DeepSeek silenciosamente em segundo plano** toda vez que a gente conversa. 

A conexão já está estabelecida automaticamente pela própria IDE.

## 2. Regra de Ouro: Roteamento Automático (Sem Precisar Pedir)
Você não precisa se preocupar em lembrar de pedir o DeepSeek ou o "modo thinking" a cada mensagem. 

**Como funciona:**
1. **Leitura de Contexto:** Eu (Antigravity/Gemini) leio as diretrizes deste arquivo sempre que iniciamos nossa sessão.
2. **Roteamento Inteligente:** Quando você me solicitar tarefas que envolvam **refatoração de código complexa**, **criação de algoritmos difíceis**, ou **ajustes estruturais no banco de dados**, eu irei **automaticamente** delegar a análise pesada ao **DeepSeek V4 Pro** (via MCP `deepseek-reasoner` com `thinking: enabled` ativo).
3. **Execução:** O DeepSeek fará o raciocínio profundo (Chain of Thought) em segundo plano, e eu utilizarei a resposta lógica dele para aplicar as edições de código diretamente no seu projeto.
4. **Tarefas Simples:** Dúvidas rápidas, formatações simples ou comandos triviais continuarão sendo processados por mim diretamente para garantir velocidade.

## 3. Nota Técnica: Modelos V4 Pro e V4 Flash
Em **24 de abril de 2026**, a DeepSeek lançou oficialmente a linha **DeepSeek-V4**, dividida em duas versões principais sob licença MIT e com 1 milhão de tokens de contexto:
- **DeepSeek-V4-Pro:** Modelo flagship Mixture-of-Experts (MoE) com 1.6 trilhão de parâmetros (49B ativos), desenhado para raciocínio pesado, lógica profunda e desenvolvimento de software complexo.
- **DeepSeek-V4-Flash:** Modelo MoE menor com 284B de parâmetros (13B ativos), focado em altíssima velocidade e máxima economia de latência.

Se nos logs internos houver menção a `deepseek-v4-flash`, isso pode ocorrer por redirecionamento do provedor de API ou do endpoint padrão. No entanto, para tarefas de refatoração complexa, a integração do Antigravity injeta o parâmetro `"thinking": { "type": "enabled" }`, ativando o mecanismo de pensamento (Chain of Thought) para usarmos o poder lógico equivalente ao do **V4 Pro** nas respostas.

## 4. Configuração de Chave de API e Ambiente
O servidor MCP utiliza as credenciais globais do usuário configuradas no arquivo:
`C:\Users\maxwe\.gemini\config\mcp_config.json`
- A chave de API oficial com saldo de créditos está protegida nesse arquivo de configuração do sistema.
- O arquivo local `mcp.json` na raiz do projeto é apenas um template de referência; a chave real não deve ser exposta nele para evitar vazamentos em commits do Git.

## 5. Diretrizes para o Agente (Como Invocar o Poder Máximo)
Para garantir que o agente utilize o modelo correto (**V4 Pro / Reasoner**) e evite o modelo mais fraco/limitado (**Flash**):
1. **Seleção de Modelo:** O agente deve sempre definir explicitamente `"model": "deepseek-reasoner"` na chamada da ferramenta MCP.
2. **Ativação Obrigatória do Raciocínio (Thinking):** O agente deve injetar o parâmetro `"thinking": { "type": "enabled" }` no corpo da requisição. Isso força a API a rodar a Chain of Thought (Cadeia de Pensamento).
3. **Consistência Lógica:** Ao usar o modo `thinking`, parâmetros de criatividade como `temperature` ou `top_p` devem ser omitidos, permitindo que o modelo use a sua lógica matemática máxima.
4. **Validação de Sucesso:** A chamada foi executada com sucesso no "poder máximo" somente se a resposta do MCP trouxer o bloco `<thinking>` preenchido com as etapas de raciocínio, independentemente de o log do provedor exibir rótulos de otimização como `deepseek-v4-flash`.

## 6. Transição de Modelo (Prazo: 24 de Julho de 2026)
- **Descontinuação:** O modelo `deepseek-reasoner` será descontinuado pela DeepSeek em **24 de julho de 2026**.
- **Novo Modelo:** A partir dessa data, o modelo a ser utilizado será o `deepseek-v4-pro` com modo `thinking` ativado.
- **Limitação do MCP vs Continue:** No *Continue*, a string `"deepseek-v4-pro"` funciona hoje porque ele envia o texto direto para a API sem validação local. No nosso MCP (`deepseek-mcp-server`), a chamada precisa continuar como `"deepseek-reasoner"` até a descontinuação, pois o arquivo de regras local (JSON schema) bloqueia outras nomenclaturas.
- **Ação Futura:** Em ou após 24 de julho de 2026, atualize o servidor MCP no seu ambiente e altere a diretriz do agente para enviar `"model": "deepseek-v4-pro"`.
