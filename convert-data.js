const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, 'src');

const files = {
  'pokedex.json': 'exports.BattlePokedex = ',
  'movedex.json': 'exports.BattleMovedex = ',
  'abilities.json': 'exports.BattleAbilities = ',
  'learnsets.json': 'exports.BattleLearnsets = ',
};

const outDir = path.join(__dirname, 'data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

for (const [file, header] of Object.entries(files)) {
  const jsonPath = path.join(base, file);
  const outPath = path.join(outDir, file.replace('.json', '.js'));

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const obj = JSON.parse(raw);

  const js =
    header +
    JSON.stringify(obj, null, 2) +
    ';\n';

  fs.writeFileSync(outPath, js);
  console.log('Built:', outPath);
}

console.log('All data converted.');
