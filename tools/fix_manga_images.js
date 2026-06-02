const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'datos.js');
const mangaDir = path.join(root, 'images', 'manga');

const text = fs.readFileSync(dataPath, 'utf8');
const lines = text.split(/\r?\n/);
const files = fs.readdirSync(mangaDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '');
}

function scoreTitleAgainstFile(title, fileName) {
  const titleNorm = normalize(title);
  const fileNorm = normalize(fileName.replace(/\.[^.]+$/, ''));
  if (titleNorm === fileNorm) return 1000;
  let score = 0;
  if (fileNorm.includes(titleNorm) || titleNorm.includes(fileNorm)) score += 500;

  const titleParts = String(title).split(/\s+/).map(normalize).filter(Boolean);
  for (const part of titleParts) {
    if (fileNorm.includes(part)) score += 20;
  }

  const commonPrefix = (() => {
    const limit = Math.min(titleNorm.length, fileNorm.length);
    let count = 0;
    while (count < limit && titleNorm[count] === fileNorm[count]) count += 1;
    return count;
  })();

  score += commonPrefix * 2;
  score -= Math.abs(titleNorm.length - fileNorm.length);
  return score;
}

function chooseFile(title, currentImg) {
  const currentName = String(currentImg || '').split('/').pop();
  const exactMatch = files.find((file) => normalize(file.replace(/\.[^.]+$/, '')) === normalize(title));
  if (exactMatch) return exactMatch;

  const best = files
    .map((file) => ({ file, score: scoreTitleAgainstFile(title, file) }))
    .sort((a, b) => b.score - a.score)[0];

  if (!best) return currentName;
  if (best.score < 20 && currentName) return currentName;
  return best.file;
}

let inManga = false;
let depth = 0;
let updated = 0;
let skipped = 0;
const output = [];

  for (let line of lines) {
  if (!inManga && /manga:\s*\[/.test(line)) {
    inManga = true;
  } else if (inManga && /anime:\s*\[/.test(line)) {
    inManga = false;
  }

  if (inManga) {
    const titleMatch = line.match(/titulo:\s*"([^"]+)"/);
    const imgMatch = line.match(/img:\s*"([^"]+)"/);
    if (titleMatch && imgMatch) {
      const title = titleMatch[1];
      const currentImg = imgMatch[1];
      const chosen = chooseFile(title, currentImg);
      const nextImg = chosen ? `images/manga/${chosen}` : currentImg;
      if (nextImg !== currentImg) {
        line = line.replace(imgMatch[0], `img: "${nextImg}"`);
        updated += 1;
      } else {
        skipped += 1;
      }
    }
  }

  output.push(line);
}

fs.writeFileSync(dataPath, output.join('\n'), 'utf8');
console.log(JSON.stringify({ updated, skipped }, null, 2));
