# Análise por IA do website — setup (uma vez só)

Isto liga a "Analisar website" a uma **Edge Function do Supabase** que usa o **Google Gemini** (grátis) para ler o site do hotel e captar cor, letra, logótipo e contactos de forma robusta (incluindo cor a partir da imagem do logótipo). A chave da IA fica **em segredo no Supabase** — nunca no código.

A app funciona na mesma sem isto (modo local). Quando a função estiver no ar, a app passa a usá-la automaticamente e cai no modo local se ela falhar.

> Porquê Gemini: a key é **grátis** e tira-se com uma **conta Google pessoal** (não precisa da console da empresa).

---

## 1) Criar uma API key do Gemini (grátis)

1. Vai a **https://aistudio.google.com/app/apikey** (entra com uma conta Google pessoal).
2. **Create API key** → escolhe/cria um projeto → copia a chave (`AIza...`).
3. O plano gratuito do Gemini Flash chega bem para isto (uma análise só acontece ao criar/atualizar um hotel).

## 2) Pôr a chave como secret no Supabase

No painel do Supabase (projeto `relationship`):

- **Edge Functions → Secrets** (ou **Project Settings → Edge Functions → Secrets**) → **Add secret**
  - **Name:** `GEMINI_API_KEY`
  - **Value:** a chave `AIza...`

## 3) Criar e fazer deploy da função

**Opção A — pelo painel (sem instalar nada):**
1. **Edge Functions → Create a new function** → nome **`analyze-site`**.
2. Cola o conteúdo do ficheiro **`supabase/functions/analyze-site/index.ts`** (está neste repositório) no editor.
3. **Deploy**.

**Opção B — pela CLI (se a tiveres):**
```bash
supabase functions deploy analyze-site --project-ref xaowygyhbyzhjxhavqhh
# secret (em alternativa ao passo 2):
# supabase secrets set GEMINI_API_KEY=AIza... --project-ref xaowygyhbyzhjxhavqhh
```

## 4) Testar

Na app: **Novo Projeto** → mete o website de um hotel → **Analisar**. Se a função estiver no ar, vês a cor/letra/logótipo/contactos a preencher e o selo **"· por IA"** (agora também em sites com logótipo monocromático, porque a IA olha para o logo). Se algo falhar, a app usa automaticamente o modo local.

---

### Notas
- A função é chamada com a *publishable key* do Supabase (a app já a tem); a função chama o Gemini do lado do servidor, por isso a tua key fica protegida.
- Modelo: definido no topo do `index.ts` (`const MODEL = "gemini-2.0-flash"`). Se um modelo não estiver disponível na tua conta, troca por `gemini-1.5-flash` ou `gemini-2.5-flash`.
- Uso/limites do Gemini: **https://aistudio.google.com** → API keys / Usage.
- Logs da função: Supabase → **Edge Functions → analyze-site → Logs**.
