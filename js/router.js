var Pokedex = Panels.App.extend({
	topbarView: Topbar,
	backButtonPrefix: '<i class="fa fa-chevron-left"></i> ',
	states2: {
		'pokemon/:pokemon': PokedexPokemonPanel,
		'moves/:move': PokedexMovePanel,
		'items/:item': PokedexItemPanel,
		'abilities/:ability': PokedexAbilityPanel,
		'types/:type': PokedexTypePanel,
		'categories/:category': PokedexCategoryPanel,
		'tags/:tag': PokedexTagPanel,
		'egggroups/:egggroup': PokedexEggGroupPanel,
		'tiers/:tier': PokedexTierPanel,
		'articles/:article': PokedexArticlePanel,
		'rcchanges': PokedexRCChangesPanel,

		'': PokedexSearchPanel,
		'pokemon/': PokedexSearchPanel,
		'moves/': PokedexSearchPanel,
		'articles/': PokedexArticlesPanel,
		':q': PokedexSearchPanel
	},
	buildRCChangeIndex: function() {
		if (window.RCChangeIndexBuilt) return;

		window.RCChangeIndex = {
			pokemon: {},
			moves: {},
			abilities: {},
			items: {}
		};

		// --- Pokémon ---
		for (let id in BattlePokedex) {
			let mon = BattlePokedex[id];
			let vanilla = window.BattlePokedexVanilla?.[id];
			if (!mon || !vanilla) continue;
			if (mon.forme === 'Gmax') continue;

			let changed = false;

			if (JSON.stringify(mon.types) !== JSON.stringify(vanilla.types)) changed = true;
			if (JSON.stringify(mon.abilities) !== JSON.stringify(vanilla.abilities)) changed = true;
			if (JSON.stringify(mon.baseStats) !== JSON.stringify(vanilla.baseStats)) changed = true;

			let rcLearnset = BattleLearnsets[id]?.learnset || {};
			let vanillaLearnset = BattleLearnsetsVanilla[id]?.learnset || {};
			let rcMoves = Object.keys(rcLearnset).sort();
			let vanillaMoves = Object.keys(vanillaLearnset).sort();

			function hasNewMoves(id, mon) {
				function getLearnset(source, id, baseSpecies) {
					return source[id]?.learnset || source[toID(baseSpecies)]?.learnset || {};
				}

				let rcLearnset = getLearnset(BattleLearnsets, id, mon.baseSpecies);
				let vanillaLearnset = getLearnset(BattleLearnsetsVanilla, id, mon.baseSpecies);

				for (let moveid in rcLearnset) {
					if (!vanillaLearnset[moveid]) {
						return true; // ✅ EXACT same condition as your UI
					}
				}
				return false;
			}

			function getGen(num) {
				if (num <= 151) return 1;
				if (num <= 251) return 2;
				if (num <= 386) return 3;
				if (num <= 493) return 4;
				if (num <= 649) return 5;
				if (num <= 721) return 6;
				if (num <= 809) return 7;
				if (num <= 905) return 8;
				return 9;
			}

			if (hasNewMoves(id, mon)) {
				changed = true;
			}

			if (changed) {
				let gen = getGen(mon.num || Dex.species.get(mon.baseSpecies).num);
				(window.RCChangeIndex.pokemon[gen] ??= []).push(id);
			}
		}

		// --- Moves ---
		for (let id in BattleMovedex) {
			let move = BattleMovedex[id];
			let vanilla = window.BattleMovedexVanilla?.[id];
			if (!move || !vanilla) continue;

			if (
				move.basePower !== vanilla.basePower ||
				move.type !== vanilla.type ||
				move.category !== vanilla.category ||
				move.accuracy !== vanilla.accuracy
			) {
				let gen = move.gen || 9;
				(window.RCChangeIndex.moves[gen] ??= []).push(id);
			}
		}

		// --- Abilities ---
		for (let id in BattleAbilities) {
			let a = BattleAbilities[id];
			let v = window.BattleAbilitiesVanilla?.[id];
			if (!a || !v) continue;

			if (a.shortDesc !== v.shortDesc) {
				let gen = a.gen || 9;
				(window.RCChangeIndex.abilities[gen] ??= []).push(id);
			}
		}

		// --- Items ---
		for (let id in BattleItems) {
			let i = BattleItems[id];
			let v = window.BattleItemsVanilla?.[id];
			if (!i || !v) continue;

			if ((i.shortDesc || '') !== (v.shortDesc || '')) {
				let gen = i.gen || 9;
				(window.RCChangeIndex.items[gen] ??= []).push(id);
			}
		}

		window.RCChangeIndexBuilt = true;
		console.log('[RC Dex] Change index built');
	},
	initialize: function() {
		this.buildRCChangeIndex();
		this.routePanel('*path', PokedexSearchPanel); // catch-all default

		for (var i in this.states2) {
			this.routePanel(i, this.states2[i]);
		}
		this.routePanel('rcchanges', PokedexRCChangesPanel);
	}
});
var pokedex = new Pokedex();
