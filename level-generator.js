(() => {
    'use strict';

    const TILE = { EMPTY: 0, WALL: 1, PLATFORM: 2, BERRY: 3, CRYSTAL: 4, NUT: 5, SPIKE: 6, WATER: 7 };

    const DIFFICULTY = {
        easy:   { pits: 3, platforms: 14, lakes: 1, spikes: 3, maxHeight: 5, islands: 2 },
        normal: { pits: 5, platforms: 20, lakes: 2, spikes: 5, maxHeight: 6, islands: 3 },
        hard:   { pits: 7, platforms: 26, lakes: 3, spikes: 7, maxHeight: 6, islands: 4 }
    };

    // Параметры генерации для разных тем
    const THEME_PARAMS = {
        forest:    { baseHeight: 0.7,  hillsFreq: 0.25, hillsAmp: 4, caveCount: 2, waterChance: 0.8 },
        desert:    { baseHeight: 0.6,  hillsFreq: 0.1,  hillsAmp: 2, caveCount: 0, waterChance: 0.1 },
        mountains: { baseHeight: 0.5,  hillsFreq: 0.4,  hillsAmp: 6, caveCount: 3, waterChance: 0.2 },
        dungeon:   { baseHeight: 0.75, hillsFreq: 0.3,  hillsAmp: 3, caveCount: 5, waterChance: 0.4 }
    };

    function mulberry32(seed) {
        return function () {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function canReach(grid, W, H, start, target) {
        const maxJump = 6, maxGap = 4;
        if (!start || !target) return false;
        if (start.x === target.x && start.y === target.y) return true;

        const visited = new Set();
        const queue = [{ x: start.x, y: start.y }];
        visited.add(start.x + ',' + start.y);

        const isSolid = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? true : grid[y][x] === TILE.WALL;
        const isStandable = (x, y) => {
            if (x < 0 || x >= W || y >= H) return false;
            const t = grid[y][x];
            return t === TILE.WALL || t === TILE.PLATFORM;
        };
        const isDangerous = (x, y) => {
            if (x < 0 || x >= W || y < 0 || y >= H) return true;
            return grid[y][x] === TILE.SPIKE || grid[y][x] === TILE.WATER;
        };
        const hasLOS = (x1, y1, x2, y2) => {
            let dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
            let sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
            let err = dx - dy, x = x1, y = y1;
            while (true) {
                if (x === x2 && y === y2) break;
                if (!(x === x1 && y === y1) && !(x === x2 && y === y2)) {
                    if (isSolid(x, y)) return false;
                }
                const e2 = 2 * err;
                if (e2 > -dy) { err -= dy; x += sx; }
                if (e2 < dx) { err += dx; y += sy; }
            }
            return true;
        };

        while (queue.length > 0) {
            const { x, y } = queue.shift();
            if (x === target.x && y === target.y) return true;
            for (let dy = -maxJump; dy <= 4; dy++) {
                for (let dx = -maxGap; dx <= maxGap; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                    if (visited.has(nx + ',' + ny)) continue;
                    if (Math.abs(dx) > maxGap) continue;
                    if (!isStandable(nx, ny + 1)) continue;
                    if (isDangerous(nx, ny)) continue;
                    if (isSolid(nx, ny)) continue;
                    if (!hasLOS(x, y, nx, ny)) continue;
                    visited.add(nx + ',' + ny);
                    queue.push({ x: nx, y: ny });
                }
            }
        }
        return false;
    }

    function floodFillWater(grid, W, H, startX, startY) {
        if (startX <= 0 || startX >= W - 1 || startY <= 0 || startY >= H - 1) return;
        if (grid[startY][startX] !== TILE.EMPTY) return;

        const cells = [], visited = new Set();
        const queue = [{ x: startX, y: startY }];
        visited.add(startX + ',' + startY);

        while (queue.length > 0) {
            const { x, y } = queue.shift();
            cells.push({ x, y });
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const nx = x + dx, ny = y + dy;
                if (nx <= 0 || nx >= W - 1 || ny <= 0 || ny >= H - 1) continue;
                if (visited.has(nx + ',' + ny)) continue;
                if (grid[ny][nx] !== TILE.EMPTY) continue;
                visited.add(nx + ',' + ny);
                queue.push({ x: nx, y: ny });
            }
        }

        let maxY = -Infinity;
        for (const c of cells) if (c.y > maxY) maxY = c.y;
        const minWaterY = Math.max(0, maxY - 4);

        const waterSet = new Set();
        for (const c of cells) {
            if (c.y < minWaterY) continue;
            const below = grid[c.y + 1] ? grid[c.y + 1][c.x] : TILE.WALL;
            if (below === TILE.WALL) waterSet.add(c.x + ',' + c.y);
        }
        let changed = true, iters = 0;
        while (changed && iters < 100) {
            changed = false; iters++;
            for (const c of cells) {
                if (c.y < minWaterY) continue;
                if (waterSet.has(c.x + ',' + c.y)) continue;
                if (waterSet.has(c.x + ',' + (c.y + 1))) {
                    waterSet.add(c.x + ',' + c.y);
                    changed = true;
                }
            }
        }
        for (const key of waterSet) {
            const [x, y] = key.split(',').map(Number);
            grid[y][x] = TILE.WATER;
        }
    }

    function fillBorders(grid, W, H) {
        for (let x = 0; x < W; x++) { grid[0][x] = TILE.WALL; grid[H-1][x] = TILE.WALL; }
        for (let y = 0; y < H; y++) { grid[y][0] = TILE.WALL; grid[y][W-1] = TILE.WALL; }
    }

    function addPlatforms(grid, platforms) {
        for (const p of platforms) {
            for (let dx = 0; dx < p.w; dx++) {
                if (grid[p.y] && grid[p.y][p.x + dx] === TILE.EMPTY) grid[p.y][p.x + dx] = TILE.PLATFORM;
            }
        }
    }

    function placeSpikes(rng, W, H, config, heights, grid) {
        let placed = 0;
        for (let attempt = 0; attempt < 80 && placed < config.spikes; attempt++) {
            const sx = 5 + Math.floor(rng() * (W - 10));
            const top = heights[sx] || H - 5;
            const sy = top - 1;
            if (sy > 0 && grid[sy] && grid[sy][sx] === TILE.EMPTY && grid[sy+1] && grid[sy+1][sx] === TILE.WALL) {
                const leftSolid = sx > 0 && grid[sy][sx-1] === TILE.WALL;
                const rightSolid = sx < W - 1 && grid[sy][sx+1] === TILE.WALL;
                if (leftSolid && rightSolid) continue;
                grid[sy][sx] = TILE.SPIKE;
                placed++;
            }
        }
    }

    function generateGround(rng, W, H, config) {
        const grid = Array.from({ length: H }, () => Array(W).fill(TILE.EMPTY));
        fillBorders(grid, W, H);

        const themeParams = THEME_PARAMS[config.theme] || THEME_PARAMS.forest;

        const baseGroundY = Math.floor(H * (themeParams.baseHeight + rng() * 0.1));
        const freq1 = themeParams.hillsFreq + rng() * 0.1;
        const freq2 = 0.05 + rng() * 0.1;
        const amp1 = themeParams.hillsAmp + Math.floor(rng() * 3);
        const amp2 = 1 + Math.floor(rng() * 2);

        const heights = [];
        for (let x = 1; x < W - 1; x++) {
            let h = baseGroundY;
            h += Math.floor(Math.sin(x * freq1) * amp1);
            h += Math.floor(Math.sin(x * freq2) * amp2);
            h += Math.floor((rng() - 0.5) * 4);
            h = Math.max(Math.floor(H * 0.4), Math.min(H - 5, h));
            heights[x] = h;
        }

        for (let x = 1; x < W - 1; x++) {
            for (let y = heights[x]; y < H - 1; y++) grid[y][x] = TILE.WALL;
        }

        // Пещеры в земле
        const caveCount = Math.floor(rng() * (themeParams.caveCount + 1));
        for (let i = 0; i < caveCount; i++) {
            const cx = 8 + Math.floor(rng() * (W - 16));
            const cy = heights[cx] + 3 + Math.floor(rng() * 8);
            const cw = 2 + Math.floor(rng() * 4);
            for (let dx = 0; dx < cw; dx++) {
                if (cx + dx >= W - 1) break;
                for (let dy = 0; dy < 2; dy++) {
                    if (cy + dy < H - 2 && grid[cy + dy][cx + dx] === TILE.WALL) {
                        grid[cy + dy][cx + dx] = TILE.EMPTY;
                    }
                }
            }
        }

        // Ямы
        const pits = [];
        for (let i = 0; i < config.pits; i++) {
            const px = 6 + Math.floor(rng() * (W - 16));
            const pw = 2 + Math.floor(rng() * 2);
            const depth = 3 + Math.floor(rng() * 3);
            for (let dx = 0; dx < pw; dx++) {
                const x = px + dx;
                if (x <= 0 || x >= W - 1) continue;
                const top = heights[x];
                for (let dy = 0; dy < depth; dy++) {
                    if (top + dy < H - 1) grid[top + dy][x] = TILE.EMPTY;
                }
            }
            pits.push({ x: px, width: pw, top: heights[px] });
        }

        // Платформы
        const platforms = [];
        const platformsCount = config.platforms + Math.floor(rng() * 6);
        for (let i = 0; i < platformsCount; i++) {
            for (let attempt = 0; attempt < 80; attempt++) {
                const px = 3 + Math.floor(rng() * (W - 8));
                const py = 3 + Math.floor(rng() * (heights[px] - 3));
                const pw = 2 + Math.floor(rng() * 3);
                let overlap = false;
                for (const p of platforms) {
                    if (Math.abs(p.x - px) < pw + 2 && Math.abs(p.y - py) < 3) { overlap = true; break; }
                }
                if (overlap) continue;
                let ok = true;
                for (let dx = 0; dx < pw; dx++) {
                    if (grid[py][px + dx] !== TILE.EMPTY) { ok = false; break; }
                }
                if (!ok) continue;
                platforms.push({ x: px, y: py, w: pw });
                break;
            }
        }
        addPlatforms(grid, platforms);

        // Парящие острова
        const islandCount = config.islands || 3;
        for (let i = 0; i < islandCount; i++) {
            for (let attempt = 0; attempt < 40; attempt++) {
                const ix = 5 + Math.floor(rng() * (W - 12));
                const iy = 4 + Math.floor(rng() * Math.floor(H * 0.3));
                const iw = 3 + Math.floor(rng() * 3);

                let ok = true;
                for (let dx = 0; dx < iw; dx++) {
                    if (grid[iy][ix + dx] !== TILE.EMPTY) { ok = false; break; }
                }
                if (!ok) continue;

                const groundTop = heights[ix + Math.floor(iw/2)] || baseGroundY;
                let cy = groundTop - 3;
                const chain = [];
                let chainOk = true;
                while (cy > iy + 1) {
                    const cx = ix + Math.floor(iw / 2);
                    if (grid[cy] && grid[cy][cx] === TILE.WALL) { chainOk = false; break; }
                    chain.push({ x: cx, y: cy });
                    cy -= 4;
                }
                if (!chainOk) continue;

                for (const c of chain) {
                    if (grid[c.y] && grid[c.y][c.x] === TILE.EMPTY) grid[c.y][c.x] = TILE.PLATFORM;
                }
                for (let dx = 0; dx < iw; dx++) {
                    if (grid[iy][ix + dx] === TILE.EMPTY) grid[iy][ix + dx] = TILE.PLATFORM;
                }
                break;
            }
        }

        // Вода
        for (let i = 0; i < config.lakes && i < pits.length; i++) {
            if (rng() > themeParams.waterChance) continue;
            const pit = pits[i];
            let bottomY = -1;
            for (let y = H - 2; y > 0; y--) {
                if (grid[y][pit.x] === TILE.EMPTY && grid[y+1] && grid[y+1][pit.x] === TILE.WALL) {
                    bottomY = y; break;
                }
            }
            if (bottomY !== -1) floodFillWater(grid, W, H, pit.x, bottomY);
        }

        placeSpikes(rng, W, H, config, heights, grid);

        // Портал
        let portalGx = W - 5, portalGy = -1;
        for (let x = W - 5; x > W - 15; x--) {
            if (heights[x] === undefined) continue;
            const top = heights[x];
            let ok = true;
            for (let dy = 1; dy <= 4; dy++) {
                if (grid[top - dy] && grid[top - dy][x] !== TILE.EMPTY) { ok = false; break; }
            }
            if (ok) { portalGx = x; portalGy = top - 3; break; }
        }
        if (portalGy === -1) {
            portalGx = W - 5;
            portalGy = (heights[W - 5] || (H - 5)) - 3;
        }

        return { grid, heights, startX: 3, startY: heights[3] - 1, portalX: portalGx, portalY: portalGy };
    }
    // ═══════════════ ТИП 2: АРХИПЕЛАГ ═══════════════
    function generateIslands(rng, W, H, config) {
        const grid = Array.from({ length: H }, () => Array(W).fill(TILE.EMPTY));
        fillBorders(grid, W, H);

        const seaLevel = Math.floor(H * 0.65);

        for (let x = 1; x < W - 1; x++) {
            for (let y = seaLevel; y < H - 1; y++) grid[y][x] = TILE.WATER;
        }

        const islands = [];
        const islandCount = 5 + Math.floor(rng() * 3);
        const startIsland = { x: 3, width: 5, top: seaLevel - 2 };
        islands.push(startIsland);
        const endIsland = { x: W - 7, width: 5, top: seaLevel - 2 };
        islands.push(endIsland);

        let attempts = 0;
        while (islands.length < islandCount && attempts < 80) {
            attempts++;
            const iw = 3 + Math.floor(rng() * 4);
            const ix = 10 + Math.floor(rng() * (W - 22));
            const topY = seaLevel - 1 - Math.floor(rng() * 4);
            let overlap = false;
            for (const isl of islands) {
                if (Math.abs(isl.x + isl.width / 2 - (ix + iw / 2)) < (isl.width + iw) / 2 + 2) {
                    overlap = true; break;
                }
            }
            if (overlap) continue;
            islands.push({ x: ix, width: iw, top: topY });
        }

        for (const isl of islands) {
            for (let x = isl.x; x < isl.x + isl.width; x++) {
                if (x <= 0 || x >= W - 1) continue;
                for (let y = isl.top; y < seaLevel; y++) grid[y][x] = TILE.WALL;
                for (let y = isl.top; y < H - 1; y++) {
                    if (grid[y][x] === TILE.WATER) break;
                    grid[y][x] = TILE.WALL;
                }
            }
        }

        const platforms = [];
        for (let i = 0; i < config.platforms; i++) {
            for (let attempt = 0; attempt < 40; attempt++) {
                const px = 3 + Math.floor(rng() * (W - 10));
                const py = Math.max(3, seaLevel - 4 - Math.floor(rng() * config.maxHeight));
                const pw = 2 + Math.floor(rng() * 2);
                let overlap = false;
                for (const p of platforms) {
                    if (Math.abs(p.x - px) < pw + 2 && Math.abs(p.y - py) < 2) { overlap = true; break; }
                }
                if (overlap) continue;
                let ok = true;
                for (let dx = 0; dx < pw; dx++) {
                    if (grid[py][px + dx] !== TILE.EMPTY) { ok = false; break; }
                }
                if (!ok) continue;
                platforms.push({ x: px, y: py, w: pw });
                break;
            }
        }
        addPlatforms(grid, platforms);

        const portalGx = endIsland.x + Math.floor(endIsland.width / 2);
        const portalGy = endIsland.top - 2;

        return {
            grid, heights: islands.map(i => i.top),
            startX: startIsland.x + 1, startY: startIsland.top - 1,
            portalX: portalGx, portalY: portalGy
        };
    }

    // ═══════════════ ТИП 3: ПЕЩЕРЫ ═══════════════
    function generateCaves(rng, W, H, config) {
        const grid = Array.from({ length: H }, () => Array(W).fill(TILE.WALL));
        fillBorders(grid, W, H);

        const worms = 5 + Math.floor(rng() * 3);
        const startPositions = [];

        for (let i = 0; i < worms; i++) {
            let x = 3 + Math.floor(rng() * (W - 6));
            let y = 3 + Math.floor(rng() * (H - 8));
            const length = 50 + Math.floor(rng() * 40);
            startPositions.push({ x, y });

            for (let step = 0; step < length; step++) {
                if (x <= 1 || x >= W - 2 || y <= 1 || y >= H - 4) break;
                for (let dy = -1; dy <= 1; dy++)
                    for (let dx = -1; dx <= 1; dx++)
                        if (x + dx > 0 && x + dx < W - 1 && y + dy > 0 && y + dy < H - 1)
                            grid[y + dy][x + dx] = TILE.EMPTY;
                const dir = Math.floor(rng() * 4);
                if (dir === 0) x++;
                else if (dir === 1) y++;
                else if (dir === 2) x--;
                else y--;
            }
        }

        for (let x = 1; x < W - 1; x++) grid[H - 2][x] = TILE.WALL;

        const platforms = [];
        for (let i = 0; i < config.platforms; i++) {
            for (let attempt = 0; attempt < 40; attempt++) {
                const px = 3 + Math.floor(rng() * (W - 10));
                const py = 3 + Math.floor(rng() * (H - 8));
                const pw = 2 + Math.floor(rng() * 2);
                let ok = true;
                for (let dx = 0; dx < pw; dx++) {
                    if (grid[py][px + dx] !== TILE.EMPTY) { ok = false; break; }
                }
                if (!ok) continue;
                platforms.push({ x: px, y: py, w: pw });
                break;
            }
        }
        addPlatforms(grid, platforms);

        for (let x = 1; x < W - 1; x++) {
            if (grid[H - 3][x] === TILE.EMPTY) floodFillWater(grid, W, H, x, H - 3);
        }

        const start = startPositions[0] || { x: 3, y: 10 };
        const portal = startPositions[startPositions.length - 1] || { x: W - 5, y: 10 };

        for (let dy = 0; dy < 4; dy++) {
            for (let dx = 0; dx < 3; dx++) {
                if (grid[portal.y + dy] && grid[portal.y + dy][portal.x + dx] !== undefined) {
                    grid[portal.y + dy][portal.x + dx] = TILE.EMPTY;
                }
            }
        }
        for (let dx = 0; dx < 3; dx++) {
            if (grid[portal.y + 4] && grid[portal.y + 4][portal.x + dx] !== undefined) {
                grid[portal.y + 4][portal.x + dx] = TILE.WALL;
            }
        }

        return {
            grid, heights: [10, 20, 30],
            startX: start.x, startY: start.y,
            portalX: portal.x, portalY: portal.y
        };
    }

    // ═══════════════ ГЛАВНЫЙ ГЕНЕРАТОР ═══════════════
    function generate(options) {
        const config = Object.assign({
            theme: 'forest',
            seed: Math.floor(Math.random() * 1e9),
            difficulty: 'normal',
            width: 40,
            height: 40,
            maxAttempts: 20,
            totalBerries: 6,
            totalCrystals: 4,
            totalNuts: 1,
            terrain: 'ground'
        }, options || {});

        const W = config.width;
        const H = config.height;
        const diff = DIFFICULTY[config.difficulty] || DIFFICULTY.normal;
        const tileSize = 48;

        let bestResult = null;

        for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
            const rng = mulberry32(config.seed + attempt);
            let result;

            if (config.terrain === 'islands') result = generateIslands(rng, W, H, diff);
            else if (config.terrain === 'caves') result = generateCaves(rng, W, H, diff);
            else result = generateGround(rng, W, H, { ...diff, theme: config.theme });

            const grid = result.grid;

            let platformCount = 0;
            for (let y = 0; y < H; y++)
                for (let x = 0; x < W; x++)
                    if (grid[y][x] === TILE.PLATFORM) platformCount++;
            if (platformCount < 10) continue;

            const startGx = result.startX || 3;
            const startGy = result.startY || (result.heights[startGx] ? result.heights[startGx] - 1 : 10);
            const playerStart = { x: startGx * tileSize, y: startGy * tileSize };

            const portalGx = result.portalX || (W - 5);
            const portalGy = result.portalY || (result.heights[portalGx] ? result.heights[portalGx] - 3 : 10);
            const portal = {
                gx: portalGx, gy: portalGy, gw: 2, gh: 3,
                x: portalGx * tileSize, y: portalGy * tileSize,
                w: 2 * tileSize, h: 3 * tileSize
            };

            for (let dy = 0; dy < 4; dy++)
                for (let dx = 0; dx < 3; dx++)
                    if (grid[portalGy + dy] && grid[portalGy + dy][portalGx + dx] !== undefined)
                        grid[portalGy + dy][portalGx + dx] = TILE.EMPTY;
            for (let dx = 0; dx < 3; dx++)
                if (grid[portalGy + 3] && grid[portalGy + 3][portalGx + dx] !== undefined)
                    grid[portalGy + 3][portalGx + dx] = TILE.WALL;

            const startCell = { x: startGx, y: startGy };

            let startExits = 0;
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[-1,1],[1,1]]) {
                if (canReach(grid, W, H, startCell, { x: startGx + dx, y: startGy + dy })) startExits++;
            }
            if (startExits < 2) continue;

            const portalCell = { x: portalGx + 1, y: portalGy + 2 };
            if (!canReach(grid, W, H, startCell, portalCell)) continue;

            // ═══════════════ РАССТАНОВКА РЕСУРСОВ ═══════════════
            const freeCells = [];
            const groundCells = [];
            const platformCells = [];

            for (let y = 1; y < H - 1; y++) {
                for (let x = 1; x < W - 1; x++) {
                    if (grid[y][x] !== TILE.EMPTY) continue;
                    
                    freeCells.push({ x, y });
                    
                    if (grid[y + 1] && grid[y + 1][x] === TILE.WALL) {
                        groundCells.push({ x, y });
                    }
                    if (grid[y + 1] && grid[y + 1][x] === TILE.PLATFORM) {
                        platformCells.push({ x, y });
                    }
                }
            }

            const shuffle = (arr) => {
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(rng() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                return arr;
            };
            
            shuffle(freeCells);
            shuffle(groundCells);
            shuffle(platformCells);

            const reachableGround = groundCells.filter(c => canReach(grid, W, H, startCell, c));
            const reachablePlatforms = platformCells.filter(c => canReach(grid, W, H, startCell, c));

            // Объединяем платформы и землю в один общий пул и перемешиваем
            const allValidCells = reachableGround.concat(reachablePlatforms);
            shuffle(allValidCells);

            let berries = 0, crystals = 0, nutPos = null;

            const placeItem = (x, y, type) => {
                if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) return false;
                if (grid[y][x] !== TILE.EMPTY) return false;
                if (!canReach(grid, W, H, startCell, { x, y })) return false;
                grid[y][x] = type;
                return true;
            };

            // 1. Рандомно ставим ягоды (и на землю, и на платформы)
            for (const c of allValidCells) {
                if (berries >= config.totalBerries) break;
                if (placeItem(c.x, c.y, TILE.BERRY)) berries++;
            }

            // 2. Рандомно ставим кристаллы
            for (const c of allValidCells) {
                if (crystals >= config.totalCrystals) break;
                if (grid[c.y][c.x] === TILE.EMPTY) {
                    if (placeItem(c.x, c.y, TILE.CRYSTAL)) crystals++;
                }
            }

            // 3. Ставим орех (подальше от старта)
            const nutCandidates = allValidCells.filter(c => {
                if (grid[c.y][c.x] !== TILE.EMPTY) return false;
                const distToStart = Math.abs(c.x - startGx) + Math.abs(c.y - startGy);
                return distToStart > 15;
            });
            
            for (const c of nutCandidates) {
                if (placeItem(c.x, c.y, TILE.NUT)) { nutPos = c; break; }
            }
            if (!nutPos && config.totalNuts > 0) {
                for (const c of allValidCells) {
                    if (grid[c.y][c.x] === TILE.EMPTY) {
                        if (placeItem(c.x, c.y, TILE.NUT)) { nutPos = c; break; }
                    }
                }
            }

            if (berries < config.totalBerries || crystals < config.totalCrystals ||
                (config.totalNuts > 0 && !nutPos)) continue;

    // ═══════════════ FALLBACK ═══════════════
    function fallbackLevel(config) {
        const W = config.width || 40;
        const H = config.height || 40;
        const tileSize = 48;
        const grid = Array.from({ length: H }, () => Array(W).fill(TILE.EMPTY));
        fillBorders(grid, W, H);

        const baseY = Math.floor(H * 0.75);
        const heights = [];
        for (let x = 1; x < W - 1; x++) {
            let h = baseY + Math.floor(Math.sin(x * 0.3) * 3);
            h = Math.max(Math.floor(H * 0.6), Math.min(H - 5, h));
            heights[x] = h;
        }
        for (let x = 1; x < W - 1; x++)
            for (let y = heights[x]; y < H - 1; y++)
                grid[y][x] = TILE.WALL;

        const platforms = [];
        for (let i = 0; i < 16; i++) {
            const px = 3 + Math.floor(Math.random() * (W - 8));
            const py = 4 + Math.floor(Math.random() * (baseY - 8));
            const pw = 2 + Math.floor(Math.random() * 2);
            platforms.push({ x: px, y: py, w: pw });
        }
        addPlatforms(grid, platforms);

        for (let i = 0; i < 4; i++) {
            const px = 6 + Math.floor(Math.random() * (W - 12));
            const pw = 2;
            for (let dx = 0; dx < pw; dx++) {
                const x = px + dx;
                const top = heights[x];
                for (let dy = 0; dy < 3; dy++) grid[top + dy][x] = TILE.EMPTY;
            }
        }

        const startGx = 3;
        const startGy = heights[3] - 1;
        const portalGx = W - 5;
        const portalGy = heights[W - 5] - 3;

        for (let dx = 0; dx < 3; dx++) grid[heights[portalGx] || (H - 5)][portalGx + dx] = TILE.WALL;

        const step = Math.floor((W - 10) / (config.totalBerries + config.totalCrystals + config.totalNuts + 1));
        let placedB = 0, placedC = 0, placedN = 0;
        for (let x = startGx + 4; x < portalGx - 3; x += step) {
            if (grid[heights[x] - 1] && grid[heights[x] - 1][x] === TILE.EMPTY) {
                if (placedB < config.totalBerries) { grid[heights[x] - 1][x] = TILE.BERRY; placedB++; }
                else if (placedC < config.totalCrystals) { grid[heights[x] - 1][x] = TILE.CRYSTAL; placedC++; }
                else if (placedN < config.totalNuts) { grid[heights[x] - 1][x] = TILE.NUT; placedN++; }
            }
        }

        return {
            grid, playerStart: { x: startGx * tileSize, y: startGy * tileSize },
            portal: { gx: portalGx, gy: portalGy, gw: 2, gh: 3,
                x: portalGx * tileSize, y: portalGy * tileSize, w: 2 * tileSize, h: 3 * tileSize },
            totalBerries: placedB, totalCrystals: placedC,
            totalNuts: placedN, theme: config.theme, seed: config.seed,
            width: W, height: H, tileSize, terrain: 'ground', isFallback: true
        };
    }

    window.LevelGenerator = { TILE, DIFFICULTY, generate, canReach, mulberry32 };
})();    
