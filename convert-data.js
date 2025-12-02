const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, 'src/vanilla');

const files = {
  'pokedex.json': 'exports.BattlePokedexVanilla = ',
  'movedex.json': 'exports.BattleMovedexVanilla = ',
  'abilities.json': 'exports.BattleAbilitiesVanilla = ',
  'learnsets.json': 'exports.BattleLearnsetsVanilla = ',
};

const outDir = path.join(__dirname, 'data/vanilla');
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
