/**
 * push.js — Notificaciones push de nuevos episodios (cliente).
 *
 * Se encarga SOLO del lado del navegador: pedir permiso, suscribirse al
 * PushManager con la clave pública VAPID y guardar/borrar la suscripción en
 * Supabase (tabla push_subscriptions). El envío real lo hace la edge function
 * server/functions/notify-new-episodes con la clave privada.
 *
 * Todo está protegido: si el navegador no soporta push, si no hay clave VAPID
 * configurada (AppConfig.vapidPublicKey vacío) o si el usuario es invitado, las
 * funciones devuelven un estado claro y NO rompen nada. Mientras la clave esté
 * vacía (repo por defecto), la función queda inerte.
 */
(function (window) {
    'use strict';

    // base64url (VAPID) -> Uint8Array, como pide pushManager.subscribe.
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        const output = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
        return output;
    }

    function vapidKey() {
        return (window.AppConfig && window.AppConfig.vapidPublicKey) || '';
    }

    function isSupported() {
        return typeof navigator !== 'undefined'
            && 'serviceWorker' in navigator
            && 'PushManager' in window
            && 'Notification' in window;
    }

    function isConfigured() {
        return !!vapidKey();
    }

    function toast(kind, msg) {
        if (window.Toast && window.Toast[kind]) window.Toast[kind](msg);
    }

    async function currentSubscription() {
        const reg = await navigator.serviceWorker.ready;
        return reg.pushManager.getSubscription();
    }

    // Estado actual para reflejarlo en el toggle: 'unsupported' | 'unconfigured'
    // | 'denied' | 'on' | 'off'.
    async function getState() {
        if (!isSupported()) return 'unsupported';
        if (!isConfigured()) return 'unconfigured';
        if (Notification.permission === 'denied') return 'denied';
        try {
            const sub = await currentSubscription();
            return sub ? 'on' : 'off';
        } catch (e) {
            return 'off';
        }
    }

    function signedInUserId() {
        const api = window.AppSupabase;
        if (!api || !api.isSignedIn || !api.isSignedIn()) return null;
        const user = api.getCurrentUserSync && api.getCurrentUserSync();
        return user && user.id ? user.id : null;
    }

    async function saveSubscription(userId, sub) {
        const api = window.AppSupabase;
        if (!api || !api.client) throw new Error('Supabase no disponible');
        const json = sub.toJSON();
        const { error } = await api.client.from('push_subscriptions').upsert({
            user_id: userId,
            endpoint: json.endpoint,
            p256dh: json.keys && json.keys.p256dh,
            auth: json.keys && json.keys.auth,
        }, { onConflict: 'endpoint' });
        if (error) throw error;
    }

    async function removeSubscription(sub) {
        const api = window.AppSupabase;
        if (!api || !api.client) return;
        const json = sub.toJSON();
        await api.client.from('push_subscriptions').delete().eq('endpoint', json.endpoint);
    }

    // Activa las notificaciones. Devuelve el estado final ('on', 'denied',
    // 'need-login', 'unsupported', 'unconfigured', 'error'). El toggle usa el
    // valor para revertirse si no se logró activar.
    async function enable() {
        if (!isSupported()) {
            toast('error', 'Tu navegador no soporta notificaciones push.');
            return 'unsupported';
        }
        if (!isConfigured()) {
            toast('info', 'Las notificaciones push todavía no están configuradas.');
            return 'unconfigured';
        }
        const userId = signedInUserId();
        if (!userId) {
            toast('info', 'Iniciá sesión para recibir avisos de nuevos episodios.');
            return 'need-login';
        }
        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') {
            toast('info', 'Activá los permisos de notificación en el navegador.');
            return 'denied';
        }
        try {
            const reg = await navigator.serviceWorker.ready;
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidKey()),
                });
            }
            await saveSubscription(userId, sub);
            toast('success', '¡Listo! Te vamos a avisar de los nuevos episodios. 🔔');
            return 'on';
        } catch (e) {
            if (window.AnimeDestiny) window.AnimeDestiny.reportError('push', 'No se pudo suscribir', { error: String(e && e.message || e) });
            toast('error', 'No se pudo activar las notificaciones.');
            return 'error';
        }
    }

    // Desactiva: borra la suscripción de Supabase y del navegador.
    async function disable() {
        if (!isSupported()) return 'unsupported';
        try {
            const sub = await currentSubscription();
            if (sub) {
                await removeSubscription(sub);
                await sub.unsubscribe();
            }
            return 'off';
        } catch (e) {
            if (window.AnimeDestiny) window.AnimeDestiny.reportError('push', 'No se pudo desuscribir', { error: String(e && e.message || e) });
            return 'error';
        }
    }

    const PushNotifs = Object.freeze({
        urlBase64ToUint8Array,
        isSupported,
        isConfigured,
        getState,
        enable,
        disable,
    });

    window.PushNotifs = PushNotifs;
    if (window.AnimeDestiny) window.AnimeDestiny.Push = PushNotifs;
})(window);
