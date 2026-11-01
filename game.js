(() => {
    'use strict';
    
    // ════════════════════════════════════════════════════════════
    //  СЕТЕВОЙ АДРЕС СЕРВЕРА (для мультиплеера)
    // ════════════════════════════════════════════════════════════
    const SERVER_URL = "wss://pdlemclcsgnw-production-uigv4qgi.us-central1.suga.run";

    // --- СЕТЕВОЕ ПОДКЛЮЧЕНИЕ ---
    let socket = null;
    let myId = null;
    
    // Делаем объекты глобальными для отладки
    window.otherPlayers = {};
    window.otherNicknames = {};

    let onlineElement = document.getElementById('online-count');
    if (!onlineElement) {
        onlineElement = document.createElement('div');
        onlineElement.id = 'online-count';
        onlineElement.style.cssText = 'position:fixed; top:10px; right:10px; color:white; background:rgba(0,0,0,0.5); padding:5px; z-index:9999; font-family:sans-serif; border-radius:4px;';
        document.body.appendChild(onlineElement);
    }

    function connectToServer() {
        socket = new WebSocket(SERVER_URL);

        socket.onopen = () => {
            addChatMessage('Система', 'Вы подключены к серверу', true);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'init') {
                    myId = data.id;
                    console.log('Мой ID:', myId);
                } 
                else if (data.type === 'online') {
                    onlineElement.textContent = `Онлайн: ${data.count}`;
                }
                else if (data.type === 'chat') {
                    addChatMessage(data.author, data.text);
                } 
                else if (data.type === 'move') {
                    if (data.id !== myId) {
                        // СТРОКА НИЖЕ ВАЖНА: сохраняем время получения пакета (lastUpdate)
                        window.otherPlayers[data.id] = { 
                            x: data.x, 
                            y: data.y,
                            lastUpdate: Date.now() 
                        };
                        if (data.nickname) {
                            window.otherNicknames[data.id] = data.nickname;
                        }
                    }
                }
            } catch (e) {
                console.error('Ошибка парсинга:', e);
            }
        };

        socket.onclose = () => {
            console.log('Отключено от сервера. Очистка и переподключение...');
            window.otherPlayers = {};
            window.otherNicknames = {};
            setTimeout(connectToServer, 3000);
        };
    }

    // ─── DOM ──────────────────────────────────────────────
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const hudBerries = document.getElementById('hud-berries');
    const hudCrystals = document.getElementById('hud-crystals');
    const hudNuts = document.getElementById('hud-nuts');
    const hudLives = document.getElementById('hud-lives');
    const hudPortal = document.getElementById('hud-portal');
    const winScreen = document.getElementById('win-screen');
    const winStats = document.getElementById('win-stats');
    const pauseScreen = document.getElementById('pause-screen');
    const pauseSettings = document.getElementById('pause-settings');
    const btnNext = document.getElementById('btn-next');
    const btnRestart = document.getElementById('btn-restart');
    const btnToMap = document.getElementById('btn-to-map');
    const btnResume = document.getElementById('btn-resume');
    const btnPauseRestart = document.getElementById('btn-pause-restart');
    const btnPauseSettings = document.getElementById('btn-pause-settings');
    const btnPauseMenu = document.getElementById('btn-pause-menu');
    const settingCenter = document.getElementById('setting-center');
    const settingFollow = document.getElementById('setting-follow');
    const pauseNickname = document.getElementById('pause-nickname');

    // Чат
    const chatBox = document.getElementById('chat');
    const chatResizer = document.getElementById('chat-resizer');
    const chatToggle = document.getElementById('chat-toggle');
    const chatSettingsBtn = document.getElementById('chat-settings-btn');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const chatSettings = document.getElementById('chat-settings');
    const chatShowTime = document.getElementById('chat-show-time');
    const chatSound = document.getElementById('chat-sound');
    const chatSystem = document.getElementById('chat-system');
    const chatClear = document.getElementById('chat-clear');

    // ─── Состояние ────────────────────────────────────────
    let viewW = window.innerWidth;
    let viewH = window.innerHeight;
    let camX = 0, camY = 0;
    let portalOpen = false;
    let paused = false;

    function resize() {
        viewW = window.innerWidth;
        viewH = window.innerHeight;
        canvas.width = viewW;
        canvas.height = viewH;
    }
    window.addEventListener('resize', resize);
    resize();

    // ─── HUD ──────────────────────────────────────────────
    function updateHUD() {
        const s = Level.state.collected;
        if (hudBerries) hudBerries.textContent = `${s.berries} / ${Level.state.totalBerries}`;
        if (hudCrystals) hudCrystals.textContent = `${s.crystals} / ${Level.state.totalCrystals}`;
        if (hudNuts) hudNuts.textContent = `${s.nuts} / ${Level.state.totalNuts}`;
        if (hudLives) hudLives.textContent = '❤️'.repeat(Math.max(0, Player.state.lives));

        portalOpen = Level.isPortalOpen();
        if (hudPortal) {
            hudPortal.textContent = portalOpen ? 'ОТКРЫТ' : 'ЗАКРЫТ';
            hudPortal.style.color = portalOpen ? '#00e676' : '#ff7088';
        }
    }

    // ─── Сбор ─────────────────────────────────────────────
    function checkPickup() {
        const p = Player.state;
        const T = Level.tileSize;
        const gx = Math.floor((p.x + Player.PHYS.W / 2) / T);
        const gy = Math.floor((p.y + Player.PHYS.H / 2) / T);

        const result = Level.collectAt(gx, gy);
        if (!result) return;

        updateHUD();

        if (result.type === 'berry') {
            if (window.Audio) Audio.play(880, 0.1, 'sine', 0.06);
            if (window.Particles) Particles.spawn(gx * T + T / 2, gy * T + T / 2, '#ff5070', 10, 4);
        } else if (result.type === 'crystal') {
            if (window.Audio) Audio.play(1046, 0.15, 'triangle', 0.07);
            if (window.Particles) Particles.spawn(gx * T + T / 2, gy * T + T / 2, '#a8d8ff', 14, 5);
        } else if (result.type === 'nut') {
            p.hasNut = true;
            if (window.Audio) Audio.play(660, 0.2, 'triangle', 0.1);
            if (window.Particles) Particles.spawn(gx * T + T / 2, gy * T + T / 2, '#ffcc33', 16, 5);
        }
    }

    // ─── Портал ───────────────────────────────────────────
    function checkPortal() {
        if (!portalOpen) return;
        const p = Player.state;
        const portal = Level.portal;

        const cx = p.x + Player.PHYS.W / 2;
        const cy = p.y + Player.PHYS.H / 2;
        const portalCX = portal.x + portal.w / 2;
        const portalCY = portal.y + portal.h / 2;

        const dx = (cx - portalCX) / (portal.w / 2);
        const dy = (cy - portalCY) / (portal.h / 2);

        if ((dx * dx + dy * dy) <= 1 && p.hasNut) {
            winLevel();
        }
    }

    // ─── Победа ───────────────────────────────────────────
    function winLevel() {
        window.__gameActive = false;
        paused = true;

        const mode = localStorage.getItem('kz_play_mode') || 'fixed';
        const key = localStorage.getItem('kz_play_key') || 'forest';

        if (mode === 'fixed') {
            try {
                const progress = JSON.parse(localStorage.getItem('kz_progress') || '{}');
                progress[key] = true;
                localStorage.setItem('kz_progress', JSON.stringify(progress));
            } catch (e) {}
        }

        const s = Level.state.collected;
        if (winStats) {
            winStats.innerHTML = `
                <div class="stat-row"><span>🍓 Ягоды</span><b>${s.berries} / ${Level.state.totalBerries}</b></div>
                <div class="stat-row"><span>💎 Кристаллы</span><b>${s.crystals} / ${Level.state.totalCrystals}</b></div>
                <div class="stat-row"><span>🌰 Орехи</span><b>${s.nuts} / ${Level.state.totalNuts}</b></div>
            `;
        }

        if (btnNext) {
            btnNext.style.display = (mode === 'random') ? '' : 'none';
        }

        if (winScreen) {
            winScreen.classList.add('visible');
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    if (window.Particles) {
                        const px = Level.portal.x + Level.portal.w / 2;
                        const py = Level.portal.y + Level.portal.h / 2;
                        Particles.spawn(px, py, ['#a8d8ff', '#ffcc33', '#88ffcc'][i % 3], 20, 6);
                    }
                }, i * 100);
            }
        }

        if (window.Audio) {
            setTimeout(() => Audio.play(523, 0.2, 'sine', 0.08), 0);
            setTimeout(() => Audio.play(659, 0.2, 'sine', 0.08), 150);
            setTimeout(() => Audio.play(784, 0.2, 'sine', 0.08), 300);
            setTimeout(() => Audio.play(1046, 0.4, 'sine', 0.1), 450);
        }
    }

    // ─── Настройки ────────────────────────────────────────
    const settings = { centerMap: true, followPlayer: false };
    try {
        const saved = JSON.parse(localStorage.getItem('kz_settings') || '{}');
        if (typeof saved.centerMap === 'boolean') settings.centerMap = saved.centerMap;
        if (typeof saved.followPlayer === 'boolean') settings.followPlayer = saved.followPlayer;
    } catch (e) {}

    function syncSettingsUI() {
        if (settingCenter) settingCenter.checked = settings.centerMap;
        if (settingFollow) settingFollow.checked = settings.followPlayer;
        if (pauseNickname) pauseNickname.value = Player.state.nickname || 'Игрок';
    }
    syncSettingsUI();

    function saveSettings() {
        localStorage.setItem('kz_settings', JSON.stringify(settings));
    }

    if (settingCenter) {
        settingCenter.addEventListener('change', () => {
            if (settingCenter.checked) {
                settingFollow.checked = false;
                settings.followPlayer = false;
            }
            settings.centerMap = settingCenter.checked;
            saveSettings();
        });
    }
    if (settingFollow) {
        settingFollow.addEventListener('change', () => {
            if (settingFollow.checked) {
                settingCenter.checked = false;
                settings.centerMap = false;
            }
            settings.followPlayer = settingFollow.checked;
            saveSettings();
        });
    }

    // ─── Ник ──────────────────────────────────────────────
    if (pauseNickname) {
        pauseNickname.addEventListener('input', () => {
            const nick = pauseNickname.value.trim() || 'Игрок';
            Player.state.nickname = nick;
            try { localStorage.setItem('kz_nickname', nick); } catch (e) {}
        });
        pauseNickname.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });
    }

    // ─── Камера ───────────────────────────────────────────
    function updateCamera() {
        const maxX = Level.pixelWidth() - viewW;
        const maxY = Level.pixelHeight() - viewH;

        if (settings.followPlayer) {
            const p = Player.state;
            const targetX = p.x + Player.PHYS.W / 2 - viewW / 2;
            const targetY = p.y + Player.PHYS.H / 2 - viewH / 2;
            camX += (targetX - camX) * 0.1;
            camY += (targetY - camY) * 0.1;
        } else {
            camX = maxX / 2;
            camY = maxY / 2;
        }

        if (maxX > 0) camX = Math.max(0, Math.min(maxX, camX));
        else camX = maxX / 2;

        if (maxY > 0) camY = Math.max(0, Math.min(maxY, camY));
        else camY = maxY / 2;
    }

    // ─── Пауза ────────────────────────────────────────────
    function pauseGame() {
        if (paused) return;
        paused = true;
        if (pauseScreen) pauseScreen.classList.add('visible');
        if (pauseSettings) pauseSettings.classList.add('hidden');
        syncSettingsUI();
    }

    function resumeGame() {
        paused = false;
        if (pauseScreen) pauseScreen.classList.remove('visible');
        if (window.Audio) Audio.init();
    }

    // ═══════════════ ЧАТ ═══════════════
    const chatOptions = { showTime: false, sound: true, showSystem: true };
    try {
        const saved = JSON.parse(localStorage.getItem('kz_chat') || '{}');
        if (typeof saved.showTime === 'boolean') chatOptions.showTime = saved.showTime;
        if (typeof saved.sound === 'boolean') chatOptions.sound = saved.sound;
        if (typeof saved.showSystem === 'boolean') chatOptions.showSystem = saved.showSystem;
    } catch (e) {}

    function saveChatOptions() {
        localStorage.setItem('kz_chat', JSON.stringify(chatOptions));
    }

    if (chatShowTime) {
        chatShowTime.checked = chatOptions.showTime;
        chatShowTime.addEventListener('change', () => {
            chatOptions.showTime = chatShowTime.checked;
            saveChatOptions();
            renderChat();
        });
    }
    if (chatSound) {
        chatSound.checked = chatOptions.sound;
        chatSound.addEventListener('change', () => {
            chatOptions.sound = chatSound.checked;
            saveChatOptions();
        });
    }
    if (chatSystem) {
        chatSystem.checked = chatOptions.showSystem;
        chatSystem.addEventListener('change', () => {
            chatOptions.showSystem = chatSystem.checked;
            saveChatOptions();
            renderChat();
        });
    }

    var chatHistory = [];

    function addChatMessage(author, text, isSystem = false) {
        const now = new Date();
        const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        chatHistory.push({ author, text, time, isSystem });
        renderChat();
        if (!isSystem && chatOptions.sound && window.Audio) {
            Audio.play(660, 0.08, 'sine', 0.04);
        }
    }

    function renderChat() {
        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        for (const msg of chatHistory) {
            if (msg.isSystem && !chatOptions.showSystem) continue;
            const el = document.createElement('div');
            el.className = 'chat-msg';
            let html = '';
            if (chatOptions.showTime) {
                html += `<span class="chat-time">${msg.time}</span>`;
            }
            html += `<span class="chat-author">${escapeHtml(msg.author)}:</span> `;
            html += `<span class="chat-text">${escapeHtml(msg.text)}</span>`;
            el.innerHTML = html;
            chatMessages.appendChild(el);
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[c]);
    }

    addChatMessage('Система', 'Добро пожаловать!', true);

    if (chatSend) chatSend.addEventListener('click', sendChat);
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
            e.stopPropagation();
        });
    }

    function sendChat() {
        if (!chatInput) return;
        const text = (chatInput.value || '').trim();
        if (!text) return;
        
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'chat',
                author: Player.state.nickname || 'Игрок',
                text: text
            }));
        }
        
        addChatMessage(Player.state.nickname || 'Игрок', text);
        chatInput.value = '';
    }

    if (chatToggle && chatBox) {
        chatToggle.addEventListener('click', () => {
            chatBox.classList.toggle('collapsed');
            chatToggle.textContent = chatBox.classList.contains('collapsed') ? '+' : '—';
        });
    }
    if (chatSettingsBtn && chatSettings) {
        chatSettingsBtn.addEventListener('click', () => {
            chatSettings.classList.toggle('hidden');
        });
    }
    if (chatClear) {
        chatClear.addEventListener('click', () => {
            chatHistory.length = 0;
            addChatMessage('Система', 'История очищена', true);
        });
    }

    if (chatResizer && chatBox) {
        let isResizing = false, startY = 0, startHeight = 0;
        chatResizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
            startY = e.clientY;
            startHeight = chatBox.offsetHeight;
            document.body.style.cursor = 'ns-resize';
        });
        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const delta = startY - e.clientY;
            const newHeight = Math.max(36, Math.min(600, startHeight + delta));
            chatBox.style.height = newHeight + 'px';
            if (newHeight <= 50) {
                chatBox.classList.add('collapsed');
                if (chatToggle) chatToggle.textContent = '+';
            } else {
                chatBox.classList.remove('collapsed');
                if (chatToggle) chatToggle.textContent = '—';
            }
        });
        window.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                try { localStorage.setItem('kz_chat_height', chatBox.offsetHeight); } catch (e) {}
            }
        });
    }

    try {
        const savedHeight = parseInt(localStorage.getItem('kz_chat_height') || '0', 10);
        if (savedHeight && chatBox) {
            chatBox.style.height = Math.max(36, Math.min(600, savedHeight)) + 'px';
        }
    } catch (e) {}

    // ═══════════════ ЗАГРУЗКА УРОВНЯ ═══════════════
    function loadLevelByMode() {
        const mode = localStorage.getItem('kz_play_mode') || 'fixed';

        if (mode === 'editor') {
            const editorData = localStorage.getItem('kz_editor_level');
            if (editorData) {
                try {
                    const data = JSON.parse(editorData);
                    addChatMessage('Система', `Уровень из редактора: ${data.name || 'Без названия'}`, true);
                    return Level.loadFromData(data);
                } catch (e) {
                    console.error('Ошибка загрузки из редактора:', e);
                }
            }
        }

        if (mode === 'random') {
            const seed = Math.floor(Math.random() * 1e9);
            localStorage.setItem('kz_random_seed', String(seed));
            
            let count = parseInt(localStorage.getItem('kz_random_count') || '0', 10);
            count++;
            localStorage.setItem('kz_random_count', String(count));

            const randomThemes = ['forest', 'desert', 'mountains', 'dungeon'];
            const randomTheme = randomThemes[Math.floor(Math.random() * randomThemes.length)];

            const THEME_NAMES = {
                forest: 'Лес',
                desert: 'Пустыня',
                mountains: 'Горы',
                dungeon: 'Подземелья'
            };

            addChatMessage('Система', 
                `Случайный мир #${count} (${THEME_NAMES[randomTheme]}, seed: ${seed})`, true);

            return Level.loadRandom({
                theme: randomTheme,
                difficulty: 'normal',
                seed: seed,
                totalBerries: 6,
                totalCrystals: 4,
                totalNuts: 1,
                width: 40,
                height: 40,
                terrain: 'ground'
            });
        }

        const key = localStorage.getItem('kz_play_key') || 'forest';
        const theme = localStorage.getItem('kz_play_theme') || 'forest';
        
        const KEY_NAMES = {
            forest: 'Лес — Первая высадка',
            desert: 'Пустыня — Жаркий край',
            mountains: 'Горы — Снежные пики',
            dungeon: 'Подземелья — Тёмные глубины'
        };
        
        addChatMessage('Система', `${KEY_NAMES[key] || 'Локация'}`, true);

        return Level.loadRandom({
            theme: theme,
            difficulty: 'normal',
            seed: getFixedSeed(key),
            totalBerries: 6,
            totalCrystals: 4,
            totalNuts: 1,
            width: 40,
            height: 40,
            terrain: 'ground'
        });
    }

    function getFixedSeed(key) {
        const SEEDS = {
            forest: 12345,
            desert: 54321,
            mountains: 98765,
            dungeon: 24680
        };
        return SEEDS[key] || 12345;
    }

    // ═══════════════ ИНДИКАТОРЫ ═══════════════
    function drawCompass() {
        const p = Player.state;
        const px = p.x + Player.PHYS.W / 2;
        const py = p.y + Player.PHYS.H / 2;

        if (!p.hasNut && Level.state.collected.nuts < Level.state.totalNuts) {
            let nutPos = null;
            for (let y = 0; y < Level.height; y++) {
                for (let x = 0; x < Level.width; x++) {
                    if (Level.grid[y][x] === Level.TILE.NUT) {
                        nutPos = {
                            x: x * Level.tileSize + Level.tileSize / 2,
                            y: y * Level.tileSize + Level.tileSize / 2
                        };
                        break;
                    }
                }
                if (nutPos) break;
            }
            if (nutPos) drawPointer(nutPos.x, nutPos.y, px, py, '#ffcc33', '🌰');
        }

        const portal = Level.portal;
        const portalCX = portal.x + portal.w / 2;
        const portalCY = portal.y + portal.h / 2;
        const color = Level.isPortalOpen() ? '#88ffcc' : 'rgba(136, 255, 204, 0.4)';
        drawPointer(portalCX, portalCY, px, py, color, '🌀');
    }

    function drawPointer(targetX, targetY, playerX, playerY, color, icon) {
        const padX = 80, padY = 80;
        const screenTX = targetX - camX;
        const screenTY = targetY - camY;
        const onScreen = screenTX > 0 && screenTX < viewW && screenTY > 0 && screenTY < viewH;

        if (onScreen) {
            const pulse = Math.sin(performance.now() * 0.005) * 0.3 + 0.7;
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screenTX, screenTY - 40, 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(icon, screenTX, screenTY - 40);
            ctx.globalAlpha = 1;
        } else {
            const dx = targetX - playerX;
            const dy = targetY - playerY;
            const angle = Math.atan2(dy, dx);

            let ax = viewW / 2 + Math.cos(angle) * (viewW / 2 - padX);
            let ay = viewH / 2 + Math.sin(angle) * (viewH / 2 - padY);
            ax = Math.max(padX, Math.min(viewW - padX, ax));
            ay = Math.max(padY, Math.min(viewH - padY, ay));

            const pulse = Math.sin(performance.now() * 0.006) * 0.3 + 0.7;
            ctx.globalAlpha = pulse;

            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(angle);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(20, 0);
            ctx.lineTo(-8, -10);
            ctx.lineTo(-8, 10);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();

            const ix = ax - Math.cos(angle) * 26;
            const iy = ay - Math.sin(angle) * 26;
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(icon, ix, iy);

            const dist = Math.round(Math.sqrt(dx * dx + dy * dy) / Level.tileSize);
            ctx.globalAlpha = pulse * 0.8;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px "Montserrat", sans-serif';
            ctx.fillText(dist + 'м', ix, iy + 18);
            ctx.globalAlpha = 1;
        }
    }

    // ─── Игровой цикл ─────────────────────────────────────
    function loop() {
        if (window.__gameActive === false) return;

        if (!paused) {
            Player.update();
            checkPickup();
            checkPortal();
            updateCamera();
            Tiles.updateParticles();
            
            // --- ОТПРАВКА КООРДИНАТ (с ником) ---
            if (socket && socket.readyState === WebSocket.OPEN && myId) {
                socket.send(JSON.stringify({
                    type: 'move',
                    id: myId,
                    nickname: Player.state.nickname || 'Игрок',
                    x: Player.state.x,
                    y: Player.state.y
                }));
            }
        }

        Tiles.drawBackground(ctx, viewW, viewH, camX, camY);

        ctx.save();
        ctx.translate(-camX, -camY);

        Tiles.drawLevel(ctx, camX, camY, viewW, viewH);
        Tiles.drawParticles(ctx);
        Player.draw(ctx);
        
        // --- ОТРИСОВКА ДРУГИХ ИГРОКОВ И ОЧИСТКА ФАНТОМОВ ---
        const now = Date.now();
        for (const id in window.otherPlayers) {
            if (id === myId) continue;
            const op = window.otherPlayers[id];
            
            // УДАЛЕНИЕ ФАНТОМА: если нет данных больше 2.5 сек
            if (!op.lastUpdate || now - op.lastUpdate > 2500) {
                delete window.otherPlayers[id];
                delete window.otherNicknames[id];
                continue;
            }
            
            // Красный кружок
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(op.x + Player.PHYS.W / 2, op.y + Player.PHYS.H / 2, 20, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Никнейм над головой
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            const displayName = window.otherNicknames[id] || id;
            ctx.fillText(displayName, op.x + Player.PHYS.W / 2, op.y - 10);
        }

        ctx.restore();

        if (!paused) drawCompass();

        requestAnimationFrame(loop);
    }

    // ─── Старт ────────────────────────────────────────────
    function start() {
        window.__gameActive = true;
        paused = false;

        document.addEventListener('click', () => {
            if (window.Audio) Audio.init();
        }, { once: true });
        window.addEventListener('keydown', () => {
            if (window.Audio) Audio.init();
        }, { once: true });

        if (window.Player && Player.reloadNickname) Player.reloadNickname();

        loadLevelByMode().then(() => {
            Player.state.x = Level.playerStart.x;
            Player.state.y = Level.playerStart.y;
            Player.state.vx = 0;
            Player.state.vy = 0;
            Player.state.hasNut = false;
            Player.state.lives = Player.state.maxLives;
            Player.bindKeys();

            const maxX = Level.pixelWidth() - viewW;
            const maxY = Level.pixelHeight() - viewH;

            if (settings.followPlayer) {
                const p = Player.state;
                camX = Math.max(0, Math.min(maxX, p.x + Player.PHYS.W / 2 - viewW / 2));
                camY = Math.max(0, Math.min(maxY, p.y + Player.PHYS.H / 2 - viewH / 2));
            } else {
                camX = maxX / 2;
                camY = maxY / 2;
            }

            updateHUD();
            loop();

            // Закрываем сокет при уходе со страницы
            window.addEventListener('beforeunload', () => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.close();
                }
            });

            // Запускаем подключение к серверу
            connectToServer();
        }).catch(err => {
            console.error('Ошибка загрузки уровня:', err);
            ctx.fillStyle = '#ff7088';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Не удалось загрузить уровень', viewW / 2, viewH / 2);
        });
    }

    // ─── Кнопки ───────────────────────────────────────────
    if (btnNext) {
        btnNext.addEventListener('click', () => {
            const newSeed = Math.floor(Math.random() * 1e9);
            localStorage.setItem('kz_random_seed', String(newSeed));
            localStorage.setItem('kz_play_mode', 'random');
            location.reload();
        });
    }
    if (btnRestart) btnRestart.addEventListener('click', () => location.reload());
    if (btnToMap) btnToMap.addEventListener('click', () => location.href = 'map.html');
    if (btnResume) btnResume.addEventListener('click', resumeGame);
    if (btnPauseRestart) btnPauseRestart.addEventListener('click', () => location.reload());
    if (btnPauseSettings) btnPauseSettings.addEventListener('click', () => {
        if (pauseSettings) pauseSettings.classList.toggle('hidden');
    });
    if (btnPauseMenu) btnPauseMenu.addEventListener('click', () => location.href = 'index.html');

    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === 'Escape') {
            e.preventDefault();
            if (window.__gameActive && !winScreen.classList.contains('visible')) {
                if (paused) resumeGame();
                else pauseGame();
            }
        }
    });

    // Вызов старта
    start();
})();
