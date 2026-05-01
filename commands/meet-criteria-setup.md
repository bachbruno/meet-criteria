---
description: Onboarding em 6 passos do Meet Criteria — detecta Node 18+, Figma Desktop, figma-console MCP, configura token e Bridge plugin, valida, persiste preferências.
---

# /meet-criteria-setup

Você foi invocado pelo usuário via `/meet-criteria-setup`.

**Use a skill `setup-helper`** para conduzir o fluxo. Comece pelo Passo 0 (diagnóstico via `npm run check:environment -- --json`).

Antes de qualquer comando que altere o sistema do usuário (`claude mcp add`, `npm run setup:write-config`), peça confirmação. O fluxo é idempotente — re-rodar é seguro.

Se o usuário já passou pelo setup antes (existir `~/.config/meet-criteria/config.json` com `setup_complete=true`), comece dizendo isso e ofereça três opções:

1. **Re-validar** (rodar checks novamente sem mudar nada)
2. **Re-instalar** (forçar reconfiguração — ex: trocou de máquina, token expirou)
3. **Cancelar**

Linguagem: pt-BR. Tom: direto.
