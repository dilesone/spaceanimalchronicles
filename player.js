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

    class Player {
        constructor(id, isLocal) {
            this.id = id;
            this.isLocal = isLocal;
            
            this.x = 80; this.y = 600;
            this.vx = 0; this.vy = 0;
            this.onGround = false;
            this.facing = 1;
            
            this.jumpsLeft = 2;
            this.coyote = 0;
            this.jumpBuffer = 0;
            this.jumpHeld = false;
            
            this.dashTime = 0;
            this.dashCooldown = 0;
            this.dashDirX = 0;
            
            this.invuln = 0;
            this.touchWall = 0;
            
            this.squash = 1;
            this.skew = 0;
            this.skewDir = 0;
            this.skewTimer = 0;
            this.flipAngle = 0;
            this.flipSpeed = 0;
            this.flipDir = 1;
            
            this.inWater = false;
            this.hasNut = false;
            this.lives = 3;
            this.maxLives = 3;
            
            this.nickname = 'Игрок';
            this.customColor = '#ffd84a';
            this.nickColor = '#d0e0ff';
            
            this.targetX = 80;
            this.targetY = 600;
            
            this.keys = { left: false, right: false, jump: false, dash: false };
        }

        loadNickname() {
            if (!this.isLocal) return;
            try {
                const saved = localStorage.getItem('kz_nickname');
                if (saved && saved.trim()) this.nickname = saved.trim();
                const savedColor = localStorage.getItem('kz_color');
                if (savedColor) this.customColor = savedColor;
                const savedNickColor = localStorage.getItem('kz_nick_color');
                if (savedNickColor) this.nickColor = savedNickColor;
            } catch (e) {}
        }

        bindKeys() {
            if (!this.isLocal) return;
            window.addEventListener('keydown', e => {
                if (e.target.tagName === 'INPUT') return;
                const k = e.key.toLowerCase();
                if (['arrowleft', 'a', 'ф'].includes(k)) this.keys.left = true;
                if (['arrowright', 'd', 'в'].includes(k)) this.keys.right = true;
                if (['arrowup', 'w', 'ц', ' '].includes(k)) { this.keys.jump = true; e.preventDefault(); }
                if (['shift', 'k', 'л'].includes(k)) this.keys.dash = true;
            });
            window.addEventListener('keyup', e => {
                if (e.target.tagName === 'INPUT') return;
                const k = e.key.toLowerCase();
                if (['arrowleft', 'a', 'ф'].includes(k)) this.keys.left = false;
                if (['arrowright', 'd', 'в'].includes(k)) this.keys.right = false;
                if (['arrowup', 'w', 'ц', ' '].includes(k)) this.keys.jump = false;
                if (['shift', 'k', 'л'].includes(k)) this.keys.dash = false;
            });
        }

        collideX(dx) {
            this.x += dx;
            this.touchWall = 0;
            const T = Level.tileSize;
            const top = Math.floor(this.y / T);
            const bottom = Math.floor((this.y + PHYS.H - 1) / T);

            if (dx > 0) {
                const right = Math.floor((this.x + PHYS.W - 1) / T);
                for (let gy = top; gy <= bottom; gy++) {
                    if (Level.isSolid(right, gy)) {
                        this.x = right * T - PHYS.W;
                        this.vx = 0; this.touchWall = 1; return;
                    }
                }
            } else if (dx < 0) {
                const left = Math.floor(this.x / T);
                for (let gy = top; gy <= bottom; gy++) {
                    if (Level.isSolid(left, gy)) {
                        this.x = (left + 1) * T;
                        this.vx = 0; this.touchWall = -1; return;
                    }
                }
            }
        }

        collideY(dy) {
            this.y += dy;
            this.onGround = false;
            const T = Level.tileSize;
            const left = Math.floor(this.x / T);
            const right = Math.floor((this.x + PHYS.W - 1) / T);

            if (dy > 0) {
                const bottom = Math.floor((this.y + PHYS.H - 1) / T);
                for (let gx = left; gx <= right; gx++) {
                    if (Level.isSolid(gx, bottom)) {
                        this.y = bottom * T - PHYS.H;
                        this.vy = 0; this.onGround = true; return;
                    }
                    if (Level.isPlatform(gx, bottom) && this.vy > 0) {
                        const platTop = bottom * T;
                        const prevBottom = this.y - dy + PHYS.H;
                        if (prevBottom > platTop + 6) continue;
                        this.y = platTop - PHYS.H;
                        this.vy = 0; this.onGround = true; return;
                    }
                }
            } else if (dy < 0) {
                const top = Math.floor(this.y / T);
                for (let gx = left; gx <= right; gx++) {
                    if (Level.isSolid(gx, top)) {
                        this.y = (top + 1) * T;
                        this.vy = 0; return;
                    }
                }
            }
        }

        takeDamage(sourceX) {
            if (this.invuln > 0) return;
            this.lives--;
            this.invuln = 90;

            const dir = (this.x + PHYS.W / 2) < sourceX ? -1 : 1;
            this.vx = dir * 8;
            this.vy = -9;

            if (window.Audio) Audio.play(180, 0.2, 'sawtooth', 0.15);
            if (window.Particles) Particles.spawn(this.x + PHYS.W / 2, this.y + PHYS.H / 2, '#ff5050', 15, 5);
        }

        respawn() {
            this.x = Level.playerStart.x;
            this.y = Level.playerStart.y;
            this.vx = 0; this.vy = 0;
            this.invuln = PHYS.INVULN;
            this.hasNut = false;
            this.lives = this.maxLives;
            if (window.Audio) Audio.play(120, 0.4, 'sawtooth', 0.15);
            if (window.Particles) Particles.spawn(this.x + PHYS.W / 2, this.y + PHYS.H / 2, '#ff5050', 25, 6);
        }

        checkHazards() {
            const T = Level.tileSize;
            const centerX = Math.floor((this.x + PHYS.W / 2) / T);
            const centerY = Math.floor((this.y + PHYS.H / 2) / T);
            const feetX = Math.floor((this.x + PHYS.W / 2) / T);
            const feetY = Math.floor((this.y + PHYS.H - 1) / T);

            if (this.invuln <= 0) {
                if (Level.isSpike(centerX, centerY)) {
                    this.takeDamage(centerX * T + T / 2);
                    return;
                }
                if (Level.isSpike(feetX, feetY)) {
                    this.takeDamage(feetX * T + T / 2);
                    return;
                }
            }

            this.inWater = Level.isWater(centerX, centerY);
        }

        update() {
            if (!this.isLocal) {
                this.x += (this.targetX - this.x) * 0.2;
                this.y += (this.targetY - this.y) * 0.2;
                return;
            }

            if (this.dashCooldown > 0) this.dashCooldown--;
            if (this.invuln > 0) this.invuln--;

            this.checkHazards();

            const friction = this.inWater ? PHYS.WATER_DRAG : (this.onGround ? PHYS.FRICTION_GROUND : PHYS.FRICTION_AIR);
            if (this.keys.left)  { this.vx -= PHYS.ACCEL; this.facing = -1; }
            if (this.keys.right) { this.vx += PHYS.ACCEL; this.facing = 1; }
            if (!this.keys.left && !this.keys.right) this.vx *= friction;
            this.vx = Math.max(-PHYS.MAX_SPEED, Math.min(PHYS.MAX_SPEED, this.vx));

            const moveDir = this.vx > 0.5 ? 1 : this.vx < -0.5 ? -1 : 0;
            if (moveDir !== 0 && moveDir !== this.skewDir) { this.skewDir = moveDir; this.skewTimer = 30; }
            if (this.skewTimer > 0) {
                this.skewTimer--;
                const progress = 1 - (this.skewTimer / 30);
                const target = this.skewDir * 0.25 * Math.sin(progress * Math.PI);
                this.skew += (target - this.skew) * 0.35;
            } else {
                this.skew += (0 - this.skew) * 0.25;
            }

            if (this.flipSpeed !== 0) {
                this.flipAngle += Math.abs(this.flipSpeed);
                if (this.flipAngle >= Math.PI * 2 - 0.01) { this.flipAngle = 0; this.flipSpeed = 0; }
            }

            if (this.keys.dash && this.dashCooldown === 0 && this.dashTime === 0) {
                this.dashDirX = this.keys.left ? -1 : this.keys.right ? 1 : this.facing;
                this.dashTime = PHYS.DASH_TIME;
                this.dashCooldown = PHYS.DASH_COOLDOWN;
                this.invuln = Math.max(this.invuln, PHYS.DASH_TIME);
                if (window.Particles) Particles.spawn(this.x + 18, this.y + 18, '#a855f7', 8, 3);
            }
            if (this.dashTime > 0) {
                this.vx = this.dashDirX * PHYS.DASH_SPEED;
                this.vy = 0; this.dashTime--;
            }

            if (this.onGround) this.coyote = PHYS.COYOTE;
            else if (this.coyote > 0) this.coyote--;

            if (this.keys.jump && !this.jumpHeld) this.jumpBuffer = PHYS.JUMP_BUFFER;
            else if (this.jumpBuffer > 0) this.jumpBuffer--;
            this.jumpHeld = this.keys.jump;

            const wantJump = this.jumpBuffer > 0;
            const jumpPower = this.inWater ? PHYS.WATER_JUMP : PHYS.JUMP_BASE;

            if (wantJump && (this.onGround || this.coyote > 0 || this.inWater)) {
                this.vy = jumpPower;
                this.onGround = false; this.coyote = 0;
                this.jumpsLeft = 1; this.jumpBuffer = 0;
                this.squash = 1.25;
                if (window.Audio) Audio.play(440, 0.1, 'square');
            } else if (wantJump && this.jumpsLeft > 0 && !this.inWater) {
                this.vy = PHYS.JUMP_BASE * 0.95;
                this.jumpsLeft--; this.jumpBuffer = 0;
                this.squash = 1.2;
                this.flipAngle = 0; this.flipSpeed = 0.28; this.flipDir = this.facing;
                if (window.Particles) Particles.spawn(this.x + 18, this.y + 36, '#a855f7', 8, 3);
                if (window.Audio) Audio.play(520, 0.08, 'square');
            }

            this.squash += (1 - this.squash) * 0.2;

            if (!this.keys.jump && this.vy < 0) this.vy *= PHYS.JUMP_CUT;
            if (this.keys.jump && this.vy < 0) this.vy -= 0.35;

            if (this.inWater) {
                this.vy = Math.min(this.vy + PHYS.GRAV * PHYS.WATER_GRAV, PHYS.WATER_MAX_FALL);
            } else {
                this.vy = Math.min(this.vy + PHYS.GRAV, PHYS.MAX_FALL);
            }

            this.collideX(this.vx);
            this.collideY(this.vy);

            if (this.onGround) this.jumpsLeft = 2;

            this.x = Math.max(0, Math.min(Level.pixelWidth() - PHYS.W, this.x));
            if (this.y > Level.pixelHeight() + 200) this.respawn();
        }

        draw(ctx) {
            const px = this.x, py = this.y;
            const cx = px + PHYS.W / 2;
            const cy = py + PHYS.H / 2;

            if (this.invuln > 0 && Math.floor(this.invuln / 4) % 2 === 0) ctx.globalAlpha = 0.4;

            const glowRadius = 60;
            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
            if (this.inWater) {
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
            ctx.scale(2 - this.squash, this.squash);
            ctx.transform(1, 0, this.skew, 1, 0, 0);
            if (this.flipSpeed !== 0 || this.flipAngle !== 0) {
                ctx.rotate(this.flipAngle * this.flipDir);
            }
            ctx.translate(-cx, -cy);

            const bodyColor = this.customColor || '#ffd84a';
            const grad = ctx.createLinearGradient(px, py, px + PHYS.W, py + PHYS.H);
            if (this.inWater) {
                grad.addColorStop(0, '#6ac8ff');
                grad.addColorStop(0.5, '#3a9dd6');
                grad.addColorStop(1, '#2060a0');
            } else {
                grad.addColorStop(0, bodyColor);
                grad.addColorStop(0.5, bodyColor);
                grad.addColorStop(1, bodyColor);
            }
            ctx.fillStyle = grad;
            ctx.fillRect(px, py, PHYS.W, PHYS.H);

            ctx.fillStyle = this.inWater ? '#6ac8ff' : bodyColor;
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
            const pupilX = this.facing * 3;
            const pupilY = Math.max(-2, Math.min(2, this.vy * 0.3));
            ctx.beginPath(); ctx.arc(px + PHYS.W * 0.3 + pupilX, eyeY + pupilY, PHYS.W * 0.09, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(px + PHYS.W * 0.7 + pupilX, eyeY + pupilY, PHYS.W * 0.09, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = 'rgba(255, 100, 150, 0.4)';
            ctx.beginPath(); ctx.arc(px + PHYS.W * 0.2, py + PHYS.H * 0.7, PHYS.W * 0.1, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(px + PHYS.W * 0.8, py + PHYS.H * 0.7, PHYS.W * 0.1, 0, Math.PI * 2); ctx.fill();

            ctx.strokeStyle = '#1a1a2e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (this.vy > 5) {
                ctx.arc(px + PHYS.W * 0.5, py + PHYS.H * 0.68, PHYS.W * 0.12, 0, Math.PI * 2);
            } else {
                ctx.arc(px + PHYS.W * 0.5, py + PHYS.H * 0.58, PHYS.W * 0.15, 0.2, Math.PI - 0.2);
            }
            ctx.stroke();

            if (this.hasNut) {
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
            }

            ctx.restore();

            if (this.nickname) {
                ctx.save();
                ctx.font = 'bold 14px "Caveat", cursive';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const nickY = py - (this.hasNut ? 48 : 34);

                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                ctx.shadowBlur = 6;

                const metrics = ctx.measureText(this.nickname);
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

                ctx.fillStyle = this.nickColor || '#d0e0ff';
                ctx.fillText(this.nickname, cx, nickY);
                ctx.restore();
            }

            for (let i = 0; i < 2; i++) {
                ctx.globalAlpha = i < this.jumpsLeft ? 0.9 : 0.2;
                ctx.fillStyle = '#00e676';
                ctx.beginPath();
                ctx.arc(px + 10 + i * 14, py - 28, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }

    // ═══ ДОБАВЛЯЕМ PHYS В КЛАСС, ЧТОБЫ PlayerClass.PHYS.W РАБОТАЛ ═══
    Player.PHYS = PHYS;
    
    window.PlayerClass = Player;
    window.Player = {
        PHYS,
        state: null,
        reloadNickname: () => {}
    };
})();
