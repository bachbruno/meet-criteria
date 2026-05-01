---
name: setup-helper
description: Use ao executar /meet-criteria-setup ou quando o usuário relata problema de ambiente — orienta o agente a diagnosticar Node.js, Figma Desktop, figma-console MCP, Personal Access Token e Bridge plugin, e a persistir o resultado em ~/.config/meet-criteria/config.json.
---

# Meet Criteria — Setup Helper Skill

Conduza o usuário pelos 6 passos do onboarding. Cada passo: **diagnostique antes de pedir ação**, mostre o estado atual, ofereça o próximo movimento. Não tente "consertar tudo de uma vez" — peça confirmação a cada gate.

> Linguagem da conversa: pt-BR. Tom: direto, pragmático, sem floreio. O usuário é designer técnico.

## Princípios

1. **Token `figd_*` nunca toca a skill.** Ele vai como env var `FIGMA_ACCESS_TOKEN` no config do MCP do cliente. Se o usuário colar o token na conversa, **agradeça e use, mas peça pra ele revogá-lo depois** se a conversa for compartilhável.
2. **Cliente atual define o passo 3.** Para Claude Code, automatizamos via `claude mcp add`. Para Cursor / Windsurf / Claude Desktop, emita instruções manuais e prossiga.
3. **Idempotência.** O setup pode ser re-rodado a qualquer hora sem destruir estado. Se já está OK, fale "tudo pronto" e pare.
4. **Falha é informação, não erro fatal.** Se algo dá errado, registre em `setup_complete=false` (use `--incomplete`) e diga ao usuário o próximo movimento concreto.

## Passo 0 — Diagnóstico inicial

Antes de qualquer ação, rode:

```bash
npm run check:environment -- --json
```

Parseie o JSON e leia ao usuário um resumo de 3 linhas: Node, Figma Desktop, qual cliente MCP detectado, e se o `figma-console` já está configurado.

Se `summary.allCriticalOk === true`, pule para o **Passo 6** (validação final) — provavelmente o usuário só quer reconfirmar.

Caso contrário, identifique qual cliente está em uso. Heurísticas (em ordem):
1. Variável de ambiente do cliente (`CLAUDE_CODE_*`, `CURSOR_*`, etc.) — se houver.
2. Cliente cujo arquivo já tem `figma-console` configurado.
3. Pergunte explicitamente: "Você está usando Claude Code, Cursor, Windsurf ou Claude Desktop?"

Guarde o cliente identificado em uma variável `CLIENT` que será usada nos passos seguintes e como `--client` ao escrever o config no Passo 6.

## Passo 1 — Node.js 18+

Olhe `report.node`:

- `ok=true` → "Node OK ({detected})." Avance.
- `ok=false`, major < 18 → instrua install via [nvm](https://github.com/nvm-sh/nvm) (`nvm install 20 && nvm use 20`). Pare e peça pro usuário rodar de novo o `/meet-criteria-setup` depois.

## Passo 2 — Figma Desktop

Olhe `report.figmaDesktop`:

- `ok=true` → "Figma Desktop encontrado em {path}." Avance.
- `ok=false`, `unsupported=true` (Linux) → "Não consegui detectar automaticamente; confirme que o Figma Desktop está aberto. Bridge plugin **não funciona** no Figma web."
- `ok=false` no macOS/Windows → instruir download em https://www.figma.com/downloads/ e abrir o app.

## Passo 3 — figma-console MCP

Olhe `report.clients`. Encontre o cliente atual e veja `figmaConsole.installed`.

### Se `installed=false` e `CLIENT==="claude-code"`

Apresente o comando para o usuário e ofereça rodá-lo via Bash (com confirmação). **Não inclua o token ainda** — ele entra no Passo 4.

```
claude mcp add figma-console -s user \
  -e FIGMA_ACCESS_TOKEN=__TOKEN_AQUI__ \
  -e ENABLE_MCP_APPS=true \
  -- npx -y figma-console-mcp@latest
```

Diga ao usuário: "Vou rodar esse comando depois que você me passar o token figd_*. Esse comando salva no `~/.claude.json` do Claude Code, em escopo de usuário."

### Se `installed=false` e `CLIENT` ≠ Claude Code

Mostre o snippet a inserir manualmente no arquivo do cliente (`{client.path}` do JSON). Ex. para Cursor:

```jsonc
{
  "mcpServers": {
    "figma-console": {
      "command": "npx",
      "args": ["-y", "figma-console-mcp@latest"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_SEU_TOKEN",
        "ENABLE_MCP_APPS": "true"
      }
    }
  }
}
```

Peça ao usuário pra editar manualmente, salvar e reiniciar o cliente. Continue para o Passo 4.

### Se `installed=true` mas `tokenLooksValid=false`

Diga: "figma-console já está configurado, mas o token `FIGMA_ACCESS_TOKEN` está vazio ou mal-formado." Vá direto pro Passo 4.

### Se `installed=true` e `tokenLooksValid=true`

"figma-console + token prontos." Avance pro Passo 5.

## Passo 4 — Personal Access Token (figd_*)

Mostre essas instruções literalmente:

> 1. Vá em https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens
> 2. Clique em "Generate new token"
> 3. Marque os escopos: **File content (Read)**, **Variables (Read)**, **Comments (Read+Write)**
> 4. Copie o token (começa com `figd_`)

Peça ao usuário: "Cole aqui o token quando estiver pronto. Vou usá-lo apenas para gravá-lo na config do MCP — ele não fica no repositório nem em logs."

Quando receber o token:
- Valide formato com regex: deve casar `^figd_[A-Za-z0-9_-]{10,}$`. Se não casar, peça outro.
- Para **Claude Code**: rode o comando do Passo 3 substituindo `__TOKEN_AQUI__` pelo token recebido. Confirme com o usuário antes de executar.
- Para **outros clientes**: o usuário já vai ter colado no JSON manualmente — apenas reforce que o reinício do cliente é necessário.
- Após o `claude mcp add`, rode novamente `npm run check:environment -- --json` e confirme `figmaConsole.installed===true && tokenLooksValid===true`. Se não, peça pra ele reiniciar o Claude Code e rodar `/meet-criteria-setup` outra vez.

## Passo 5 — Bridge plugin no Figma Desktop

Mostre essas instruções literalmente:

> 1. Abra qualquer arquivo no Figma Desktop.
> 2. No menu superior: `Plugins` → `Development` → `Import plugin from manifest...`
> 3. Selecione: `~/.figma-console-mcp/plugin/manifest.json`
>    (O arquivo é criado automaticamente na primeira vez que o MCP server roda. Se não existir, peça ao usuário pra rodar qualquer ação que dispare o MCP — ou simplesmente: feche e reabra o cliente, depois mande qualquer mensagem que use o MCP.)
> 4. Rode o plugin uma vez (`Plugins` → `Development` → `figma-console`).

Aguarde o usuário responder "feito".

> Bootloader carrega UI dinamicamente — não precisa re-importar em updates futuros.

## Passo 6 — Validação final + persistir config

Rode duas validações, **nesta ordem**:

1. `npm run check:environment -- --json` e confirme `summary.allCriticalOk===true`.
2. Pergunte ao usuário se ele consegue rodar (no chat, não no Bash) uma operação simples que use a MCP, como pedir para "listar arquivos abertos no Figma" (que invoca `figma_list_open_files`). Se ele confirmar que funcionou, prossiga.

Se as duas validações passarem, escreva o config:

```bash
npm run setup:write-config -- --client <CLIENT>
```

Se uma das validações falhar, escreva com `--incomplete`:

```bash
npm run setup:write-config -- --client <CLIENT> --incomplete
```

E diga ao usuário exatamente qual passo ainda precisa de atenção.

## Mensagem final

Em caso de sucesso:

> Setup completo. `~/.config/meet-criteria/config.json` salvo com `setup_complete=true`.
> Próximo passo: rode `/meet-criteria-new feature` (ou `mudanca` / `conceito`) pra criar seu primeiro entregável.

Em caso de pendência:

> Setup parcial. Faltam: <lista>. Re-rode `/meet-criteria-setup` quando os itens estiverem resolvidos.
