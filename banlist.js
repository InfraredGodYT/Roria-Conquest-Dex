const fs = require('fs');
const pokedex = require("./data/pokedex.js").BattlePokedex;

function toID(text) {
	return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const tierList = {
  "ZU": 1,
  "PU": 2,
  "NU": 3,
  "RU": 4,
  "UU": 5,
  "OU": 6,
  "UUber": 7,
  "Uber": 8,
  "AG": 9
}

const newTier = "UUber";
const banList = [
    "annihilape",
  "arceus",
  "archeops",
  "baxcalibur",
  "calyrexice",
  "calyrexshadow",
  "chienpao",
  "chiyu",
  "darkrai",
  "deoxysattack",
  "deoxysspeed",
  "dialga",
  "dracovish",
  "dragapult",
  "espathra",
  "eternatus",
  "floetteeternal",
  "fluttermane",
  "genesect",
  "giratina",
  "gougingfire",
  "groudon",
  "hooh",
  "ironbundle",
  "kingambit",
  "koraidon",
  "kyogre",
  "kyurem",
  "landorus",
  "lugia",
  "lunala",
  "magearna",
  "marshadow",
  "mewtwo",
  "miraidon",
  "naganadel",
  "necrozma",
  "ogerponhearthflame",
  "ogerponwellspring",
  "palafin",
  "palkia",
  "pheromosa",
  "rayquaza",
  "reshiram",
  "roaringmoon",
  "sneasler",
  "solgaleo",
  "shayminsky",
  "spectrier",
  "urshifu",
  "ursalunabloodmoon",
  "walkingwake",
  "xerneas",
  "yveltal",
  "zacian",
  "zamazenta",
  "zekrom",
  "zygardecomplete",
  "darmanitangalar",
  "alakazammega",
  "blazikenmega",
  "blastoisemega",
  "gengarmega",
  "kangaskhanmega",
  "lucariomega",
  "metagrossmega",
  "salamencemega",
  "sceptilemega",
  "gallademega",
  "greninjamega",
  "delphoxmega",
  "dragonitemega",
  "starmiemega"
]

for (mon of banList) {
  let dexData = pokedex[toID(mon)];
  if (!dexData) {
    console.warn(`No dex data for ${mon}!`);
    continue;
  }
  let oldTier = dexData?.tier
  if (tierList[oldTier] > tierList[newTier]) {
    console.warn(`Skipping ${mon} because it's tiered higher.`);
    continue;
  }
  dexData.tier = newTier;
}

fs.writeFileSync(
  "./data/pokedex.js",
  "exports.BattlePokedex = " + JSON.stringify(pokedex, null, 2) + "\nexports.BattlePokedexRaw = {...exports.BattlePokedex};"
);