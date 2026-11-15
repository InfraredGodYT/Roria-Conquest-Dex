#!/usr/bin/env node
'use strict';

/**
 * Syncs the dex's data files from the Showdown clients, instead of editing
 * them by hand.
 *
 *   data/*.js         <- the PBB Legacy fork's client build
 *   data/vanilla/*.js <- play.pokemonshowdown.com, with globals renamed to
 *                        Battle*Vanilla so they don't clash with the fork's.
 *                        Upstream's client no longer ships move/ability/item
 *                        descriptions, so those are merged in from the
 *                        server repo's data/text/*.ts.
 *
 * Files are written pretty-printed so `git diff` shows what each patch changed.
 *
 * Afterwards it runs ./build so the cache-busting hashes in index.php update.
 *
 * Usage:
 *   node sync-data.js              sync everything, then build
 *   node sync-data.js --dry-run    show what would change, write nothing
 *   node sync-data.js --no-build   sync but don't run ./build
 *   node sync-data.js --force      skip the "lost too many entries" check
 *
 * Sources can be overridden in config/config.js via `exports.dataSources`
 * (see config/config-example.js).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const child_process = require('child_process');

process.chdir(__dirname);

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');
const NO_BUILD = args.has('--no-build') || DRY_RUN;

let config = {};
try {
	config = require('./config/config').dataSources || {};
} catch (e) {}

const SOURCES = {
	// Local path to the fork client's built data dir (preferred: always matches
	// the last `node build` of the fork), or a URL to fall back on.
	forkDir: config.forkDir || '/var/www/RC-Showdown/client/play.pokemonshowdown.com/data',
	forkUrl: config.forkUrl || 'https://play.pbblegacy.com/data',
	vanillaUrl: config.vanillaUrl || 'https://play.pokemonshowdown.com/data',
	vanillaTextUrl: config.vanillaTextUrl ||
		'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/text',
};

// [source filename, dest path, global name in source, global name in dest]
const FORK_FILES = [
	['pokedex.js', 'data/pokedex.js', 'BattlePokedex'],
	['moves.js', 'data/movedex.js', 'BattleMovedex'],
	['abilities.js', 'data/abilities.js', 'BattleAbilities'],
	['items.js', 'data/items.js', 'BattleItems'],
	['learnsets.js', 'data/learnsets.js', 'BattleLearnsets'],
	['formats-data.js', 'data/formats-data.js', 'BattleFormatsData'],
	['teambuilder-tables.js', 'data/teambuilder-tables.js', 'BattleTeambuilderTable'],
];

// [source filename, dest path, global name in source, global name in dest, text file]
const VANILLA_FILES = [
	['pokedex.js', 'data/vanilla/pokedex.js', 'BattlePokedex', 'BattlePokedexVanilla'],
	['moves.js', 'data/vanilla/movedex.js', 'BattleMovedex', 'BattleMovedexVanilla', 'moves.ts'],
	['abilities.js', 'data/vanilla/abilities.js', 'BattleAbilities', 'BattleAbilitiesVanilla', 'abilities.ts'],
	['items.js', 'data/vanilla/items.js', 'BattleItems', 'BattleItemsVanilla', 'items.ts'],
	['learnsets.js', 'data/vanilla/learnsets.js', 'BattleLearnsets', 'BattleLearnsetsVanilla'],
];

async function fetchText(url) {
	const res = await fetch(url, {headers: {'User-Agent': 'dex-data-sync'}});
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	return res.text();
}

async function readFork(filename) {
	const local = path.join(SOURCES.forkDir, filename);
	if (fs.existsSync(local)) return {text: fs.readFileSync(local, 'utf8'), from: local};
	const url = `${SOURCES.forkUrl}/${filename}`;
	return {text: await fetchText(url), from: url};
}

/** Runs a data file in an empty sandbox and returns the named global. */
function evaluate(text, globalName, label) {
	const sandbox = {};
	sandbox.exports = sandbox;
	sandbox.window = sandbox;
	vm.runInNewContext(text, sandbox, {filename: label, timeout: 30000});
	const value = sandbox[globalName];
	if (!value || typeof value !== 'object') {
		throw new Error(`${label}: did not define ${globalName}`);
	}
	return value;
}

/** Entries that were added, removed or changed between two data objects. */
function diffEntries(oldObj, newObj) {
	const added = [], removed = [], changed = [];
	for (const id in newObj) {
		if (!(id in oldObj)) added.push(id);
		else if (JSON.stringify(oldObj[id]) !== JSON.stringify(newObj[id])) changed.push(id);
	}
	for (const id in oldObj) if (!(id in newObj)) removed.push(id);
	return {added, removed, changed};
}

function preview(ids) {
	return ids.slice(0, 8).join(', ') + (ids.length > 8 ? `, +${ids.length - 8} more` : '');
}

/**
 * Loads a server-repo text file (`export const MovesText: {...} = {...};`)
 * and returns the object.
 */
async function loadVanillaText(filename) {
	const url = `${SOURCES.vanillaTextUrl}/${filename}`;
	let text = await fetchText(url);
	const header = /^export const (\w+)\s*:[^=]*=\s*\{/m;
	const match = header.exec(text);
	if (!match) throw new Error(`${url}: unrecognised format`);
	text = text.replace(header, `exports.${match[1]} = {`);
	return evaluate(text, match[1], url);
}

/**
 * Copies desc/shortDesc into the data, the way the server's Dex does.
 * Upstream writes "1.3×" but the fork's descriptions use "1.3x"; normalise so
 * the dex's Vanilla -> RC comparison doesn't flag every multiplier as a change.
 */
function mergeDescriptions(data, textData) {
	const clean = str => str.replace(/×/g, 'x');
	for (const id in data) {
		const entry = textData[id];
		if (!entry) continue;
		if (entry.shortDesc) data[id].shortDesc = clean(entry.shortDesc);
		const desc = entry.desc || entry.shortDesc;
		if (desc) data[id].desc = clean(desc);
	}
}

function serialize(name, data, isVanilla) {
	let out = `${isVanilla ? 'window' : 'exports'}.${name} = ${JSON.stringify(data, null, 2)};\n`;
	// the dex reads BattlePokedexRaw (tiers, credits, evoRegion)
	if (name === 'BattlePokedex') out += 'exports.BattlePokedexRaw = {...exports.BattlePokedex};\n';
	return out;
}

function writeFile(dest, name, newObj, isVanilla) {
	const text = serialize(name, newObj, isVanilla);

	let oldObj = {};
	const exists = fs.existsSync(dest);
	if (exists) {
		const oldText = fs.readFileSync(dest, 'utf8');
		if (oldText === text) {
			console.log(`  ${dest}: unchanged`);
			return false;
		}
		try {
			oldObj = evaluate(oldText, name, dest);
		} catch (e) {}
	}

	const oldCount = Object.keys(oldObj).length;
	const newCount = Object.keys(newObj).length;
	if (!FORCE && oldCount && newCount < oldCount * 0.9) {
		throw new Error(`${dest}: new version has ${newCount} entries vs ${oldCount} now. ` +
			`Something's probably wrong with the source; rerun with --force if it's intended.`);
	}

	const {added, removed, changed} = diffEntries(oldObj, newObj);
	console.log(`  ${dest}: ${exists ? 'updated' : 'created'} ` +
		`(+${added.length} / -${removed.length} / ~${changed.length})`);
	if (added.length) console.log(`      added:   ${preview(added)}`);
	if (removed.length) console.log(`      removed: ${preview(removed)}`);
	if (changed.length) console.log(`      changed: ${preview(changed)}`);

	if (!DRY_RUN) {
		const tmp = dest + '.tmp';
		fs.writeFileSync(tmp, text);
		fs.renameSync(tmp, dest);
	}
	return true;
}

/**
 * search-index.js defines several globals and is copied as-is. The fork's
 * build-indexes takes article titles from ../dex.pokemonshowdown.com/articles,
 * which on this server is a symlink to the dex; an index without articles means
 * that link is missing, so it's refused rather than wiping the dex's Articles list.
 */
async function syncSearchIndex(dest) {
	const {text, from} = await readFork('search-index.js');
	const sandbox = {};
	sandbox.exports = sandbox;
	vm.runInNewContext(text, sandbox, {filename: from, timeout: 30000});
	const index = sandbox.BattleSearchIndex;
	if (!Array.isArray(index) || !index.length) throw new Error(`${from}: no BattleSearchIndex`);
	const articles = Object.keys(sandbox.BattleArticleTitles || {}).length;
	if (!articles && !FORCE) {
		throw new Error(`${from} has no articles. Make sure /var/www/RC-Showdown/dex.pokemonshowdown.com ` +
			`links to the dex, rebuild the fork client, and try again (or rerun with --force).`);
	}

	const keys = list => new Set(list.map(entry => `${entry[0]} (${entry[1]})`));
	let oldKeys = new Set();
	const exists = fs.existsSync(dest);
	if (exists) {
		const oldText = fs.readFileSync(dest, 'utf8');
		if (oldText === text) {
			console.log(`  ${dest}: unchanged`);
			return false;
		}
		try {
			const old = {};
			old.exports = old;
			vm.runInNewContext(oldText, old);
			oldKeys = keys(old.BattleSearchIndex);
		} catch (e) {}
	}
	const newKeys = keys(index);
	const added = [...newKeys].filter(k => !oldKeys.has(k));
	const removed = [...oldKeys].filter(k => !newKeys.has(k));
	console.log(`  ${dest}: ${exists ? 'updated' : 'created'} ` +
		`(+${added.length} / -${removed.length} entries, ${articles} articles)`);
	if (added.length) console.log(`      added:   ${preview(added)}`);
	if (removed.length) console.log(`      removed: ${preview(removed)}`);

	if (!DRY_RUN) {
		const tmp = dest + '.tmp';
		fs.writeFileSync(tmp, text);
		fs.renameSync(tmp, dest);
	}
	return true;
}

async function main() {
	let changed = 0;
	const failures = [];

	console.log(`Fork data (${fs.existsSync(SOURCES.forkDir) ? SOURCES.forkDir : SOURCES.forkUrl}):`);
	for (const [src, dest, srcGlobal] of FORK_FILES) {
		try {
			const {text, from} = await readFork(src);
			if (writeFile(dest, srcGlobal, evaluate(text, srcGlobal, from), false)) changed++;
		} catch (e) {
			failures.push(e.message);
			console.error(`  ${dest}: FAILED - ${e.message}`);
		}
	}
	try {
		if (await syncSearchIndex('data/search-index.js')) changed++;
	} catch (e) {
		failures.push(e.message);
		console.error(`  data/search-index.js: FAILED - ${e.message}`);
	}

	console.log(`Vanilla data (${SOURCES.vanillaUrl}):`);
	for (const [src, dest, srcGlobal, destGlobal, textFile] of VANILLA_FILES) {
		try {
			const url = `${SOURCES.vanillaUrl}/${src}`;
			const data = evaluate(await fetchText(url), srcGlobal, url);
			if (textFile) mergeDescriptions(data, await loadVanillaText(textFile));
			if (writeFile(dest, destGlobal, data, true)) changed++;
		} catch (e) {
			failures.push(e.message);
			console.error(`  ${dest}: FAILED - ${e.message}`);
		}
	}

	if (DRY_RUN) console.log(`\nDry run: ${changed} file(s) would change.`);
	else console.log(`\n${changed} file(s) updated.`);

	if (changed && !NO_BUILD) {
		console.log('Running ./build...');
		child_process.execFileSync(process.execPath, ['./build'], {stdio: 'inherit'});
	}

	if (failures.length) {
		console.error(`\n${failures.length} file(s) failed; their old versions were kept.`);
		process.exit(1);
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
