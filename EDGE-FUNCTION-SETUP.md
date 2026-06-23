# Análise por IA do website — setup (uma vez só)

Isto liga a "Analisar website" a uma **Edge Function do Supabase** que usa o **Claude** para ler o site do hotel e captar cor, letra, logótipo e contactos de forma robusta (incluindo cor a partir da imagem do logótipo). A chave da IA fica **em segredo no Supabase** — nunca no código.

A app funciona na mesma sem isto (modo local). Quando a função estiver no ar, a app passa a usá-la automaticamente e cai no modo local se ela falhar.

---

## 1) Criar uma API key da Anthropic

1. Vai a **https://console.anthropic.com** → **Settings → API Keys** → **Create Key**.
2. Copia a chave (`sk-ant-...`). **Guarda-a** — só a vês uma vez.
3. Em **Settings → Limits/Billing**, adiciona crédito e (recomendado) define um **limite de gasto mensal**.

> Custo: cada análise gasta tokens do Claude. Com `claude-opus-4-8` (qualidade máxima) ronda **alguns cêntimos por análise**; uma análise acontece só ao criar/atualizar um hotel, por isso o volume é baixo. Para cortar custos, podes trocar o modelo para `claude-haiku-4-5` no topo do ficheiro `supabase/functions/analyze-site/index.ts` (`const MODEL = ...`).

## 2) Pôr a chave como secret no Supabase

No painel do Supabase (projeto `relationship`):

- **Edge Functions → Secrets** (ou **Project Settings → Edge Functions → Secrets**) → **Add secret**
  - **Name:** `ANTHROPIC_API_KEY`
  - **Value:** a chave `sk-ant-...`

## 3) Criar e fazer deploy da função

**Opção A — pelo painel (sem instalar nada):**
1. **Edge Functions → Create a new function** → nome **`analyze-site`**.
2. Cola o conteúdo do ficheiro **`supabase/functions/analyze-site/index.ts`** (está neste repositório) no editor.
3. **Deploy**.

**Opção B — pela CLI (se a tiveres):**
```bash
supabase functions deploy analyze-site --project-ref xaowygyhbyzhjxhavqhh
# o secret já foi posto no passo 2; em alternativa:
# supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref xaowygyhbyzhjxhavqhh
```

## 4) Testar

Na app: **Novo Projeto** → mete o website de um hotel → **Analisar**. Se a função estiver no ar, vês a cor/letra/logótipo/contactos a preencher (agora também em sites com logótipo monocromático, porque a IA olha para o logo). Se algo falhar, a app usa automaticamente o modo local.

---

### Notas
- A função é chamada com a *publishable key* do Supabase (a app já a tem); a função verifica e chama o Claude do lado do servidor.
- Para ver uso/custos: **console.anthropic.com → Usage**. Para cortar: o limite mensal do passo 1.
- Logs da função: Supabase → **Edge Functions → analyze-site → Logs**.
