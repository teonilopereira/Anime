/**
 * user-stats.js
 * Gestión de estadísticas de usuario (nivel, exp, me gusta, visto, progreso)
 * Se sincroniza automáticamente con Supabase
 */

(function(window) {
    "use strict";

    // Constantes de niveles
    const LEVEL_CONFIG = {
        baseExpPerLevel: 100,
        expMultiplier: 1.2
    };

    // ────────────────────────────────────────────
    // Funciones de cálculo de experiencia
    // ────────────────────────────────────────────

    function calculateExpForLevel(level) {
        return Math.floor(LEVEL_CONFIG.baseExpPerLevel * Math.pow(LEVEL_CONFIG.expMultiplier, level - 1));
    }

    function calculateLevelFromExp(totalExp) {
        let level = 1;
        let accumulatedExp = 0;

        while (accumulatedExp + calculateExpForLevel(level) <= totalExp) {
            accumulatedExp += calculateExpForLevel(level);
            level++;
        }

        return {
            level,
            currentExp: totalExp - accumulatedExp,
            requiredExp: calculateExpForLevel(level)
        };
    }

    // ────────────────────────────────────────────
    // API Pública
    // ────────────────────────────────────────────

    const UserStats = {
        /**
         * Cargar estadísticas del usuario desde Supabase
         */
        async loadStats() {
            const user = window.AppSupabase?.getCurrentUser?.();
            if (!user) throw new Error("Usuario no autenticado");

            try {
                const { data, error } = await window.AppSupabase.db
                    .from("profiles")
                    .select("level, exp, total_likes, total_viewed")
                    .eq("id", user.id)
                    .single();

                if (error && error.code !== "PGRST116") throw error;

                return data || {
                    level: 1,
                    exp: 0,
                    total_likes: 0,
                    total_viewed: 0
                };
            } catch (err) {
                console.error("Error cargando estadísticas:", err);
                throw err;
            }
        },

        /**
         * Guardar/actualizar estadísticas del usuario
         */
        async saveStats(stats) {
            const user = window.AppSupabase?.getCurrentUser?.();
            if (!user) throw new Error("Usuario no autenticado");

            try {
                const { error } = await window.AppSupabase.db
                    .from("profiles")
                    .update({
                        level: stats.level || 1,
                        exp: stats.exp || 0,
                        total_likes: stats.total_likes || 0,
                        total_viewed: stats.total_viewed || 0,
                        updated_stats_at: new Date().toISOString()
                    })
                    .eq("id", user.id);

                if (error) throw error;

                // Registrar en auditoría
                await this.logActivity("stats_updated", null, null, null);

                return true;
            } catch (err) {
                console.error("Error guardando estadísticas:", err);
                throw err;
            }
        },

        /**
         * Incrementar experiencia y actualizar nivel automáticamente
         */
        async addExp(amount) {
            const stats = await this.loadStats();
            const newExp = stats.exp + amount;
            const levelInfo = calculateLevelFromExp(newExp);

            stats.exp = newExp;
            stats.level = levelInfo.level;

            await this.saveStats(stats);

            return {
                newLevel: levelInfo.level,
                newExp: levelInfo.currentExp,
                requiredExp: levelInfo.requiredExp,
                leveledUp: levelInfo.level > (stats.level || 1)
            };
        },

        /**
         * Incrementar contador de "me gusta"
         */
        async addLike() {
            const stats = await this.loadStats();
            stats.total_likes = (stats.total_likes || 0) + 1;
            await this.saveStats(stats);
            await this.logActivity("liked", null, null, 1);
            return stats.total_likes;
        },

        /**
         * Decrementar contador de "me gusta"
         */
        async removeLike() {
            const stats = await this.loadStats();
            stats.total_likes = Math.max(0, (stats.total_likes || 1) - 1);
            await this.saveStats(stats);
            await this.logActivity("unliked", null, null, -1);
            return stats.total_likes;
        },

        /**
         * Incrementar contador de "visto"
         */
        async addViewed() {
            const stats = await this.loadStats();
            stats.total_viewed = (stats.total_viewed || 0) + 1;
            await this.saveStats(stats);
            await this.logActivity("viewed", null, null, 1);
            return stats.total_viewed;
        },

        /**
         * Decrementar contador de "visto"
         */
        async removeViewed() {
            const stats = await this.loadStats();
            stats.total_viewed = Math.max(0, (stats.total_viewed || 1) - 1);
            await this.saveStats(stats);
            await this.logActivity("unviewed", null, null, -1);
            return stats.total_viewed;
        },

        // ────────────────────────────────────────────
        // Gestión de Progreso (episodios/capítulos)
        // ────────────────────────────────────────────

        /**
         * Guardar o actualizar progreso de un ítem
         */
        async saveProgress({ category, itemId, episodesViewed = 0, chaptersViewed = 0, volumesViewed = 0, totalEpisodes, totalChapters, totalVolumes }) {
            const user = window.AppSupabase?.getCurrentUser?.();
            if (!user) throw new Error("Usuario no autenticado");

            const totalItems = episodesViewed || chaptersViewed || volumesViewed || 0;
            const totalAvailable = totalEpisodes || totalChapters || totalVolumes || 1;
            const progressPercentage = (totalItems / totalAvailable) * 100;

            try {
                const { error } = await window.AppSupabase.db
                    .from("user_progress")
                    .upsert({
                        user_id: user.id,
                        category: String(category),
                        item_id: String(itemId),
                        episodes_viewed: episodesViewed || 0,
                        chapters_viewed: chaptersViewed || 0,
                        volumes_viewed: volumesViewed || 0,
                        total_episodes: totalEpisodes,
                        total_chapters: totalChapters,
                        total_volumes: totalVolumes,
                        progress_percentage: Math.min(100, progressPercentage),
                        updated_at: new Date().toISOString()
                    }, { onConflict: "user_id,category,item_id" });

                if (error) throw error;

                await this.logActivity("progress_updated", category, itemId, totalItems);

                // Añadir puntos exp por progreso
                await this.addExp(5);

                return true;
            } catch (err) {
                console.error("Error guardando progreso:", err);
                throw err;
            }
        },

        /**
         * Cargar progreso de un ítem específico
         */
        async loadProgress(category, itemId) {
            const user = window.AppSupabase?.getCurrentUser?.();
            if (!user) return null;

            try {
                const { data, error } = await window.AppSupabase.db
                    .from("user_progress")
                    .select("*")
                    .eq("user_id", user.id)
                    .eq("category", category)
                    .eq("item_id", itemId)
                    .single();

                if (error && error.code !== "PGRST116") throw error;

                return data || null;
            } catch (err) {
                console.error("Error cargando progreso:", err);
                return null;
            }
        },

        /**
         * Cargar todos los progresos de una categoría
         */
        async loadProgressByCategory(category) {
            const user = window.AppSupabase?.getCurrentUser?.();
            if (!user) return [];

            try {
                const { data, error } = await window.AppSupabase.db
                    .from("user_progress")
                    .select("*")
                    .eq("user_id", user.id)
                    .eq("category", category);

                if (error) throw error;

                return data || [];
            } catch (err) {
                console.error("Error cargando progreso por categoría:", err);
                return [];
            }
        },

        /**
         * Obtener estadísticas de progreso general
         */
        async getProgressStats() {
            const user = window.AppSupabase?.getCurrentUser?.();
            if (!user) return null;

            try {
                const { data, error } = await window.AppSupabase.db
                    .from("user_progress")
                    .select("category, progress_percentage, total_episodes, total_chapters, total_volumes")
                    .eq("user_id", user.id);

                if (error) throw error;

                const stats = {
                    anime: { count: 0, avgProgress: 0 },
                    manga: { count: 0, avgProgress: 0 },
                    novelas: { count: 0, avgProgress: 0 }
                };

                if (!data || data.length === 0) return stats;

                data.forEach(item => {
                    const cat = item.category;
                    if (stats[cat]) {
                        stats[cat].count++;
                        stats[cat].avgProgress += item.progress_percentage || 0;
                    }
                });

                // Calcular promedio
                Object.keys(stats).forEach(cat => {
                    if (stats[cat].count > 0) {
                        stats[cat].avgProgress = Math.round(stats[cat].avgProgress / stats[cat].count);
                    }
                });

                return stats;
            } catch (err) {
                console.error("Error obteniendo estadísticas de progreso:", err);
                return null;
            }
        },

        // ────────────────────────────────────────────
        // Auditoría y Actividad
        // ────────────────────────────────────────────

        /**
         * Registrar una actividad en el log
         */
        async logActivity(action, category = null, itemId = null, value = null) {
            const user = window.AppSupabase?.getCurrentUser?.();
            if (!user) return;

            try {
                await window.AppSupabase.db
                    .from("user_activity_log")
                    .insert({
                        user_id: user.id,
                        action,
                        category,
                        item_id: itemId,
                        value,
                        created_at: new Date().toISOString()
                    });
            } catch (err) {
                console.warn("Error registrando actividad:", err);
                // No lanzamos error porque la auditoría no debe bloquear la operación
            }
        },

        /**
         * Obtener historial de actividad
         */
        async getActivityLog(limit = 20) {
            const user = window.AppSupabase?.getCurrentUser?.();
            if (!user) return [];

            try {
                const { data, error } = await window.AppSupabase.db
                    .from("user_activity_log")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(limit);

                if (error) throw error;

                return data || [];
            } catch (err) {
                console.error("Error cargando actividad:", err);
                return [];
            }
        },

        // Helpers
        calculateExpForLevel,
        calculateLevelFromExp
    };

    // Exponer globalmente
    window.UserStats = Object.freeze(UserStats);

})(window);