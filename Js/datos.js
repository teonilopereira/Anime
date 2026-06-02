window.DATOS_WEB = { manga: [], anime: [], juegos: [], novelas: [] };

async function cargarDatosEstaticos() {
    try {
        const res = await fetch('api/datos.json');
        if (!res.ok) throw new Error('Error al cargar datos.json');
        const data = await res.json();
        window.DATOS_WEB = data;
        
        // Disparar evento para que otras partes de la app (mis-listas, etc.)
        // sepan que el catálogo está disponible si no usan promesas.
        const event = new CustomEvent('datosCargados');
        document.dispatchEvent(event);
    } catch (error) {
        console.error('No se pudo cargar el catálogo estático JSON:', error);
    }
}

// Iniciar la carga apenas se incluye este script
cargarDatosEstaticos();
