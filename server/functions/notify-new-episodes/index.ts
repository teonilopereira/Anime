// notify-new-episodes — Supabase Edge Function (Deno).
//
// Manda una notificación push a cada usuario cuando un anime que sigue ("Viendo")
// estrena un episodio. Pensada para correr cada N minutos con un cron (ver
// README.md). Lee las suscripciones con la SERVICE ROLE KEY (bypasea RLS) y
// firma el envío con la clave privada VAPID.
//
// Desplegada en el proyecto de producción desde 2026-09-29, con el cron de
// server/migrations/010_push_sent_and_cron.sql (cada 15 min).

// npm: y no esm.sh: web-push usa el crypto de Node, que el runtime de Supabase
// solo expone bien a los paquetes cargados como npm.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@animedestiny.app';

// Minutos hacia atrás que se consideran "recién emitido". Debe cubrir el
// intervalo del cron (si corre cada 15 min, dejá 20 de margen).
const VENTANA_MIN = 20;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

// Episodios emitidos en la ventana, desde el calendario de AniList.
async function episodiosRecientes(desde: number, hasta: number) {
  const query = `
    query ($from: Int, $to: Int, $page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        airingSchedules(airingAt_greater: $from, airingAt_lesser: $to) {
          episode
          media { id title { romaji english } }
        }
      }
    }`;
  const porMedia = new Map<number, { titulo: string; episode: number }>();
  for (let page = 1; page <= 10; page++) {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { from: desde, to: hasta, page } }),
    });
    if (!res.ok) break;
    const json = await res.json();
    const p = json?.data?.Page;
    if (!p) break;
    for (const s of p.airingSchedules || []) {
      const m = s.media;
      if (!m) continue;
      porMedia.set(m.id, { titulo: m.title?.romaji || m.title?.english || 'un anime', episode: s.episode });
    }
    if (!p.pageInfo?.hasNextPage) break;
  }
  return porMedia;
}

async function enviar(sub: { endpoint: string; p256dh: string; auth: string }, payload: unknown) {
  const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    // 404/410: la suscripción caducó → borrarla para no reintentar siempre.
    // deno-lint-ignore no-explicit-any
    const status = (err as any)?.statusCode;
    if (status === 404 || status === 410) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    }
    return false;
  }
}

Deno.serve(async () => {
  const ahora = Math.floor(Date.now() / 1000);
  const desde = ahora - VENTANA_MIN * 60;

  const aired = await episodiosRecientes(desde, ahora);
  if (aired.size === 0) {
    return new Response(JSON.stringify({ ok: true, notificados: 0, motivo: 'sin episodios en la ventana' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ids = [...aired.keys()];

  // Usuarios que siguen ("Viendo") alguno de los anime que acaban de emitir.
  // 'listas' también: el estado puesto desde Mis listas puede guardarse con esa
  // categoría (setWatchStatus en js/catalog/states.js).
  const { data: follows, error } = await supabase
    .from('item_states')
    .select('user_id, item_id')
    .in('category', ['anime', 'listas'])
    .eq('watch_status', 'viendo')
    .in('item_id', ids);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  // user_id -> lista de {mediaId} que le interesan.
  const porUsuario = new Map<string, number[]>();
  for (const f of follows || []) {
    const mid = Number(f.item_id);
    if (!aired.has(mid)) continue;
    const arr = porUsuario.get(f.user_id) || [];
    arr.push(mid);
    porUsuario.set(f.user_id, arr);
  }

  let notificados = 0;
  for (const [userId, medias] of porUsuario) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);
    if (!subs || subs.length === 0) continue;

    for (const mid of medias) {
      const info = aired.get(mid)!;
      const payload = {
        title: `Nuevo episodio de ${info.titulo}`,
        body: `Ya salió el episodio ${info.episode}. ¡Miralo!`,
        // Relativa a propósito: sw.js la resuelve contra su scope, así el aviso
        // abre el mismo sitio donde el usuario se suscribió (Netlify o GitHub
        // Pages en /Anime/), no siempre Netlify.
        url: `detalle.html?cat=anime&id=${mid}`,
        tag: `anime-${mid}-ep-${info.episode}`,
      };
      // Un aviso por usuario y episodio aunque el cron (o alguien con la
      // clave anónima) llame dos veces dentro de la ventana.
      const { error: dup } = await supabase
        .from('push_sent')
        .insert({ user_id: userId, tag: payload.tag });
      if (dup) continue;
      for (const sub of subs) {
        if (await enviar(sub, payload)) notificados++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, notificados }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
