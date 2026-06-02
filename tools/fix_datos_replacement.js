const fs = require('node:fs');

const FILE = 'datos.js';

const MAP = new Map([
  ['Acci�n', 'Acción'],
  ['acci�n', 'acción'],
  ['Emisi�n', 'Emisión'],
  ['Fantas�a', 'Fantasía'],
  ['fantas�a', 'fantasía'],
  ['Psicol�gico', 'Psicológico'],
  ['psicol�gico', 'psicológico'],
  ['Ps�quico', 'Psíquico'],
  ['ps�quicos', 'psíquicos'],
  ['H�roes', 'Héroes'],
  ['h�roes', 'héroes'],
  ['h�roe', 'héroe'],
  ['Esp�as', 'Espías'],
  ['esp�a', 'espía'],
  ['V�ley', 'Vóley'],
  ['v�ley', 'vóley'],
  ['F�tbol', 'Fútbol'],
  ['Pel�cula', 'Película'],
  ['Pr�ximamente', 'Próximamente'],
  ['Hist�rico', 'Histórico'],
  ['hist�rica', 'histórica'],
  ['Jap�n', 'Japón'],
  ['sue�a', 'sueña'],
  ['m�dico', 'médico'],
  ['salv�', 'salvó'],
  ['b�squet', 'básquet'],
  ['ambici�n', 'ambición'],
  ['superaci�n', 'superación'],
  ['desaf�a', 'desafía'],
  ['l�mites', 'límites'],
  ['esp�ritus', 'espíritus'],
  ['all�', 'allá'],
  ['extra�as', 'extrañas'],
  ['hu�rfano', 'huérfano'],
  ['pol�tico', 'político'],
  ['maldici�n', 'maldición'],
  ['sue�o', 'sueño'],
  ['t�tulo', 'título'],
  ['organizaci�n', 'organización'],
  ['g�tico', 'gótico'],
  ['combusti�n', 'combustión'],
  ['espont�nea', 'espontánea'],
  ['demon�aco', 'demoníaco'],
  ['tel�pata', 'telépata'],
  ['petrificaci�n', 'petrificación'],
  ['reconstrucci�n', 'reconstrucción'],
  ['Construcci�n', 'Construcción'],
  ['construcci�n:', 'construcción:'],
  ['ni�a', 'niña'],
  ['d�bil', 'débil'],
  ['m�todos', 'métodos'],
  ['rehabilitaci�n', 'rehabilitación'],
  ['b�lica', 'bélica'],
  ['cat�strofe', 'catástrofe'],
  ['complet�', 'completó'],
  ['a�o', 'año'],
  ['vol�menes', 'volúmenes'],
  ['seg�n', 'según'],
  ['edici�n', 'edición'],
  ['m�s', 'más'],
  ['atm�sfera', 'atmósfera'],
  ['redenci�n', 'redención'],
  ['progresi�n', 'progresión'],
  ['emoci�n', 'emoción'],
  ['animaci�n', 'animación']
  ,['exploraci�n', 'exploración']
  ,['Exploraci�n', 'Exploración']
  ,['v�nculos', 'vínculos']
  ,['ficci�n', 'ficción']
  ,['fren�tico', 'frenético']
  ,['Cl�sico', 'Clásico']
  ,['cl�sico', 'clásico']
  ,['Samur�i', 'Samurái']
  ,['Dif�cil', 'Difícil']
  ,['p�gina', 'página']
  ,['pod�s', 'podés']
  ,['tr�gico', 'trágico']
  ,['cacer�a', 'cacería']
  ,['Cacer�a', 'Cacería']
  ,['ni�ez', 'niñez']
  ,['conspiraci�n', 'conspiración']
  ,['s�mbolo', 'símbolo']
  ,['cr�menes', 'crímenes']
  ,['prop�sito', 'propósito']
  ,['tensi�n', 'tensión']
  ,['trav�s', 'través']
  ,['extra�a', 'extraña']
  ,['asi�tico', 'asiático']
  ,['misi�n', 'misión']
  ,['l�mite', 'límite']
  ,['l�mite', 'límite']
  ,['Explor�', 'Explorá']
  ,['explor�', 'explorá']
  ,['sombr�o', 'sombrío']
  ,['enfrent�', 'enfrentá']
  ,['arm�', 'armá']
  ,['n�rdicos', 'nórdicos']
  ,['Ragnar�k', 'Ragnarök']
  ,['traves�a', 'travesía']
  ,['postapocal�ptica', 'postapocalíptica']
  ,['dif�ciles', 'difíciles']
  ,['ic�nicos', 'icónicos']
  ,['melanc�lico', 'melancólico']
  ,['r�pidas', 'rápidas']
  ,['g�nero', 'género']
  ,['G�tico', 'Gótico']
  ,['r�pido:', 'rápido:']
  ,['descubr�', 'descubrí']
  ,['detr�s', 'detrás']
  ,['Constru�', 'Construí']
  ,['Constru', 'Constru']
  ,['sobreviv�', 'sobreviví']
  ,['elecci�n', 'elección']
  ,['investigaci�n', 'investigación']
  ,['creaci�n', 'creación']
  ,['ic�nicas', 'icónicas']
  ,['compa�eros', 'compañeros']
  ,['Pr�xima', 'Próxima']
  ,['campa�a', 'campaña']
  ,['cl�sica', 'clásica']
  ,['fren�tica', 'frenética']
  ,['filosof�a', 'filosofía']
  ,['m�quinas', 'máquinas']
  ,['ic�nica', 'icónica']
  ,['vamp�rica', 'vampírica']
  ,['ps�quico', 'psíquico']
  ,['civilizaci�n', 'civilización']
  ,['presi�n', 'presión']
  ,['rom�ntica', 'romántica']
  ,['par�sitos', 'parásitos']
  ,['se�or', 'señor']
  ,['coraz�n:', 'corazón:']
  ,['dise�o', 'diseño']
  ,['Hechicer�a', 'Hechicería']
  ,['tr�o', 'trío']
  ,['carism�tico', 'carismático']
  ,['melanc�lica', 'melancólica']
  ,['hist�rico', 'histórico']
  ,['�ntima', 'íntima']
  ,['�pica', 'épica']
  ,['�pico', 'épico']
  ,['�l', 'él']
  ,['ï¿½ngulo', 'ángulo']
  ,['�ngulo', 'ángulo']
]);

let text = fs.readFileSync(FILE, 'utf8');
let changed = 0;

for (const [from, to] of MAP.entries()) {
  if (text.includes(from)) {
    const before = text;
    text = text.split(from).join(to);
    if (text !== before) changed += 1;
  }
}

fs.writeFileSync(FILE, text, 'utf8');
console.log(`fix_datos_replacement: reemplazos aplicados = ${changed}`);
