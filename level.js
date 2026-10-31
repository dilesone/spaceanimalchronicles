(() => {
    'use strict';

    const TILE = {
        EMPTY: 0, WALL: 1, PLATFORM: 2, BERRY: 3,
        CRYSTAL: 4, NUT: 5, SPIKE: 6, WATER: 7
    };

    const state = {
        loaded: false,
        tileSize: 48,
        width: 0,
        height: 0,
        grid: [],
        playerStart: { x: 0, y: 0 },
        portal: { x: 0, y: 0, w: 96, h: 144, gx: 0, gy: 0, gw: 2, gh: 3 },
        totalBerries: 0,
        totalCrystals: 0,
        totalNuts: 0,
        collected: { berries: 0, crystals: 0, nuts: 0 },
        name: '',
        theme: 'forest',
        terrain: 'ground',
        seed: 0
    };

    const LEVEL_CONFIGS = {
        forest: {
            name: "Лес — Первая высадка",
            theme: "forest",
            difficulty: "normal",
            totalBerries: 6,
            totalCrystals: 4,
            totalNuts: 1,
            seed: 12345,
            terrain: 'ground'
        }
    };

    function load(keyOrUrl) {
        return Promise.resolve().then(() => {
            let config;
            if (keyOrUrl.endsWith('.json')) config = LEVEL_CONFIGS.forest;
            else config = LEVEL_CONFIGS[keyOrUrl] || LEVEL_CONFIGS.forest;
            return generateFromConfig(config);
        });
    }

    function loadRandom(options) {
        return Promise.resolve().then(() => {
            const opts = Object.assign({
                theme: 'forest',
                difficulty: 'normal',
                totalBerries: 6,
                totalCrystals: 4,
                totalNuts: 1,
                seed: Math.floor(Math.random() * 1e9),
                width: 40,
                height: 40,
                terrain: 'ground'
            }, options || {});

            return generateFromConfig(opts);
        });
    }

    function generateFromConfig(config) {
        const result = LevelGenerator.generate({
            theme: config.theme || 'forest',
            seed: config.seed || Math.floor(Math.random() * 1e9),
            difficulty: config.difficulty || 'normal',
            width: config.width || 40,
            height: config.height || 40,
            totalBerries: config.totalBerries || 6,
            totalCrystals: config.totalCrystals || 4,
            totalNuts: config.totalNuts || 1,
            maxAttempts: 20,
            terrain: config.terrain || 'ground'
        });

        state.tileSize = result.tileSize || 48;
        state.width = result.width;
        state.height = result.height;
        state.grid = result.grid;
        state.playerStart = result.playerStart;
        state.portal = normalizePortal(result.portal, state.tileSize);
        state.totalBerries = result.totalBerries;
        state.totalCrystals = result.totalCrystals;
        state.totalNuts = result.totalNuts;
        state.name = config.name || 'Случайный мир';
        
        // ═══ ЖЕСТКАЯ ПРИВЯЗКА ТЕМЫ ═══
        state.theme = config.theme || result.theme || 'forest';
        state.terrain = result.terrain || 'ground';
        state.seed = result.seed;
        state.collected = { berries: 0, crystals: 0, nuts: 0 };
        state.loaded = true;

        return state;
    }

    function normalizePortal(portal, tileSize) {
        const p = {
            gx: portal.gx !== undefined ? portal.gx : Math.floor(portal.x / tileSize),
            gy: portal.gy !== undefined ? portal.gy : Math.floor(portal.y / tileSize),
            gw: portal.gw || 2,
            gh: portal.gh || 3
        };
        p.x = p.gx * tileSize;
        p.y = p.gy * tileSize;
        p.w = p.gw * tileSize;
        p.h = p.gh * tileSize;
        return p;
    }

    function loadFromData(data) {
        return Promise.resolve().then(() => {
            state.tileSize = 48;
            state.width = data.mapWidth || 40;
            state.height = data.mapHeight || 40;

            state.grid = data.grid.map(row =>
                Array.isArray(row) ? row.map(v => v) : row.split('').map(Number)
            );

            if (data.playerStart) {
                state.playerStart = {
                    x: data.playerStart.x !== undefined ? data.playerStart.x : data.playerStart.gx * state.tileSize,
                    y: data.playerStart.y !== undefined ? data.playerStart.y : data.playerStart.gy * state.tileSize
                };
            } else {
                state.playerStart = { x: 200, y: 1600 };
            }

            if (data.portal) {
                state.portal = normalizePortal(data.portal, state.tileSize);
            } else {
                state.portal = normalizePortal({ gx: state.width - 5, gy: 25, gw: 2, gh: 3 }, state.tileSize);
            }

            state.totalBerries = data.totalBerries || 0;
            state.totalCrystals = data.totalCrystals || 0;
            state.totalNuts = data.totalNuts || 0;
            state.name = data.name || 'Пользовательский уровень';
            state.theme = data.theme || 'forest';
            state.terrain = 'editor';
            state.seed = data.seed || 0;
            state.collected = { berries: 0, crystals: 0, nuts: 0 };
            state.loaded = true;

            return state;
        });
    }

    function tileAt(gx, gy) {
        if (gx < 0 || gx >= state.width || gy < 0 || gy >= state.height) return TILE.WALL;
        return state.grid[gy][gx];
    }

    function setTile(gx, gy, type) {
        if (gx >= 0 && gx < state.width && gy >= 0 && gy < state.height) {
            state.grid[gy][gx] = type;
        }
    }

    const isSolid = (gx, gy) => tileAt(gx, gy) === TILE.WALL;
    const isPlatform = (gx, gy) => tileAt(gx, gy) === TILE.PLATFORM;
    const isWater = (gx, gy) => tileAt(gx, gy) === TILE.WATER;
    const isSpike = (gx, gy) => tileAt(gx, gy) === TILE.SPIKE;
    const isBerry = (gx, gy) => tileAt(gx, gy) === TILE.BERRY;
    const isCrystal = (gx, gy) => tileAt(gx, gy) === TILE.CRYSTAL;
    const isNut = (gx, gy) => tileAt(gx, gy) === TILE.NUT;

    const pixelToTile = (px, py) => ({
        gx: Math.floor(px / state.tileSize),
        gy: Math.floor(py / state.tileSize)
    });

    const pixelWidth = () => state.width * state.tileSize;
    const pixelHeight = () => state.height * state.tileSize;

    function collectAt(gx, gy) {
        const t = tileAt(gx, gy);
        let result = null;

        if (t === TILE.BERRY) {
            setTile(gx, gy, TILE.EMPTY);
            state.collected.berries++;
            result = { type: 'berry', total: state.totalBerries, current: state.collected.berries };
        } else if (t === TILE.CRYSTAL) {
            setTile(gx, gy, TILE.EMPTY);
            state.collected.crystals++;
            result = { type: 'crystal', total: state.totalCrystals, current: state.collected.crystals };
        } else if (t === TILE.NUT) {
            setTile(gx, gy, TILE.EMPTY);
            state.collected.nuts++;
            result = { type: 'nut', total: state.totalNuts, current: state.collected.nuts };
        }

        return result;
    }

    function isPortalOpen() {
        const total = state.totalBerries + state.totalCrystals;
        const collected = state.collected.berries + state.collected.crystals;
        if (total === 0) return true;
        return collected >= total / 2;
    }

    window.Level = {
        TILE,
        load,
        loadRandom,
        loadFromData,
        tileAt,
        setTile,
        isSolid,
        isPlatform,
        isWater,
        isSpike,
        isBerry,
        isCrystal,
        isNut,
        pixelToTile,
        pixelWidth,
        pixelHeight,
        collectAt,
        isPortalOpen,
        get state() { return state; },
        get tileSize() { return state.tileSize; },
        get width() { return state.width; },
        get height() { return state.height; },
        get grid() { return state.grid; },
        get playerStart() { return state.playerStart; },
        get portal() { return state.portal; }
    };
})();