const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'datos.js');

const additions = [
  {
    id: 'm121',
    titulo: 'Alice in Borderland',
    img: 'images/manga/Alice in Borderland.webp',
    info: 'Thriller / Supervivencia',
    precio: 12800,
    status: 'Finalizado',
    clase: 'finished',
    demografia: 'seinen',
    detalle: { anio: 2010, volumenes: 18, resumen: 'Un grupo de jóvenes queda atrapado en un Tokio vacío y debe superar juegos brutales para sobrevivir.' }
  },
  {
    id: 'm122',
    titulo: 'Black Torch',
    img: 'images/manga/Black Torch.webp',
    info: 'Acción / Sobrenatural',
    precio: 9800,
    status: 'Finalizado',
    clase: 'finished',
    demografia: 'shounen',
    detalle: { anio: 2017, volumenes: 5, resumen: 'Un chico que entiende a los animales termina enfrentando espíritus y conspiraciones con un gato demoníaco.' }
  },
  {
    id: 'm123',
    titulo: 'Demi-Human',
    img: 'images/manga/Demi-Human.webp',
    info: 'Terror / Acción',
    precio: 11200,
    status: 'Finalizado',
    clase: 'finished',
    demografia: 'seinen',
    detalle: { anio: 2012, volumenes: 17, resumen: 'La inmortalidad se vuelve una condena cuando un estudiante descubre que puede volver de la muerte una y otra vez.' }
  },
  {
    id: 'm124',
    titulo: 'Elfen Lied',
    img: 'images/manga/Elfen Lied.webp',
    info: 'Drama / Terror',
    precio: 10800,
    status: 'Finalizado',
    clase: 'finished',
    demografia: 'seinen',
    detalle: { anio: 2002, volumenes: 12, resumen: 'Una historia violenta y emotiva sobre experimentos, rechazo y el choque entre humanidad y monstruosidad.' }
  },
  {
    id: 'm125',
    titulo: 'Gachiakuta',
    img: 'images/manga/Gachiakuta.jpg',
    info: 'Acción / Distopía',
    precio: 10400,
    status: 'Emisión',
    clase: 'on-air',
    demografia: 'shounen',
    detalle: { anio: 2022, volumenes: 12, resumen: 'En una sociedad que desecha personas y objetos, un chico cae al abismo y lucha por volver con justicia.' }
  },
  {
    id: 'm126',
    titulo: 'Ichi the Witch',
    img: 'images/manga/Ichi the Witch.webp',
    info: 'Fantasía / Magia',
    precio: 9400,
    status: 'Emisión',
    clase: 'on-air',
    demografia: 'shounen',
    detalle: { anio: 2024, volumenes: 1, resumen: 'Una propuesta mágica y fresca que mezcla aventura, hechicería y crecimiento del protagonista.' }
  },
  {
    id: 'm127',
    titulo: 'Kanente-san & Oonawa-kun',
    img: 'images/manga/Kanente-san & Oonawa-kun.webp',
    info: 'Comedia / Romance',
    precio: 9200,
    status: 'Emisión',
    clase: 'on-air',
    demografia: 'shounen',
    detalle: { anio: 2023, volumenes: 1, resumen: 'Una comedia escolar con química rara, silencios incómodos y un romance que crece de a poco.' }
  },
  {
    id: 'm128',
    titulo: 'Mission Yozakura Family',
    img: 'images/manga/Mission Yozakura Family.webp',
    info: 'Acción / Espías',
    precio: 10100,
    status: 'Emisión',
    clase: 'on-air',
    demografia: 'shounen',
    detalle: { anio: 2019, volumenes: 25, resumen: 'Una familia de espías usa misiones, humor y acción para proteger a los suyos y al mundo.' }
  },
  {
    id: 'm129',
    titulo: 'Mob Psycho 100',
    img: 'images/manga/Mob Psycho 100.webp',
    info: 'Psíquico / Comedia',
    precio: 10900,
    status: 'Finalizado',
    clase: 'finished',
    demografia: 'shounen',
    detalle: { anio: 2012, volumenes: 16, resumen: 'Un psíquico increíblemente poderoso intenta vivir como alguien normal mientras aprende a confiar en sí mismo.' }
  },
  {
    id: 'm130',
    titulo: 'My Favorite VTuber is Scary IRL',
    img: 'images/manga/My Favorite VTuber is Scary IRL.jpg',
    info: 'Comedia / Romance',
    precio: 9600,
    status: 'Emisión',
    clase: 'on-air',
    demografia: 'shoujo',
    detalle: { anio: 2022, volumenes: 1, resumen: 'Una comedia romántica sobre fans, secretos en internet y la vida real detrás del avatar.' }
  },
  {
    id: 'm131',
    titulo: 'Parasyte',
    img: 'images/manga/Parasyte.jpg',
    info: 'Terror / Sci-Fi',
    precio: 12100,
    status: 'Finalizado',
    clase: 'finished',
    demografia: 'seinen',
    detalle: { anio: 1988, volumenes: 10, resumen: 'Parásitos alienígenas invaden la Tierra y un chico termina compartiendo su cuerpo con uno de ellos.' }
  },
  {
    id: 'm132',
    titulo: "Reincarnated into a Game as the Hero's Friend",
    img: "images/manga/Reincarnated into a Game as the Hero's Friend.webp",
    info: 'Isekai / Fantasía',
    precio: 9800,
    status: 'Emisión',
    clase: 'on-air',
    demografia: 'shounen',
    detalle: { anio: 2022, volumenes: 1, resumen: 'Un protagonista reencarna dentro de un juego y se convierte en aliado del héroe principal.' }
  },
  {
    id: 'm133',
    titulo: 'Reincarnation Coliseum',
    img: 'images/manga/Reincarnation Coliseum.webp',
    info: 'Isekai / Acción',
    precio: 9900,
    status: 'Emisión',
    clase: 'on-air',
    demografia: 'seinen',
    detalle: { anio: 2020, volumenes: 7, resumen: 'La reencarnación se transforma en combate brutal dentro de un coliseo donde nadie pelea limpio.' }
  },
  {
    id: 'm134',
    titulo: 'Re:Zero',
    img: 'images/manga/ReZero.webp',
    info: 'Isekai / Drama',
    precio: 11500,
    status: 'Emisión',
    clase: 'on-air',
    demografia: 'seinen',
    detalle: { anio: 2014, volumenes: 4, resumen: 'Un regreso al mundo fantástico donde morir no significa acabar, sino repetir el dolor para cambiar el destino.' }
  },
  {
    id: 'm135',
    titulo: 'RuriDragon',
    img: 'images/manga/RuriDragon.webp',
    info: 'Comedia / Sobrenatural',
    precio: 8900,
    status: 'Emisión',
    clase: 'on-air',
    demografia: 'shounen',
    detalle: { anio: 2022, volumenes: 3, resumen: 'Una chica descubre rasgos de dragón y su vida escolar se vuelve más extraña, tierna y caótica.' }
  },
  {
    id: 'm136',
    titulo: 'Smoking Behind the Supermarket with You',
    img: 'images/manga/Smoking Behind the Supermarket with You.webp',
    info: 'Romance / Slice of Life',
    precio: 9700,
    status: 'Emisión',
    clase: 'on-air',
    demografia: 'seinen',
    detalle: { anio: 2020, volumenes: 5, resumen: 'Un vínculo silencioso nace entre dos personas que se cruzan cada noche detrás de un supermercado.' }
  },
  {
    id: 'm137',
    titulo: 'The Fragrant Flower Blooms with Dignity',
    img: 'images/manga/The Fragrant Flower Blooms with Dignity.webp',
    info: 'Romance / Escolar',
    precio: 10100,
    status: 'Emisión',
    clase: 'on-air',
    demografia: 'shounen',
    detalle: { anio: 2021, volumenes: 10, resumen: 'Dos mundos escolares opuestos chocan en una historia romántica suave, cálida y muy querida.' }
  },
  {
    id: 'm138',
    titulo: 'They Are Still Being Shaken This Morning',
    img: 'images/manga/They Are Still Being Shaken This Morning.webp',
    info: 'Comedia / Slice of Life',
    precio: 8800,
    status: 'Emisión',
    clase: 'on-air',
    demografia: 'shounen',
    detalle: { anio: 2023, volumenes: 1, resumen: 'Una comedia cotidiana con humor raro, situaciones incómodas y personajes que no dejan de moverse.' }
  }
];

const mangaInsert = additions.map((item) => `        { id: "${item.id}", titulo: "${item.titulo.replaceAll('"', '\\"')}", img: "${item.img.replaceAll('"', '\\"')}", info: "${item.info}", precio: ${item.precio}, status: "${item.status}", clase: "${item.clase}", demografia: "${item.demografia}" }`).join(',\n');

const detailInsert = additions.map((item) => `    ${item.id}: { anio: ${item.detalle.anio}, volumenes: ${item.detalle.volumenes}, resumen: "${item.detalle.resumen.replaceAll('"', '\\"')}" }`).join(',\n');

let data = fs.readFileSync(dataPath, 'utf8');
if (!data.includes('id: "m121"')) {
  data = data.replace(/(\n\s*\],\n\s*anime:\s*\[)/, `,\n${mangaInsert}$1`);
}
if (!data.includes('m121: {')) {
  data = data.replace(/(\nconst DETALLES_MANGA = \{[\s\S]*?)(\n\};\n\nconst DETALLES_ANIME = \{)/, `$1,\n${detailInsert}$2`);
}

fs.writeFileSync(dataPath, data, 'utf8');
console.log(`Added ${additions.length} manga entries and details.`);
