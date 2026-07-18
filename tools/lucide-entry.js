/**
 * lucide-entry.js — punto de entrada para el bundle reducido de Lucide.
 *
 * El build UMD completo pesa ~402 KB porque trae TODOS los iconos; la app usa
 * ~22. Este archivo importa solo esos y reexpone `window.lucide.createIcons()`
 * con la misma firma, para no tocar el codigo que ya lo llama.
 *
 * IMPORTANTE: si agregas un `data-lucide="algo"` nuevo, sumalo aca o el icono
 * no se dibuja. tools/build.js valida esto automaticamente: escanea los HTML y
 * los JS y falla el build si encuentra un icono que no este en esta lista.
 */

import {
    createIcons,
    Activity,
    BadgeCheck,
    Book,
    BookOpen,
    CalendarDays,
    CheckCircle,
    Clapperboard,
    ClipboardList,
    Clock,
    Columns2,
    Download,
    Eye,
    Heart,
    Lightbulb,
    Menu,
    Play,
    Radio,
    Search,
    Share2,
    Star,
    TrendingUp,
    Trophy,
    XCircle,
} from 'lucide';

// Las claves deben ir en PascalCase: Lucide las convierte a kebab-case para
// machear con el atributo data-lucide.
const icons = {
    Activity,
    BadgeCheck,
    Book,
    BookOpen,
    CalendarDays,
    CheckCircle,
    Clapperboard,
    ClipboardList,
    Clock,
    Columns2,
    Download,
    Eye,
    Heart,
    Lightbulb,
    Menu,
    Play,
    Radio,
    Search,
    Share2,
    Star,
    TrendingUp,
    Trophy,
    XCircle,
};

window.lucide = {
    createIcons(options) {
        return createIcons({ icons, ...(options || {}) });
    },
};
