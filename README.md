# Relationship by Host

App de página única para a equipa HostPMS criar templates de email (RelationshipEmail) personalizados por hotel, em **PT e EN**, prontos a copiar para o campo de configuração do PMS.

- **Sem instalação, sem login** — abre o link e trabalha.
- **Projetos por hotel**, guardados na cloud (Supabase) — disponíveis em qualquer browser.
- **6 eventos**: nova reserva, pré-chegada, durante a estadia, antes do check-out, check-out e agradecimento/avaliação.
- **Construtor visual** do corpo do email (arrasta as peças: título, parágrafo, botão, imagem).
- **Galeria de modelos** com vários visuais por evento.
- **Tags do PMS** (`@GUESTNAME@`, `@RESNO@`, `@CHECKIN@`, …) inseridas no texto.

## Utilização (online)

Abre o link do GitHub Pages e começa. As alterações guardam-se sozinhas na cloud.

## Utilização (local, com publicação de imagens)

Para publicar imagens a partir do computador, corre `Relationship.bat` (arranca um ajudante local em `http://localhost:5500`). Online, usa URLs de imagem ou imagem embebida.

## Estrutura

| Ficheiro | Função |
|---|---|
| `index.html` | A aplicação (tudo num ficheiro). |
| `RelationshipHelper.ps1` | Servidor local + publicação de imagens (uso local). |
| `Relationship.bat` | Atalho para arrancar o ajudante local. |
| `supabase-schema.sql` / `supabase-acesso-direto.sql` | Esquema e regras da base de dados Supabase. |
| `CLOUD-SETUP.md` | Guia de configuração da cloud. |

> Nota: a chave Supabase incluída é a *publishable key* (pública por design). O acesso aos dados é controlado pelas regras (RLS) definidas no Supabase.
