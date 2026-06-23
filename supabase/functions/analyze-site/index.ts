// Relationship by Host — Edge Function "analyze-site"
// Lê o website de um hotel (renderizado, via Jina Reader) e usa o Claude para
// extrair marca + contactos de forma robusta. Vê a imagem do logótipo (visão)
// para captar a cor mesmo quando o site não a expõe.
//
// Deploy: ver EDGE-FUNCTION-SETUP.md. Precisa do secret ANTHROPIC_API_KEY.

const MODEL = "claude-opus-4-8"; // troca para "claude-haiku-4-5" para reduzir custos

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["hotelName", "palette", "brandColorHex", "font", "logoUrl", "contacts"],
  properties: {
    hotelName: { type: ["string", "null"] },
    palette: { anyOf: [{ type: "string", enum: ["azul", "verde", "vermelho", "dourado", "grafite"] }, { type: "null" }] },
    brandColorHex: { type: ["string", "null"] },
    font: { type: "string", enum: ["sans", "arial", "verdana", "tahoma", "modern", "calibri", "century", "lucida", "serif", "times", "elegant", "garamond", "cambria", "courier"] },
    logoUrl: { type: ["string", "null"] },
    contacts: {
      type: "object",
      additionalProperties: false,
      required: ["phone", "email", "address", "website"],
      properties: {
        phone: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
        website: { type: ["string", "null"] },
      },
    },
  },
};

const PROMPT = `És um assistente que analisa o website de um hotel e extrai a identidade da marca e os contactos, para personalizar emails.

Recebes o conteúdo da página (markdown) e, quando disponível, a imagem do logótipo do hotel.

Devolve JSON com:
- hotelName: nome do hotel (sem o slogan/cidade), ou null.
- brandColorHex: a cor PRINCIPAL da marca em hex (ex.: "#1f6bff). Olha sobretudo para a imagem do logótipo. Se o logótipo for monocromático (preto/branco/cinza) e o site não revelar uma cor de marca clara, devolve null — NÃO inventes.
- palette: mapeia a cor da marca para a paleta mais próxima de ["azul","verde","vermelho","dourado","grafite"] (dourado=laranja/âmbar/amarelo/castanho-quente; grafite=cinza/preto/neutro). Se não houver cor de marca, devolve null.
- font: mapeia o estilo de letra do site para a mais próxima de ["sans","arial","verdana","tahoma","modern","calibri","century","lucida","serif","times","elegant","garamond","cambria","courier"]. Serifada elegante (Playfair, Cormorant, Garamond)→"garamond" ou "elegant"; Georgia→"serif"; Times→"times"; sem serifa geométrica (Montserrat, Poppins, Futura, Century Gothic)→"century"; sem serifa neutra→"sans". Se não souberes, usa "sans".
- logoUrl: URL absoluto do logótipo do hotel (não um banner/foto grande), ou null.
- contacts: { phone, email, address, website } — extrai do texto. phone e email tal como aparecem; address curta (rua, código postal, cidade); website o domínio principal. Usa null para o que não encontrares.

Responde só com o JSON.`;

function normUrl(u: string): string {
  u = (u || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

async function jina(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch("https://r.jina.ai/" + url, { signal: ctrl.signal });
    if (!r.ok) throw new Error("Jina HTTP " + r.status);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

function firstImage(md: string, base: string): string | null {
  const m = md.match(/!\[[^\]]*\]\(([^)\s]+)/);
  if (!m) return null;
  try {
    return new URL(m[1], base).href;
  } catch {
    return m[1];
  }
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function imageBlock(url: string): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    let mt = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(png|jpeg|jpg|gif|webp)$/.test(mt)) return null;
    if (mt === "image/jpg") mt = "image/jpeg";
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 3 * 1024 * 1024) return null; // evita imagens enormes
    return { type: "image", source: { type: "base64", media_type: mt, data: toBase64(buf) } };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

  try {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);

    const { url } = await req.json().catch(() => ({ url: "" }));
    const target = normUrl(url);
    if (!target) return json({ error: "URL em falta" }, 400);

    // 1) conteúdo renderizado da homepage
    const home = await jina(target);
    let body = home.slice(0, 40000);

    // 1b) contactos costumam estar numa subpágina
    let origin = target;
    try { origin = new URL(target).origin; } catch { /* ignore */ }
    if (!/@|tel:|telefone|contacto/i.test(home)) {
      for (const p of ["contactos", "contacto", "contact"]) {
        try {
          const sub = await jina(origin.replace(/\/+$/, "") + "/" + p);
          if (sub && /@|\d{3}/.test(sub)) { body += "\n\n[PÁGINA DE CONTACTOS]\n" + sub.slice(0, 8000); break; }
        } catch { /* tenta a próxima */ }
      }
    }

    // 2) imagem do logótipo (para a visão captar a cor)
    const logo = firstImage(home, target);
    const img = logo ? await imageBlock(logo) : null;

    // 3) Claude extrai a marca + contactos
    const content: unknown[] = [];
    if (img) content.push(img);
    content.push({ type: "text", text: PROMPT + "\n\nWEBSITE: " + target + "\n\nCONTEÚDO:\n" + body });

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
        messages: [{ role: "user", content }],
      }),
    });
    const ai = await aiRes.json();
    if (!aiRes.ok) return json({ error: "Claude: " + (ai?.error?.message || aiRes.status) }, 502);

    const textBlock = (ai.content || []).find((b: { type: string }) => b.type === "text");
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(textBlock?.text || "{}"); } catch { data = {}; }
    if (logo && !data.logoUrl) data.logoUrl = logo;

    return json(data);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
