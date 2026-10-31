(() => {
    'use strict';

    // ─── Типы тайлов ──────────────────────────────────────
    const TILE = {
        EMPTY: 0,
        WALL: 1,
        PLATFORM: 2,
        BERRY: 3,
        CRYSTAL: 4,
        NUT: 5,
        SPIKE: 6,
        WATER: 7
    };

    // ─── Состояние уровня ─────────────────────────────────
    const state = {
        loaded: false,
        tileSize: 48,
        width: 0,
        height: 0,
        grid: [],
        playerStart: { x: 0, y: 0 },
        portal: { x: 0, y: 0, w: 96, h: 144 },
        totalBerries: 0,
        totalCrystals: 0,
        totalNuts: 0,
        collected: { berries: 0, crystals: 0, nuts: 0 },
        name: '',
        theme: 'forest'
    };

    // ─── RNG с seed (воспроизводимость) ──────────────────
    function mulberry32(seed) {
        return function () {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // ─── Конфиги уровней (без fetch) ─────────────────────
    const LEVEL_CONFIGS = {
        forest: {
            name: "Лес — Первая высадка",
            tileSize: 48,
            mapWidth: 40,
            mapHeight: 40,
            playerStart: { x: 200, y: 1600 },
            portal: { x: 1750, y: 380, w: 96, h: 144 },
            totalBerries: 8,
            totalCrystals: 6,
            totalNuts: 2,
            theme: "forest",
            seed: 12345
        }
    };

    // ─── Загрузка конфига ─────────────────────────────────
    function load(keyOrUrl) {
        return Promise.resolve().then(() => {
            let config;

            if (keyOrUrl.endsWith('.json')) {
                config = LEVEL_CONFIGS.forest;
            } else {
                config = LEVEL_CONFIGS[keyOrUrl] || LEVEL_CONFIGS.forest;
            }

            state.tileSize = config.tileSize;
            state.width = config.mapWidth;
            state.height = config.mapHeight;
            state.playerStart = config.playerStart;
            state.portal = config.portal;
            state.totalBerries = config.totalBerries;
            state.totalCrystals = config.totalCrystals;
            state.totalNuts = config.totalNuts;
            state.name = config.name;
            state.theme = config.theme;

            state.collected = { berries: 0, crystals: 0, nuts: 0 };

            const rng = mulberry32(config.seed);
            state.grid = generateMap(rng);

            state.loaded = true;
            return state;
        });
    }

    // ─── Генерация карты ──────────────────────────────────
    function generateMap(rng) {
        const W = state.width;
        const H = state.height;
        const grid = Array.from({ length: H }, () => Array(W).fill(TILE.EMPTY));

        // 1. Границы
        for (let x = 0; x < W; x++) {
            grid[0][x] = TILE.WALL;
            grid[H - 1][x] = TILE.WALL;
        }
        for (let y = 0; y < H; y++) {
            grid[y][0] = TILE.WALL;
            grid[y][W - 1] = TILE.WALL;
        }

        // 2. Рельеф (холмы + шум)
        const baseGroundY = Math.floor(H * 0.75);
        const heights = [];
        for (let x = 1; x < W - 1; x++) {
            let h = baseGroundY;
            h += Math.floor(Math.sin(x * 0.15) * 4);
            h += Math.floor(Math.sin(x * 0.4) * 2);
            h += Math.floor((rng() - 0.5) * 3);
            h = Math.max(Math.floor(H * 0.55), Math.min(H - 4, h));
            heights[x] = h;
        }

        for (let x = 1; x < W - 1; x++) {
            const top = heights[x];
            for (let y = top; y < H - 1; y++) {
                grid[y][x] = TILE.WALL;
            }
        }

        // 3. Ямы в земле
        const pits = 5 + Math.floor(rng() * 4);
        for (let i = 0; i < pits; i++) {
            const px = 5 + Math.floor(rng() * (W - 15));
            const pw = 2 + Math.floor(rng() * 3);
            const depth = 2 + Math.floor(rng() * 3);
            for (let dx = 0; dx < pw; dx++) {
                const x = px + dx;
                if (x <= 0 || x >= W - 1) continue;
                const top = heights[x];
                for (let dy = 0; dy < depth; dy++) {
                    const y = top + dy;
                    if (y < H - 1) grid[y][x] = TILE.EMPTY;
                }
            }
        }

        // 4. Парящие платформы
        const platforms = 18 + Math.floor(rng() * 8);
        const placedPlatforms = [];
        for (let i = 0; i < platforms; i++) {
            for (let attempt = 0; attempt < 30; attempt++) {
                const px = 4 + Math.floor(rng() * (W - 12));
                const py = Math.floor(H * 0.2) + Math.floor(rng() * Math.floor(H * 0.45));
                const pw = 2 + Math.floor(rng() * 3);

                let overlap = false;
                for (const p of placedPlatforms) {
                    if (Math.abs(p.x - px) < pw + 3 && Math.abs(p.y - py) < 4) {
                        overlap = true; break;
                    }
                }
                if (overlap) continue;

                let ok = true;
                for (let dx = 0; dx < pw; dx++) {
                    if (grid[py][px + dx] !== TILE.EMPTY) { ok = false; break; }
                }
                if (!ok) continue;

                for (let dx = 0; dx < pw; dx++) grid[py][px + dx] = TILE.PLATFORM;
                placedPlatforms.push({ x: px, y: py, w: pw });
                break;
            }
        }

        // 5. Озёра воды
        const lakes = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < lakes; i++) {
            const lx = 10 + Math.floor(rng() * (W - 20));
            const lw = 3 + Math.floor(rng() * 4);
            for (let dx = 0; dx < lw; dx++) {
                const x = lx + dx;
                if (x <= 0 || x >= W - 1) continue;
                const top = heights[x];
                for (let dy = 0; dy < 2; dy++) {
                    const y = top + dy;
                    if (y < H - 1 && grid[y][x] === TILE.WALL) {
                        grid[y][x] = TILE.WATER;
                    }
                }
            }
        }

        // 6. Шипы на земле
        const spikes = 8 + Math.floor(rng() * 6);
        for (let i = 0; i < spikes; i++) {
            const sx = 5 + Math.floor(rng() * (W - 10));
            const top = heights[sx];
            const sy = top - 1;
            if (sy > 0 && grid[sy][sx] === TILE.EMPTY && grid[sy + 1][sx] === TILE.WALL) {
                grid[sy][sx] = TILE.SPIKE;
            }
        }

        // 7. Свободные клетки под ресурсы
        const emptyCells = [];
        for (let y = 1; y < H - 1; y++) {
            for (let x = 1; x < W - 1; x++) {
                if (grid[y][x] === TILE.EMPTY) {
                    if (grid[y + 1] && (grid[y + 1][x] === TILE.WALL || grid[y + 1][x] === TILE.PLATFORM)) {
                        emptyCells.push({ x, y });
                    }
                }
            }
        }

        for (let i = emptyCells.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
        }

        let placed = 0;
        const place = (type, count, minDistFromStart = 4) => {
            for (let i = 0; i < emptyCells.length && placed < count; i++) {
                const c = emptyCells[i];
                if (!c) continue;
                const distX = Math.abs(c.x * state.tileSize - state.playerStart.x) / state.tileSize;
                const distY = Math.abs(c.y * state.tileSize - state.playerStart.y) / state.tileSize;
                if (distX < minDistFromStart && distY < minDistFromStart) continue;

                if (grid[c.y][c.x] === TILE.EMPTY) {
                    grid[c.y][c.x] = type;
                    emptyCells.splice(i, 1);
                    placed++;
                }
            }
        };

        place(TILE.BERRY, state.totalBerries);
        place(TILE.CRYSTAL, state.totalCrystals);
        place(TILE.NUT, state.totalNuts);

        // 8. Портал
        const portalGx = Math.floor(state.portal.x / state.tileSize);
        const portalGy = Math.floor(state.portal.y / state.tileSize);
        for (let dy = 0; dy < 3; dy++) {
            for (let dx = 0; dx < 2; dx++) {
                if (grid[portalGy + dy] && grid[portalGy + dy][portalGx + dx] !== undefined) {
                    grid[portalGy + dy][portalGx + dx] = TILE.EMPTY;
                }
            }
        }

        return grid;
    }

    // ─── Работа с картой ──────────────────────────────────
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

    // ─── Сбор ресурсов ────────────────────────────────────
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
        const totalResources = state.totalBerries + state.totalCrystals;
        const collectedResources = state.collected.berries + state.collected.crystals;
        return collectedResources >= totalResources / 2;
    }

    // ─── Публичный API ────────────────────────────────────
    window.Level = {
        TILE,
        load,
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