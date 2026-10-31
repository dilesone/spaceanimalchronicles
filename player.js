(() => {
    'use strict';

    const PHYS = {
        W: 36, H: 36,
        GRAV: 0.85, MAX_FALL: 18,
        ACCEL: 0.9, MAX_SPEED: 5.0,
        FRICTION_GROUND: 0.78, FRICTION_AIR: 0.94,
        JUMP_BASE: -12.5, JUMP_HOLD: -0.35, JUMP_CUT: 0.45,
        MAX_JUMPS: 2, COYOTE: 7, JUMP_BUFFER: 8,
        DASH_SPEED: 13, DASH_TIME: 9, DASH_COOLDOWN: 50,
        INVULN: 60,
        WATER_DRAG: 0.85,
        WATER_GRAV: 0.4,
        WATER_JUMP: -7,
        WATER_MAX_FALL: 4
    };

    const p = {
        x: 80, y: 600, vx: 0, vy: 0,
        onGround: false, facing: 1,
        jumpsLeft: 2, coyote: 0, jumpBuffer: 0, jumpHeld: false,
        dashTime: 0, dashCooldown: 0, dashDirX: 0,
        invuln: 0, touchWall: 0,
        squash: 1, skew: 0, skewDir: 0, skewTimer: 0,
        flipAngle: 0, flipSpeed: 0, flipDir: 1,
        inWater: false,
        hasNut: false,
        lives: 3,
        maxLives: 3,
        nickname: ''
    };

    // ─── Ник ──────────────────────────────────────────────
    function loadNickname() {
        try {
            const saved = localStorage.getItem('kz_nickname');
            if (saved && saved.trim()) {
                p.nickname = saved.trim();
            } else {
                p.nickname = 'Игрок';
            }
        } catch (e) {
            p.nickname = 'Игрок';
        }
    }
    loadNickname();

    const keys = { left: false, right: false, jump: false, dash: false };

    function bindKeys() {
        window.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT') return;
            const k = e.key.toLowerCase();
            if (['arrowleft', 'a', 'ф'].includes(k)) keys.left = true;
            if (['arrowright', 'd', 'в'].includes(k)) keys.right = true;
            if (['arrowup', 'w', 'ц', ' '].includes(k)) { keys.jump = true; e.preventDefault(); }
            if (['shift', 'k', 'л'].includes(k)) keys.dash = true;
        });
        window.addEventListener('keyup', e => {
            if (e.target.tagName === 'INPUT') return;
            const k = e.key.toLowerCase();
            if (['arrowleft', 'a', 'ф'].includes(k)) keys.left = false;
            if (['arrowright', 'd', 'в'].includes(k)) keys.right = false;
            if (['arrowup', 'w', 'ц', ' '].includes(k)) keys.jump = false;
            if (['shift', 'k', 'л'].includes(k)) keys.dash = false;
        });
    }

    function collideX(dx) {
        p.x += dx;
        p.touchWall = 0;
        const T = Level.tileSize;
        const top = Math.floor(p.y / T);
        const bottom = Math.floor((p.y + PHYS.H - 1) / T);

        if (dx > 0) {
            const right = Math.floor((p.x + PHYS.W - 1) / T);
            for (let gy = top; gy <= bottom; gy++) {
                if (Level.isSolid(right, gy)) {
                    p.x = right * T - PHYS.W;
                    p.vx = 0; p.touchWall = 1; return;
                }
            }
        } else if (dx < 0) {
            const left = Math.floor(p.x / T);
            for (let gy = top; gy <= bottom; gy++) {
                if (Level.isSolid(left, gy)) {
                    p.x = (left + 1) * T;
                    p.vx = 0; p.touchWall = -1; return;
                }
            }
        }
    }

    function collideY(dy) {
        p.y += dy;
        p.onGround = false;
        const T = Level.tileSize;
        const left = Math.floor(p.x / T);
        const right = Math.floor((p.x + PHYS.W - 1) / T);

        if (dy > 0) {
            const bottom = Math.floor((p.y + PHYS.H - 1) / T);
            for (let gx = left; gx <= right; gx++) {
                if (Level.isSolid(gx, bottom)) {
                    p.y = bottom * T - PHYS.H;
                    p.vy = 0; p.onGround = true; return;
                }
                if (Level.isPlatform(gx, bottom) && p.vy > 0) {
                    const platTop = bottom * T;
                    const prevBottom = p.y - dy + PHYS.H;
                    if (prevBottom > platTop + 6) continue;
                    p.y = platTop - PHYS.H;
                    p.vy = 0; p.onGround = true; return;
                }
            }
        } else if (dy < 0) {
            const top = Math.floor(p.y / T);
            for (let gx = left; gx <= right; gx++) {
                if (Level.isSolid(gx, top)) {
                    p.y = (top + 1) * T;
                    p.vy = 0; return;
                }
            }
        }
    }

    function takeDamage(sourceX) {
        if (p.invuln > 0) return;
        p.lives--;
        p.invuln = 90;

        const dir = (p.x + PHYS.W / 2) < sourceX ? -1 : 1;
        p.vx = dir * 8;
        p.vy = -9;

        if (window.Audio) Audio.play(180, 0.2, 'sawtooth', 0.15);
        if (window.Particles) {
            Particles.spawn(p.x + PHYS.W / 2, p.y + PHYS.H / 2, '#ff5050', 15, 5);
        }

        if (p.lives <= 0) {
            setTimeout(() => { respawn(); }, 500);
        }
    }

    function respawn() {
        p.x = Level.playerStart.x;
        p.y = Level.playerStart.y;
        p.vx = 0; p.vy = 0;
        p.invuln = PHYS.INVULN;
        p.hasNut = false;
        p.lives = p.maxLives;
        if (window.Audio) Audio.play(120, 0.4, 'sawtooth', 0.15);
        if (window.Particles) {
            Particles.spawn(p.x + PHYS.W / 2, p.y + PHYS.H / 2, '#ff5050', 25, 6);
        }
    }

    function checkHazards() {
        const T = Level.tileSize;
        const centerX = Math.floor((p.x + PHYS.W / 2) / T);
        const centerY = Math.floor((p.y + PHYS.H / 2) / T);
        const feetX = Math.floor((p.x + PHYS.W / 2) / T);
        const feetY = Math.floor((p.y + PHYS.H - 1) / T);

        if (p.invuln <= 0) {
            if (Level.isSpike(centerX, centerY)) {
                takeDamage(centerX * T + T / 2);
                return;
            }
            if (Level.isSpike(feetX, feetY)) {
                takeDamage(feetX * T + T / 2);
                return;
            }
        }

        p.inWater = Level.isWater(centerX, centerY);
    }

    function update() {
        if (p.dashCooldown > 0) p.dashCooldown--;
        if (p.invuln > 0) p.invuln--;

        checkHazards();

        const friction = p.inWater ? PHYS.WATER_DRAG : (p.onGround ? PHYS.FRICTION_GROUND : PHYS.FRICTION_AIR);
        if (keys.left)  { p.vx -= PHYS.ACCEL; p.facing = -1; }
        if (keys.right) { p.vx += PHYS.ACCEL; p.facing = 1; }
        if (!keys.left && !keys.right) p.vx *= friction;
        p.vx = Math.max(-PHYS.MAX_SPEED, Math.min(PHYS.MAX_SPEED, p.vx));

        const moveDir = p.vx > 0.5 ? 1 : p.vx < -0.5 ? -1 : 0;
        if (moveDir !== 0 && moveDir !== p.skewDir) { p.skewDir = moveDir; p.skewTimer = 30; }
        if (p.skewTimer > 0) {
            p.skewTimer--;
            const progress = 1 - (p.skewTimer / 30);
            const target = p.skewDir * 0.25 * Math.sin(progress * Math.PI);
            p.skew += (target - p.skew) * 0.35;
        } else {
            p.skew += (0 - p.skew) * 0.25;
        }

        if (p.flipSpeed !== 0) {
            p.flipAngle += Math.abs(p.flipSpeed);
            if (p.flipAngle >= Math.PI * 2 - 0.01) { p.flipAngle = 0; p.flipSpeed = 0; }
        }

        if (keys.dash && p.dashCooldown === 0 && p.dashTime === 0) {
            p.dashDirX = keys.left ? -1 : keys.right ? 1 : p.facing;
            p.dashTime = PHYS.DASH_TIME;
            p.dashCooldown = PHYS.DASH_COOLDOWN;
            p.invuln = Math.max(p.invuln, PHYS.DASH_TIME);
            if (window.Particles) Particles.spawn(p.x + 18, p.y + 18, '#a855f7', 8, 3);
        }
        if (p.dashTime > 0) {
            p.vx = p.dashDirX * PHYS.DASH_SPEED;
            p.vy = 0; p.dashTime--;
        }

        if (p.onGround) p.coyote = PHYS.COYOTE;
        else if (p.coyote > 0) p.coyote--;

        if (keys.jump && !p.jumpHeld) p.jumpBuffer = PHYS.JUMP_BUFFER;
        else if (p.jumpBuffer > 0) p.jumpBuffer--;
        p.jumpHeld = keys.jump;

        const wantJump = p.jumpBuffer > 0;

        const jumpPower = p.inWater ? PHYS.WATER_JUMP : PHYS.JUMP_BASE;
        if (wantJump && (p.onGround || p.coyote > 0 || p.inWater)) {
            p.vy = jumpPower;
            p.onGround = false; p.coyote = 0;
            p.jumpsLeft = 1; p.jumpBuffer = 0;
            p.squash = 1.25;
            if (window.Audio) Audio.play(440, 0.1, 'square');
        } else if (wantJump && p.jumpsLeft > 0 && !p.inWater) {
            p.vy = PHYS.JUMP_BASE * 0.95;
            p.jumpsLeft--; p.jumpBuffer = 0;
            p.squash = 1.2;
            p.flipAngle = 0; p.flipSpeed = 0.28; p.flipDir = p.facing;
            if (window.Particles) Particles.spawn(p.x + 18, p.y + 36, '#a855f7', 8, 3);
            if (window.Audio) Audio.play(520, 0.08, 'square');
        }

        p.squash += (1 - p.squash) * 0.2;

        if (!keys.jump && p.vy < 0) p.vy *= PHYS.JUMP_CUT;
        if (keys.jump && p.vy < 0) p.vy -= 0.35;

        if (p.inWater) {
            p.vy = Math.min(p.vy + PHYS.GRAV * PHYS.WATER_GRAV, PHYS.WATER_MAX_FALL);
        } else {
            p.vy = Math.min(p.vy + PHYS.GRAV, PHYS.MAX_FALL);
        }

        collideX(p.vx);
        collideY(p.vy);

        if (p.onGround) p.jumpsLeft = 2;

        p.x = Math.max(0, Math.min(Level.pixelWidth() - PHYS.W, p.x));
        if (p.y > Level.pixelHeight() + 200) respawn();
    }

    function draw(ctx) {
        const px = p.x, py = p.y;
        const cx = px + PHYS.W / 2;
        const cy = py + PHYS.H / 2;

        if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) ctx.globalAlpha = 0.4;

        const glowRadius = 60;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        if (p.inWater) {
            glow.addColorStop(0, 'rgba(100, 200, 255, 0.3)');
            glow.addColorStop(1, 'rgba(100, 200, 255, 0)');
        } else {
            glow.addColorStop(0, 'rgba(255, 200, 50, 0.25)');
            glow.addColorStop(1, 'rgba(255, 200, 50, 0)');
        }
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2); ctx.fill();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(2 - p.squash, p.squash);
        ctx.transform(1, 0, p.skew, 1, 0, 0);
        if (p.flipSpeed !== 0 || p.flipAngle !== 0) {
            ctx.rotate(p.flipAngle * p.flipDir);
        }
        ctx.translate(-cx, -cy);

        const grad = ctx.createLinearGradient(px, py, px + PHYS.W, py + PHYS.H);
        if (p.inWater) {
            grad.addColorStop(0, '#6ac8ff');
            grad.addColorStop(0.5, '#3a9dd6');
            grad.addColorStop(1, '#2060a0');
        } else {
            grad.addColorStop(0, '#ffd84a');
            grad.addColorStop(0.5, '#ffb050');
            grad.addColorStop(1, '#ff6b9d');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(px, py, PHYS.W, PHYS.H);

        ctx.fillStyle = p.inWater ? '#6ac8ff' : '#ffd84a';
        ctx.beginPath();
        ctx.ellipse(px + 9, py - 10, 4, 12, -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(px + PHYS.W - 9, py - 10, 4, 12, 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(26, 26, 46, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, PHYS.W - 2, PHYS.H - 2);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(px + 3, py + 3, PHYS.W - 6, 6);

        const eyeY = py + PHYS.H * 0.35;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(px + PHYS.W * 0.3, eyeY, PHYS.W * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + PHYS.W * 0.7, eyeY, PHYS.W * 0.18, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#1a1a2e';
        const pupilX = p.facing * 3;
        const pupilY = Math.max(-2, Math.min(2, p.vy * 0.3));
        ctx.beginPath(); ctx.arc(px + PHYS.W * 0.3 + pupilX, eyeY + pupilY, PHYS.W * 0.09, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + PHYS.W * 0.7 + pupilX, eyeY + pupilY, PHYS.W * 0.09, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = p.inWater ? 'rgba(100, 180, 255, 0.4)' : 'rgba(255, 100, 150, 0.4)';
        ctx.beginPath(); ctx.arc(px + PHYS.W * 0.2, py + PHYS.H * 0.7, PHYS.W * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + PHYS.W * 0.8, py + PHYS.H * 0.7, PHYS.W * 0.1, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (p.vy > 5) {
            ctx.arc(px + PHYS.W * 0.5, py + PHYS.H * 0.68, PHYS.W * 0.12, 0, Math.PI * 2);
        } else {
            ctx.arc(px + PHYS.W * 0.5, py + PHYS.H * 0.58, PHYS.W * 0.15, 0.2, Math.PI - 0.2);
        }
        ctx.stroke();

        if (p.hasNut) {
            const nutY = py - 20;
            const bob = Math.sin(performance.now() * 0.005) * 2;
            ctx.fillStyle = '#8b5a2b';
            ctx.beginPath();
            ctx.ellipse(cx, nutY + bob, 12, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#5a3a1b';
            ctx.beginPath();
            ctx.ellipse(cx, nutY - 6 + bob, 12, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 220, 180, 0.6)';
            ctx.beginPath();
            ctx.arc(cx - 4, nutY + bob, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // ─── НИК НАД ГОЛОВОЙ ─────────────────────────────
        if (p.nickname) {
            ctx.save();
            ctx.font = 'bold 14px "Caveat", cursive';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const nickY = py - (p.hasNut ? 48 : 34);

            // Свечение/тень для читаемости
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 6;

            // Фон-плашка (полупрозрачная, минимальная)
            const metrics = ctx.measureText(p.nickname);
            const textW = metrics.width;
            const padX = 8;
            const padY = 3;
            ctx.fillStyle = 'rgba(10, 10, 25, 0.7)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(cx - textW / 2 - padX, nickY - 9 - padY, textW + padX * 2, 18 + padY * 2, 6);
            } else {
                ctx.rect(cx - textW / 2 - padX, nickY - 9 - padY, textW + padX * 2, 18 + padY * 2);
            }
            ctx.fill();

            ctx.fillStyle = '#d0e0ff';
            ctx.fillText(p.nickname, cx, nickY);
            ctx.restore();
        }

        // Индикатор прыжков
        for (let i = 0; i < 2; i++) {
            ctx.globalAlpha = i < p.jumpsLeft ? 0.9 : 0.2;
            ctx.fillStyle = '#00e676';
            ctx.beginPath();
            ctx.arc(px + 10 + i * 14, py - 28, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    window.Player = {
        PHYS,
        state: p,
        keys,
        bindKeys,
        update,
        draw,
        respawn,
        takeDamage,
        reloadNickname: loadNickname
    };
})();