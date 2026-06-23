// Relationship by Host — Edge Function "analyze-site"
// Lê o website de um hotel e usa o Google Gemini (grátis) para extrair marca +
// contactos. Vê a imagem do logótipo para captar a cor mesmo quando o site não
// a expõe. Lê o site diretamente; se existir JINA_API_KEY usa o Jina (renderiza JS).
//
// Secrets: GEMINI_API_KEY (obrigatório), JINA_API_KEY (opcional, melhora sites SPA).
// Deploy: ver EDGE-FUNCTION-SETUP.md.

const MODEL = "gemini-2.5-flash"; // grátis; alternativas: "gemini-2.0-flash", "gemini-1.5-flash" (pode vir override no body p/ teste)
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `És um assistente que analisa o website de um hotel e extrai a identidade da marca e os contactos, para personalizar emails.

Recebes o conteúdo da página (HTML ou markdown) e, quando disponível, a imagem do logótipo do hotel.

Responde APENAS com um objeto JSON (sem texto à volta, sem markdown) com EXATAMENTE estas chaves:
- "hotelName": nome do hotel (sem slogan/cidade), ou null.
- "brandColorHex": a cor PRINCIPAL da marca em hex (ex.: "#1f6bff"). Olha sobretudo para a imagem do logótipo. Se o logótipo for monocromático (preto/branco/cinza) e o site não revelar uma cor de marca clara, devolve null — NÃO inventes.
- "palette": a paleta mais próxima da cor da marca, uma de ["azul","verde","vermelho","dourado","grafite"] (dourado = laranja/âmbar/amarelo/castanho-quente; grafite = cinza/preto/neutro). Se não houver cor de marca, null.
- "font": o estilo de letra do site, um de ["sans","arial","verdana","tahoma","modern","calibri","century","lucida","serif","times","elegant","garamond","cambria","courier"]. Serifada elegante (Playfair, Cormorant, Garamond) -> "garamond" ou "elegant"; Georgia -> "serif"; Times -> "times"; sem serifa geométrica (Montserrat, Poppins, Futura, Century Gothic) -> "century"; sem serifa neutra -> "sans". Se não souberes, "sans".
- "design": o template de email mais adequado ao ESTILO do hotel, um de ["moderno","luxo","minimal","vibrante","boutique","escuro"]. "luxo" = hotel de luxo / 5 estrelas / resort premium / elegante e clássico; "minimal" = design/clean, muito espaço em branco; "vibrante" = praia / família / jovem / colorido e dinâmico; "boutique" = turismo rural / casa de campo / charmoso / acolhedor / quintas; "escuro" = urbano moderno e sofisticado (sites de fundo escuro); "moderno" = geral, quando na dúvida.
- "logoUrl": URL absoluto do logótipo do hotel (não um banner/foto grande), ou null.
- "contacts": objeto com "phone", "email", "address", "website". phone e email tal como aparecem; address curta (rua, código postal, cidade); website o domínio principal. null para o que não encontrares.`;

function normUrl(u: string): string {
  u = (u || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

// Lê o conteúdo do site. Usa o Jina (renderiza JS) se houver JINA_API_KEY; senão lê direto.
async function fetchContent(url: string): Promise<string> {
  const jk = Deno.env.get("JINA_API_KEY");
  if (jk) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 25000);
      const r = await fetch("https://r.jina.ai/" + url, { headers: { Authorization: "Bearer " + jk }, signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) { const tx = await r.text(); if (tx && tx.length > 80) return tx; }
    } catch { /* cai no fetch direto */ }
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8" }, redirect: "follow", signal: ctrl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const html = await r.text();
    // remove só os scripts de código (mantém ld+json) e os estilos
    return html
      .replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "");
  } finally {
    clearTimeout(t);
  }
}

function firstImage(content: string, base: string): string | null {
  let m = content.match(/!\[[^\]]*\]\(([^)\s]+)/)
    || content.match(/<img[^>]+(?:src|data-src)=["']([^"'>]*logo[^"'>]*)["']/i)
    || content.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || content.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i)
    || content.match(/<img[^>]+(?:src|data-src)=["']([^"'>]+)["']/i);
  if (!m) return null;
  try { return new URL(m[1], base).href; } catch { return m[1]; }
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

async function imagePart(url: string): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    let mt = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(png|jpeg|jpg|gif|webp)$/.test(mt)) return null;
    if (mt === "image/jpg") mt = "image/jpeg";
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 3 * 1024 * 1024) return null;
    return { inline_data: { mime_type: mt, data: toBase64(buf) } };
  } catch {
    return null;
  }
}

function extractJson(text: string): Record<string, unknown> {
  if (!text) return {};
  try { return JSON.parse(text); } catch { /* tenta extrair */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
  return {};
}

function writePrompt(hotel: string, purpose: string, lang: string, instruction: string): string {
  const L = lang === "en" ? "Inglês" : "Português de Portugal";
  return `Escreve o CORPO de um email de hotel, pronto a enviar a um hóspede.

Hotel: ${hotel || "(hotel)"}
Tipo de email: ${purpose || "email ao hóspede"}
Idioma: ${L}
${instruction ? "Indicação extra: " + instruction : ""}

Usa as tags do PMS quando fizer sentido (escreve-as EXATAMENTE assim): @GUESTNAME@ (nome do hóspede), @COMMERCIALNAME@ (nome do hotel), @RESNO@ (nº de reserva), @CHECKIN@ (data de chegada), @CHECKOUT@ (data de saída), @CATEGORYDESCRIPTION@ (tipologia do quarto), @UNITCODE@ (nº do alojamento), @ONLINECHECKIN@ (link de check-in online), @KEYPASS@ (chave digital).

Responde APENAS com JSON, sem texto à volta:
{"blocks":[ {"type":"h","text":"saudação ou título"}, {"type":"p","text":"parágrafo"}, {"type":"cta","text":"texto do botão","url":"@ONLINECHECKIN@"}, {"type":"p","text":"despedida"} ]}

- "h" = título/saudação; "p" = parágrafo; "cta" = botão (com "url", normalmente uma tag como @ONLINECHECKIN@ ou @KEYPASS@, ou "#").
- Estrutura típica: saudação, 2 a 3 parágrafos, um botão se fizer sentido, despedida.
- Tom profissional e caloroso, adequado ao tipo de email. Frases naturais. Sem markdown.`;
}
async function writeCopy(reqBody: Record<string, unknown>, model: string, key: string): Promise<Record<string, unknown>> {
  const hotel = String(reqBody?.hotel || "").slice(0, 120);
  const purpose = String(reqBody?.purpose || "").slice(0, 140);
  const lang = reqBody?.lang === "en" ? "en" : "pt";
  const instruction = String(reqBody?.instruction || "").slice(0, 400);
  const gRes = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: writePrompt(hotel, purpose, lang, instruction) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
      }),
    },
  );
  const g = await gRes.json();
  if (!gRes.ok) return { error: "Gemini: " + (g?.error?.message || gRes.status) };
  const text = g?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  return extractJson(text);
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "GEMINI_API_KEY não configurada" }, 500);

    const reqBody = await req.json().catch(() => ({}));
    const model = (typeof reqBody?.model === "string" && reqBody.model) ? reqBody.model : MODEL;
    if (reqBody?.action === "write") return json(await writeCopy(reqBody, model, key));
    const target = normUrl(reqBody?.url || "");
    if (!target) return json({ error: "URL em falta" }, 400);

    // 1) conteúdo da homepage
    const home = await fetchContent(target);
    let body = home.slice(0, 40000);

    // 1b) contactos costumam estar numa subpágina
    let origin = target;
    try { origin = new URL(target).origin; } catch { /* ignore */ }
    if (!/@|tel:|telefone|contacto/i.test(home)) {
      for (const p of ["contactos", "contacto", "contact"]) {
        try {
          const sub = await fetchContent(origin.replace(/\/+$/, "") + "/" + p);
          if (sub && /@|\d{3}/.test(sub)) { body += "\n\n[PAGINA DE CONTACTOS]\n" + sub.slice(0, 8000); break; }
        } catch { /* tenta a próxima */ }
      }
    }

    // 2) imagem do logótipo (para a visão captar a cor)
    const logo = firstImage(home, target);
    const img = logo ? await imagePart(logo) : null;

    // 3) Gemini extrai a marca + contactos
    const parts: unknown[] = [];
    if (img) parts.push(img);
    parts.push({ text: PROMPT + "\n\nWEBSITE: " + target + "\n\nCONTEUDO:\n" + body });

    const gRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
        }),
      },
    );
    const g = await gRes.json();
    if (!gRes.ok) return json({ error: "Gemini: " + (g?.error?.message || gRes.status) }, 502);

    const text = g?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
    const data = extractJson(text);
    if (logo && !data.logoUrl) data.logoUrl = logo;
    if (!text) (data as Record<string, unknown>)._finish = g?.candidates?.[0]?.finishReason || "vazio";

    return json(data);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
