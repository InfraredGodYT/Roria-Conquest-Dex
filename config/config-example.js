exports.routes = {
    root: 'pokemonshowdown.com',
    client: 'play.pokemonshowdown.com',
    replays: 'replay.pokemonshowdown.com',
};

// Where `node sync-data.js` pulls data from. All optional; these are the defaults.
exports.dataSources = {
    // the fork client's built data dir on this machine (used if it exists)
    forkDir: '/var/www/RC-Showdown/client/play.pokemonshowdown.com/data',
    // fallback if forkDir doesn't exist
    forkUrl: 'https://play.pbblegacy.com/data',
    vanillaUrl: 'https://play.pokemonshowdown.com/data',
};
