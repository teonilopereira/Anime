// ════════════════════════════════════════════════════════════════
// generate-avatar — Edge Function
//
// Genera un avatar en pixel art con la API de PixelLab.ai a partir de una
// descripción de texto, lo guarda en Supabase Storage (bucket `avatars`) y
// escribe la URL pública en profiles.photo_url del usuario autenticado.
//
// Por qué en el servidor y no en el cliente:
//   • La API key de PixelLab NUNCA puede vivir en el frontend estático.
//   • Cacheamos por hash del prompt para no re-facturar créditos de PixelLab
//     cuando alguien pide el mismo avatar dos veces.
//
// Secretos requeridos (Supabase → Edge Functions → Secrets):
//   PIXELLAB_API_KEY   → tu token Bearer de PixelLab
// Ya provistos por la plataforma en tiempo de ejecución:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════

import { createClient } from "jsr:@supabase/supabase-js@2";

const PIXELLAB_URL = "https://api.pixellab.ai/v1/generate-image-pixflux";
const BUCKET = "avatars";

// PixelLab limita el área a 400×400. Un avatar pixel-art se ve bien chico;
// clampeamos para no gastar de más ni pasarnos del límite.
const MAX_SIDE = 200;
const DEFAULT_SIDE = 128;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Hash corto y estable del prompt normalizado, para nombrar/cachear el archivo. */
async function shortHash(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** base64 → bytes, sin cargar librerías extra. */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function clampSide(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v <= 0) return DEFAULT_SIDE;
  return Math.min(Math.max(v, 32), MAX_SIDE);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const pixellabKey = Deno.env.get("PIXELLAB_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!pixellabKey || !supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: "Configuración del servidor incompleta." }, 500);
  }

  // ── 1. Verificar la sesión del usuario que llama ──
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return json({ error: "Tenés que iniciar sesión." }, 401);
  }

  // ── 2. Leer y validar la entrada ──
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const description = String(payload.description ?? "").trim();
  if (description.length < 3 || description.length > 400) {
    return json({ error: "Describí el avatar (entre 3 y 400 caracteres)." }, 400);
  }
  const width = clampSide(payload.width);
  const height = clampSide(payload.height);
  const noBackground = payload.noBackground !== false; // transparente por defecto
  const force = payload.force === true; // saltear cache y regenerar

  // ── 3. Cache: mismo prompt+tamaño ⇒ mismo archivo, no re-facturamos ──
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const cacheKey = `${description}|${width}x${height}|bg:${noBackground ? 0 : 1}`;
  const hash = await shortHash(cacheKey);
  const path = `${user.id}/${hash}.png`;
  const publicUrl =
    `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;

  if (!force) {
    const { data: existing } = await admin.storage
      .from(BUCKET)
      .list(user.id, { search: `${hash}.png` });
    if (existing && existing.some((f) => f.name === `${hash}.png`)) {
      await admin.from("profiles").update({ photo_url: publicUrl }).eq("id", user.id);
      return json({ url: publicUrl, cached: true, usd: 0 });
    }
  }

  // ── 4. Generar con PixelLab ──
  let pixellabResp: Response;
  try {
    pixellabResp = await fetch(PIXELLAB_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${pixellabKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description,
        image_size: { width, height },
        no_background: noBackground,
        text_guidance_scale: 8,
      }),
    });
  } catch (e) {
    return json({ error: "No se pudo contactar a PixelLab.", detail: String(e) }, 502);
  }

  if (!pixellabResp.ok) {
    const body = await pixellabResp.text().catch(() => "");
    // 401/403 = key inválida; 429 = sin créditos / rate limit.
    return json(
      { error: "PixelLab rechazó la solicitud.", status: pixellabResp.status, detail: body.slice(0, 500) },
      502,
    );
  }

  const result = await pixellabResp.json().catch(() => null) as
    | { image?: { base64?: string }; usage?: { usd?: number } }
    | null;
  const b64 = result?.image?.base64;
  if (!b64) {
    return json({ error: "PixelLab no devolvió una imagen." }, 502);
  }

  // ── 5. Guardar en Storage ──
  const bytes = base64ToBytes(b64);
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/png", upsert: true });
  if (upErr) {
    return json({ error: "No se pudo guardar la imagen.", detail: upErr.message }, 500);
  }

  // ── 6. Apuntar el perfil al nuevo avatar ──
  const { error: profErr } = await admin
    .from("profiles")
    .update({ photo_url: publicUrl })
    .eq("id", user.id);
  if (profErr) {
    // La imagen ya está subida; el perfil se puede reintentar. No es fatal.
    console.warn("No se pudo actualizar profiles.photo_url:", profErr.message);
  }

  return json({ url: publicUrl, cached: false, usd: result?.usage?.usd ?? null });
});
