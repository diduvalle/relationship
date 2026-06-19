# Relationship by Host — Setup Cloud (Supabase + GitHub Pages)

Objetivo: tirar do localStorage e pôr na cloud, para qualquer colega editar os projetos a partir de qualquer browser, com login.

---

## Parte 1 — Supabase (base de dados + login)

**Conta:** usa o email de trabalho (ex.: `@hostpms.com`). O limite de 2 projetos free é **por conta** — por isso é preciso uma conta nova/limpa, não basta criar outra organização.

1. **Criar o projeto**
   - supabase.com → New project → escolhe nome (ex.: `relationship`) e região (Europa, ex.: *West EU / London*).
   - Define uma password forte para a base de dados (guarda-a; não a vais precisar na app).

2. **Correr o schema**
   - Menu lateral → **SQL Editor** → **New query**.
   - Cola o conteúdo do ficheiro **`supabase-schema.sql`** (está nesta pasta) → **Run**.
   - Deve dizer "Success". Cria a tabela `projects` e as regras de acesso.

3. **Ativar o login por email**
   - Menu → **Authentication** → **Providers** → **Email**: garante que está *Enabled*.
   - (Login será por **magic link** — o colega põe o email e recebe um link para entrar, sem password.)

4. **URLs de redireccionamento** *(podemos fazer depois de teres o link do GitHub Pages)*
   - Menu → **Authentication** → **URL Configuration**:
     - **Site URL**: o link do GitHub Pages (ex.: `https://<user>.github.io/relationship-host/`).
     - **Redirect URLs**: adiciona o mesmo link e, para testes, `http://localhost:5500`.

5. **Equipa (quem pode entrar)**
   - Opção simples: **Authentication → Users → Invite** os emails da equipa.
   - Ou deixar sign-up aberto (qualquer email entra). Para uma ferramenta interna, recomendo **convidar** só os colegas.

6. **Copiar as chaves (é isto que me envias)**
   - Menu → **Project Settings → API**:
     - **Project URL** (ex.: `https://abcdxyz.supabase.co`)
     - **anon public** key (a chave longa marcada como *anon* / *public*)
   - Estas duas podem ir no código da app — a *anon key* é pública por design e os dados ficam protegidos pelas regras (RLS) do schema.

---

## Parte 2 — GitHub Pages (alojar a app)

1. Cria um repositório (ex.: `relationship-host`). Pode ser **privado**.
2. Eu preparo os ficheiros (a app passa a `index.html`).
3. No repo: **Settings → Pages → Source: Deploy from a branch → main / root** → guarda.
4. Em minutos fica em `https://<user>.github.io/relationship-host/` — partilhas esse link com a equipa.

> Nota: se o repo for privado, o GitHub Pages pode exigir plano (org). Se for um obstáculo, fazemos o repo público (o código não tem segredos sensíveis — a anon key é pública e protegida por RLS).

---

## O que preciso de ti para avançar a integração

1. **Project URL** + **anon public key** (Parte 1, ponto 6).
2. Nome/URL do **repositório GitHub** (Parte 2) — ou diz que tratas tu do Pages e eu só preparo os ficheiros.

Com isto, escrevo a integração na app (login + sincronização dos projetos) e testamos juntos, ao vivo.
