// Personas que el explorador con IA puede encarnar.
//
// Cada una es un tipo de usuario con un objetivo concreto, un dispositivo y
// hábitos propios. El modelo no recibe un guion: recibe quién es y qué quiere,
// y decide qué tocar. Para agregar una, sumá un objeto a esta lista.
//
// Campos:
//   id          nombre corto para --persona
//   nombre      cómo aparece en el informe
//   quien       descripción en primera persona que lee el modelo
//   objetivo    qué intenta lograr en esta visita
//   inicio      ruta donde arranca
//   dispositivo 'escritorio' | 'celular'
//   idioma      locale del navegador (la app no cambia sola de idioma: es parte de la prueba)
//   esquema     'light' | 'dark'
//   soloTeclado true = no puede hacer clic, solo teclas y escribir en lo enfocado

export const PERSONAS = [
  {
    id: 'novato',
    nombre: 'Visitante nuevo',
    quien:
      'Tengo 19 años, miro anime de vez en cuando por recomendación de amigos. Nunca entré a Mirudoku ' +
      'y no sé qué es. Leo poco: si algo no se entiende en unos segundos, me voy.',
    objetivo:
      'Encontrar un anime para empezar a ver esta noche y entender si me conviene crearme una cuenta.',
    inicio: '/index.html',
    dispositivo: 'escritorio',
    idioma: 'es-AR',
    esquema: 'light',
  },
  {
    id: 'otaku',
    nombre: 'Fan experto',
    quien:
      'Miro anime hace 10 años, uso MyAnimeList y AniList todos los días. Conozco los términos (OVA, ' +
      'temporada, estudio) y soy exigente: noto enseguida datos mal puestos o filtros que no filtran.',
    objetivo:
      'Ver qué se estrena esta temporada, filtrar por género y año, comparar dos series y revisar el ranking. ' +
      'Decidir si Mirudoku podría reemplazar lo que ya uso.',
    inicio: '/anime.html',
    dispositivo: 'escritorio',
    idioma: 'es-AR',
    esquema: 'dark',
  },
  {
    id: 'celular',
    nombre: 'Usuario de celular apurado',
    quien:
      'Estoy en el colectivo con el celular en una mano. Tengo poca paciencia, toco rápido y me molestan ' +
      'los botones chicos, los menús que tapan todo y tener que hacer zoom.',
    objetivo:
      'Buscar un manga que me recomendaron ("algo de herreros") y ver cuántos capítulos tiene.',
    inicio: '/index.html',
    dispositivo: 'celular',
    idioma: 'es-AR',
    esquema: 'light',
  },
  {
    id: 'teclado',
    nombre: 'Usuario solo de teclado',
    quien:
      'Uso la computadora solo con el teclado (Tab, Shift+Tab, Enter, Espacio, flechas, Escape) por una ' +
      'lesión en la mano. No puedo usar el mouse. Necesito ver siempre dónde está el foco.',
    objetivo:
      'Llegar al catálogo de anime, buscar un título, abrir su ficha y encontrar cómo marcarlo como "Viendo".',
    inicio: '/index.html',
    dispositivo: 'escritorio',
    idioma: 'es-AR',
    esquema: 'light',
    soloTeclado: true,
  },
  {
    id: 'ingles',
    nombre: 'Usuario que no habla castellano',
    quien:
      'I only speak English. My browser is set to English. I found this site in a search result and ' +
      "I'm curious, but I can't read Spanish well.",
    objetivo:
      'Figure out what the site is for, switch it to English if possible, and find a popular manga.',
    inicio: '/index.html',
    dispositivo: 'escritorio',
    idioma: 'en-US',
    esquema: 'light',
  },
  {
    id: 'lector',
    nombre: 'Lector de novelas ligeras',
    quien:
      'Leo novelas ligeras y manhwa, casi nada de anime. Me importa saber en qué volumen voy y qué sale ' +
      'nuevo. Me frustra cuando un sitio trata todo como si fuera anime.',
    objetivo:
      'Encontrar una novela ligera, ver sus volúmenes y entender cómo llevaría la cuenta de lo que leí.',
    inicio: '/novelas.html',
    dispositivo: 'escritorio',
    idioma: 'es-AR',
    esquema: 'light',
  },
];

export function buscarPersona(id) {
  return PERSONAS.find((p) => p.id === id) || null;
}
