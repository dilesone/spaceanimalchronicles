(() => {
    'use strict';
    
    // ════════════════════════════════════════════════════════════
    //  УМНЫЙ ПОИСК КОМНАТЫ и СИД
    // ════════════════════════════════════════════════════════════
    const playMode = localStorage.getItem('kz_play_mode') || 'fixed';
    let roomType = 'fixed';
    let fixedKey = 'forest';
    
    if (playMode === 'random') {
        roomType = 'random';
    } else if (playMode === 'fixed') {
        roomType = 'fixed';
        fixedKey = localStorage.getItem('kz_play_key') || 'forest';
    }
    
    const BASE_URL = 'wss://pdlemclcsgnw-production-uigv4qgi.us-central1.suga.run';
    const HTTP_URL = 'https://pdlemclcsgnw-production-uigv4qgi.us-central1.suga.run';
    
    let socket = null;
    let isWheelOpen = false;
    let holdTimer = null;
    let qPressed = false;
    let myId = localStorage.getItem('kz_session_id') || null;
    let serverSeed = null;
    
    let roundTime = 300;
    let roundTimerInterval = null;
    let playerXP = parseInt(localStorage.getItem('kz_xp')) || 0;
    let playerLevel = parseInt(localStorage.getItem('kz_level')) || 1;
    let xpForNextLevel = playerLevel * 100;
    let myPlayer = null;
    const otherPlayers = {};
    
    window.otherPlayers = {};
    window.otherNicknames = {};

    async function findRoom() {
        const isAfterFinish = sessionStorage.getItem('kz_after_finish');
        if (isAfterFinish) {
            sessionStorage.removeItem('kz_after_finish');
            const savedRoom = localStorage.getItem('kz_current_room');
            if (savedRoom) return savedRoom;
        }

        try {
            const query = roomType === 'random' ? 'type=random' : `type=${fixedKey}`;
            const res = await fetch(`${HTTP_URL}/find-room?${query}`);
            const data = await res.json();
            return data.room;
        } catch (e) {
            console.warn('Ошибка поиска:', e);
            return roomType === 'random' ? 'random_fallback' : fixedKey;
        }
    }

    function connectToServer(roomName) {
        localStorage.setItem('kz_current_room', roomName);
        
        const url = myId ? `${BASE_URL}/room/${roomName}?session=${myId}` : `${BASE_URL}/room/${roomName}`;
        socket = new WebSocket(url);

        socket.onopen = () => {
            addChatMessage('Система', 'Вы подключены к комнате: ' + roomName, true);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'init') {
                    myId = data.id;
                    localStorage.setItem('kz_session_id', myId);
                    
                    if (data.seed && data.seed !== serverSeed) {
                        serverSeed = data.seed;
                        loadLevelBySeed(serverSeed).then(() => {
                            if (!myPlayer) {
                                myPlayer = new PlayerClass(myId, true);
                                myPlayer.loadNickname();
                                myPlayer.bindKeys();
                                window.myPlayer = myPlayer;
                            }
                            
                            myPlayer.x = Level.playerStart.x;
                            myPlayer.y = Level.playerStart.y;
                            myPlayer.vx = 0; myPlayer.vy = 0;
                            myPlayer.hasNut = false;
                            myPlayer.lives = myPlayer.maxLives;
                            
                            if (data.collected) Level.state.collected = data.collected;
                            if (data.personal) Level.state.personal = data.personal;
                            updateHUD();
                            updateProfileUI();
                            startRoundTimer();
                            
                            const maxX = Level.pixelWidth() - viewW;
                            const maxY = Level.pixelHeight() - viewH;
                            if (settings.followPlayer) {
                                camX = Math.max(0, Math.min(maxX, myPlayer.x + PlayerClass.PHYS.W / 2 - viewW / 2));
                                camY = Math.max(0, Math.min(maxY, myPlayer.y + PlayerClass.PHYS.H / 2 - viewH / 2));
                            } else {
                                camX = maxX / 2;
                                camY = maxY / 2;
                            }

                            if (!window.__gameActive) {
                                window.__gameActive = true;
                                isLoopRunning = false;
                                loop();
                            }
                        });
                    }
                } 
                else if (data.type === 'online') {
                    if (onlineElement) onlineElement.textContent = `(онлайн ${data.count})`;
                }
                else if (data.type === 'chat') {
                    addChatMessage(data.author, data.text, false, data.color);
                    
                    if (myPlayer && data.author === myPlayer.nickname) {
                        myPlayer.chatBubble = data.text;
                        myPlayer.chatBubbleTime = Date.now();
                    } else {
                        for (const id in otherPlayers) {
                            if (otherPlayers[id].nickname === data.author) {
                                otherPlayers[id].chatBubble = data.text;
                                otherPlayers[id].chatBubbleTime = Date.now();
                                break;
                            }
                        }
                    }
                }
                else if (data.type === 'emote') {
                    for (const id in otherPlayers) {
                        if (otherPlayers[id].nickname === data.nickname) {
                            showEmote(otherPlayers[id], data.emoji);
                            break;
                        }
                    }
                }
                else if (data.type === 'move') {
                    if (data.id !== myId) {
                        if (!otherPlayers[data.id]) {
                            otherPlayers[data.id] = new PlayerClass(data.id, false);
                            otherPlayers[data.id].nickname = data.nickname || 'Игрок';
                        }
                        const op = otherPlayers[data.id];
                        
                        op.targetX = data.x;
                        op.targetY = data.y;
                        op.facing = data.facing || 1;
                        op.vx = data.vx || 0;
                        op.vy = data.vy || 0;
                        op.squash = data.squash || 1;
                        op.skew = data.skew || 0;
                        op.flipAngle = data.flipAngle || 0;
                        op.flipSpeed = data.flipSpeed || 0;
                        op.hasNut = data.hasNut || false;
                        op.customColor = data.customColor || '#ffd84a';
                        op.nickColor = data.nickColor || '#d0e0ff';
                        op.nickname = data.nickname || 'Игрок';
                        op.lastUpdate = Date.now();
                        
                        window.otherPlayers[data.id] = op;
                        window.otherNicknames[data.id] = op.nickname;
                    }
                }
                else if (data.type === 'player_collected') {
                    const itemType = data.itemType;
                    
                    if (itemType === 'berry' || itemType === 'crystal') {
                        Level.setTile(data.gx, data.gy, Level.TILE.EMPTY);
                        if (window.Particles) {
                            Particles.spawn(
                                data.gx * Level.tileSize + Level.tileSize / 2,
                                data.gy * Level.tileSize + Level.tileSize / 2,
                                itemType === 'berry' ? '#ff5070' : '#a8d8ff', 8, 3
                            );
                        }
                    }
                    
                    if (itemType === 'nut') {
                        if (data.id === myId) {
                            Level.setTile(data.gx, data.gy, Level.TILE.EMPTY);
                            if (myPlayer) myPlayer.hasNut = true;
                        }
                    }
                    
                    if (data.collected) Level.state.collected = data.collected;
                    if (data.id === myId && data.personal) Level.state.personal = data.personal;
                    
                    updateHUD();
                }
                else if (data.type === 'player_finished') {
                    delete otherPlayers[data.id];
                    delete window.otherPlayers[data.id];
                    delete window.otherNicknames[data.id];
                    addChatMessage('Система', `${data.nickname || data.id} дошел до портала!`, true);
                }
                else if (data.type === 'all_finished') {
                    if (document.getElementById('btn-wait')) document.getElementById('btn-wait').style.display = 'none';
                    const winPanel = document.querySelector('.win-panel');
                    if (winPanel && !document.getElementById('wait-timer')) {
                        const timerDiv = document.createElement('div');
                        timerDiv.id = 'wait-timer';
                        timerDiv.style.cssText = 'margin-top: 20px; font-size: 24px; color: #88ffcc; font-family: Caveat, cursive;';
                        timerDiv.textContent = 'Все на месте! Переход через 5...';
                        winPanel.appendChild(timerDiv);
                    }
                }
                else if (data.type === 'next_level') {
                    console.log('Переход на новый уровень!');
                    sessionStorage.setItem('kz_after_finish', '1');
                    localStorage.setItem('kz_current_room', roomName);
                    location.reload();
                }
            } catch (e) { console.error('Ошибка:', e); }
        };

        socket.onclose = () => {
            for (const id in otherPlayers) {
                delete otherPlayers[id];
                delete window.otherPlayers[id];
                delete window.otherNicknames[id];
            }
            setTimeout(() => connectToServer(roomName), 2000);
        };
    }

    function loadLevelBySeed(seedToUse) {
        const mode = localStorage.getItem('kz_play_mode') || 'fixed';
        let theme = 'forest';
        
        if (mode === 'fixed') {
            theme = localStorage.getItem('kz_play_theme') || 'forest';
        } else if (mode === 'random') {
            const themes = ['forest', 'desert', 'mountains', 'dungeon'];
            theme = themes[seedToUse % themes.length];
        } else if (mode === 'editor') {
            const editorData = localStorage.getItem('kz_editor_level');
            if (editorData) return Level.loadFromData(JSON.parse(editorData));
            return Level.loadRandom({ theme: 'forest', seed: seedToUse });
        }

        return Level.loadRandom({
            theme: theme,
            difficulty: 'normal',
            seed: seedToUse,
            totalBerries: 12,
            totalCrystals: 8,
            totalNuts: 1,
            width: 40,
            height: 40,
            terrain: 'ground'
        });
    }

    // ─── DOM ──────────────────────────────────────────────
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    
    const hudTimer = document.getElementById('hud-timer');
    const portalBlock = document.getElementById('portal-block');
    const portalFill = document.getElementById('portal-fill');
    const hudBerries = document.getElementById('hud-berries');
    const hudCrystals = document.getElementById('hud-crystals');
    const hudNuts = document.getElementById('hud-nuts');
    const nutResItem = document.getElementById('nut-res-item');
    
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
    
    const btnWait = document.getElementById('btn-wait');
    const btnLeaveAlone = document.getElementById('btn-leave-alone');
    const btnSoloNext = document.getElementById('btn-solo-next');
    
    const profileNick = document.getElementById('profile-nick');
    const profileLevel = document.getElementById('profile-level');
    const profileLives = document.getElementById('profile-lives');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileXpFill = document.getElementById('profile-xp-fill');
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    
    const emoteWheel = document.getElementById('emoteWheel');
    const wheelContainer = document.getElementById('wheelContainer');

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

    let viewW = window.innerWidth;
    let viewH = window.innerHeight;
    let camX = 0, camY = 0;
    let portalOpen = false;
    let paused = false;
    let isLoopRunning = false;

    function resize() {
        viewW = window.innerWidth;
        viewH = window.innerHeight;
        canvas.width = viewW;
        canvas.height = viewH;
    }
    window.addEventListener('resize', resize);
    resize();

    function updateHUD() {
        const s = Level.state.collected;

        if (hudBerries) hudBerries.textContent = `${s.berries}/${Level.state.totalBerries}`;
        if (hudCrystals) hudCrystals.textContent = `${s.crystals}/${Level.state.totalCrystals}`;
        if (hudNuts) hudNuts.textContent = `${s.nuts}/${Level.state.totalNuts}`;
        
        if (nutResItem) {
            if (s.nuts >= Level.state.totalNuts) nutResItem.classList.add('complete');
            else nutResItem.classList.remove('complete');
        }

        // --- ЭВАКУАЦИЯ ---
        const totalNeeded = Level.state.totalBerries + Level.state.totalCrystals;
        const threshold = totalNeeded / 2; // Порог (половина ресурсов)
        const totalCollected = s.berries + s.crystals;
        const hasNut = myPlayer ? myPlayer.hasNut : false; // Есть ли у игрока орех
        
        // Процент заполнения полосы (только по ресурсам)
        const percent = threshold > 0 ? Math.min(100, (totalCollected / threshold) * 100) : 100;
        
        if (portalFill) portalFill.style.width = `${percent}%`;
        
        // Портал открыт, ТОЛЬКО если ресурсов достаточно И есть орех
        const isOpen = (percent >= 100) && hasNut;
        
        if (isOpen) {
            if (portalBlock) portalBlock.classList.add('open');
            portalOpen = true;
        } else {
            if (portalBlock) portalBlock.classList.remove('open');
            portalOpen = false;
        }
    }

    function updateProfileUI() {
        if (!myPlayer) return;
        
        if (profileNick) {
            profileNick.textContent = myPlayer.nickname || 'Игрок';
            profileNick.style.color = myPlayer.nickColor || '#d0e0ff';
        }
        if (profileAvatar) {
            profileAvatar.style.background = myPlayer.customColor || '#ffd84a';
            profileAvatar.style.color = myPlayer.customColor || '#ffd84a';
        }
        if (profileLives) {
            profileLives.textContent = '❤️'.repeat(Math.max(0, myPlayer.lives));
        }
        if (profileLevel) {
            profileLevel.textContent = `Lvl ${playerLevel}`;
        }
        if (profileXpFill) {
            const xpPercent = Math.min(100, (playerXP / xpForNextLevel) * 100);
            profileXpFill.style.width = `${xpPercent}%`;
        }
    }

    function checkPickup() {
        if (!myPlayer) return;
        const T = Level.tileSize;
        const gx = Math.floor((myPlayer.x + PlayerClass.PHYS.W / 2) / T);
        const gy = Math.floor((myPlayer.y + PlayerClass.PHYS.H / 2) / T);

        const result = Level.collectAt(gx, gy);
        if (!result) return;

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'collect', id: myId, gx: gx, gy: gy, itemType: result.type }));
        }

        let xpGained = 0;
        if (result.type === 'berry') {
            if (window.Audio) Audio.play(880, 0.1, 'sine', 0.06);
            if (window.Particles) Particles.spawn(gx * T + T / 2, gy * T + T / 2, '#ff5070', 10, 4);
            xpGained = 5;
        } else if (result.type === 'crystal') {
            if (window.Audio) Audio.play(1046, 0.15, 'triangle', 0.07);
            if (window.Particles) Particles.spawn(gx * T + T / 2, gy * T + T / 2, '#a8d8ff', 14, 5);
            xpGained = 10;
        } else if (result.type === 'nut') {
            myPlayer.hasNut = true;
            if (window.Audio) Audio.play(660, 0.2, 'triangle', 0.1);
            if (window.Particles) Particles.spawn(gx * T + T / 2, gy * T + T / 2, '#ffcc33', 16, 5);
            xpGained = 20;
        }
        
        if (xpGained > 0) {
            playerXP += xpGained;
            while (playerXP >= xpForNextLevel) {
                playerXP -= xpForNextLevel;
                playerLevel++;
                xpForNextLevel = playerLevel * 100;
                addChatMessage('Система', `🎉 Вы достигли ${playerLevel} уровня!`, true);
            }
            localStorage.setItem('kz_xp', playerXP);
            localStorage.setItem('kz_level', playerLevel);
            updateProfileUI();
        }
    }

    function checkPortal() {
        if (!portalOpen || !myPlayer) return;
        const portal = Level.portal;
        const cx = myPlayer.x + PlayerClass.PHYS.W / 2;
        const cy = myPlayer.y + PlayerClass.PHYS.H / 2;
        const dx = (cx - (portal.x + portal.w / 2)) / (portal.w / 2);
        const dy = (cy - (portal.y + portal.h / 2)) / (portal.h / 2);
        if ((dx * dx + dy * dy) <= 1 && myPlayer.hasNut) winLevel();
    }

    function winLevel() {
        playerXP += 50; 
        while (playerXP >= xpForNextLevel) {
            playerXP -= xpForNextLevel;
            playerLevel++;
            xpForNextLevel = playerLevel * 100;
            addChatMessage('Система', `🎉 Вы достигли ${playerLevel} уровня!`, true);
        }
        localStorage.setItem('kz_xp', playerXP);
        localStorage.setItem('kz_level', playerLevel);
        updateProfileUI();

        window.__gameActive = false;
        paused = true;

        if (socket && socket.readyState === WebSocket.OPEN && myPlayer) {
            socket.send(JSON.stringify({ type: 'finish', id: myId, nickname: myPlayer.nickname }));
        }

        const s = Level.state.collected;
        const p = Level.state.personal || { berries: 0, crystals: 0, nuts: 0 };
        
        if (winStats) {
            winStats.innerHTML = `
                <div class="stat-row"><span>🍓 Ягоды (общие)</span><b>${s.berries} / ${Level.state.totalBerries}</b></div>
                <div class="stat-row"><span>💎 Кристаллы (общие)</span><b>${s.crystals} / ${Level.state.totalCrystals}</b></div>
                <div class="stat-row"><span>🌰 Орехи (общие)</span><b>${s.nuts} / ${Level.state.totalNuts}</b></div>
                <div class="stat-row" style="margin-top:10px; border-top:1px solid #444; padding-top:10px;"><span>👤 Личный вклад</span><b>${p.berries + p.crystals + p.nuts}</b></div>
            `;
        }

        if (winScreen) winScreen.classList.add('visible');
        if (btnNext) btnNext.style.display = 'none';
        if (btnWait) { btnWait.style.display = 'block'; btnWait.textContent = '⏳ Ожидание...'; btnWait.disabled = true; }
    }

    const settings = { centerMap: true, followPlayer: false };
    try {
        const saved = JSON.parse(localStorage.getItem('kz_settings') || '{}');
        if (typeof saved.centerMap === 'boolean') settings.centerMap = saved.centerMap;
        if (typeof saved.followPlayer === 'boolean') settings.followPlayer = saved.followPlayer;
    } catch (e) {}

    function syncSettingsUI() {
        if (settingCenter) settingCenter.checked = settings.centerMap;
        if (settingFollow) settingFollow.checked = settings.followPlayer;
        if (pauseNickname && myPlayer) pauseNickname.value = myPlayer.nickname || 'Игрок';
    }
    syncSettingsUI();

    function saveSettings() { localStorage.setItem('kz_settings', JSON.stringify(settings)); }

    if (settingCenter) {
        settingCenter.addEventListener('change', () => {
            if (settingCenter.checked) { settingFollow.checked = false; settings.followPlayer = false; }
            settings.centerMap = settingCenter.checked;
            saveSettings();
        });
    }
    if (settingFollow) {
        settingFollow.addEventListener('change', () => {
            if (settingFollow.checked) { settingCenter.checked = false; settings.centerMap = false; }
            settings.followPlayer = settingFollow.checked;
            saveSettings();
        });
    }

    if (pauseNickname) {
        pauseNickname.addEventListener('input', () => {
            const nick = pauseNickname.value.trim() || 'Игрок';
            if (myPlayer) myPlayer.nickname = nick;
            try { localStorage.setItem('kz_nickname', nick); } catch (e) {}
            updateProfileUI();
        });
        pauseNickname.addEventListener('keydown', (e) => e.stopPropagation());
    }

    function updateCamera() {
        const maxX = Level.pixelWidth() - viewW;
        const maxY = Level.pixelHeight() - viewH;
        if (settings.followPlayer && myPlayer) {
            camX += (myPlayer.x + PlayerClass.PHYS.W / 2 - viewW / 2 - camX) * 0.1;
            camY += (myPlayer.y + PlayerClass.PHYS.H / 2 - viewH / 2 - camY) * 0.1;
        } else {
            camX = maxX / 2; camY = maxY / 2;
        }
        camX = Math.max(0, Math.min(maxX, camX));
        camY = Math.max(0, Math.min(maxY, camY));
    }

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

    // ЧАТ
    const chatOptions = { showTime: false, sound: true, showSystem: true };
    try {
        const saved = JSON.parse(localStorage.getItem('kz_chat') || '{}');
        if (typeof saved.showTime === 'boolean') chatOptions.showTime = saved.showTime;
        if (typeof saved.sound === 'boolean') chatOptions.sound = saved.sound;
        if (typeof saved.showSystem === 'boolean') chatOptions.showSystem = saved.showSystem;
    } catch (e) {}

    function saveChatOptions() { localStorage.setItem('kz_chat', JSON.stringify(chatOptions)); }

    if (chatShowTime) { chatShowTime.checked = chatOptions.showTime; chatShowTime.addEventListener('change', () => { chatOptions.showTime = chatShowTime.checked; saveChatOptions(); renderChat(); }); }
    if (chatSound) { chatSound.checked = chatOptions.sound; chatSound.addEventListener('change', () => { chatOptions.sound = chatSound.checked; saveChatOptions(); }); }
    if (chatSystem) { chatSystem.checked = chatOptions.showSystem; chatSystem.addEventListener('change', () => { chatOptions.showSystem = chatSystem.checked; saveChatOptions(); renderChat(); }); }

    function showEmote(player, emoji) {
        if (!player) return;
        player.chatBubble = emoji;
        player.chatBubbleTime = Date.now();
    }
    
    var chatHistory = [];
    function addChatMessage(author, text, isSystem = false, color = '#88ffcc') {
        const now = new Date();
        const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        chatHistory.push({ author, text, time, isSystem, color });
        renderChat();
        if (!isSystem && chatOptions.sound && window.Audio) Audio.play(660, 0.08, 'sine', 0.04);
    }

    function renderChat() {
        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        for (const msg of chatHistory) {
            if (msg.isSystem && !chatOptions.showSystem) continue;
            const el = document.createElement('div');
            el.className = 'chat-msg';
            const authorColor = msg.isSystem ? '#88ffcc' : (msg.color || '#88ffcc');
            el.innerHTML = (chatOptions.showTime ? `<span class="chat-time">${msg.time}</span>` : '') + 
                           `<span class="chat-author" style="color: ${authorColor};">${escapeHtml(msg.author)}:</span> ` + 
                           `<span class="chat-text">${escapeHtml(msg.text)}</span>`;
            chatMessages.appendChild(el);
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function escapeHtml(str) { return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
    addChatMessage('Система', 'Добро пожаловать!', true);

    if (chatSend) chatSend.addEventListener('click', sendChat);
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                sendChat(); 
                chatInput.blur();
            }
            if (e.key === 'Escape') { 
                chatInput.blur();
            }
            e.stopPropagation();
        });
    }

    function sendChat() {
        if (!chatInput || !myPlayer) return;
        const text = (chatInput.value || '').trim();
        if (!text) return;
        
        myPlayer.chatBubble = text;
        myPlayer.chatBubbleTime = Date.now();
        
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ 
                type: 'chat', 
                author: myPlayer.nickname || 'Игрок', 
                text: text,
                color: myPlayer.nickColor || '#88ffcc'
            }));
        }
        addChatMessage(myPlayer.nickname || 'Игрок', text, false, myPlayer.nickColor);
        chatInput.value = '';
    }

    if (chatToggle && chatBox) { chatToggle.addEventListener('click', () => { chatBox.classList.toggle('collapsed'); chatToggle.textContent = chatBox.classList.contains('collapsed') ? '+' : '—'; }); }
    if (chatSettingsBtn && chatSettings) { chatSettingsBtn.addEventListener('click', () => chatSettings.classList.toggle('hidden')); }
    if (chatClear) { chatClear.addEventListener('click', () => { chatHistory.length = 0; addChatMessage('Система', 'История очищена', true); }); }

    if (chatResizer && chatBox) {
        let isResizing = false, startY = 0, startHeight = 0;
        chatResizer.addEventListener('mousedown', (e) => { e.preventDefault(); isResizing = true; startY = e.clientY; startHeight = chatBox.offsetHeight; document.body.style.cursor = 'ns-resize'; });
        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const delta = startY - e.clientY;
            const newHeight = Math.max(36, Math.min(600, startHeight + delta));
            chatBox.style.height = newHeight + 'px';
            if (newHeight <= 50) { chatBox.classList.add('collapsed'); if (chatToggle) chatToggle.textContent = '+'; }
            else { chatBox.classList.remove('collapsed'); if (chatToggle) chatToggle.textContent = '—'; }
        });
        window.addEventListener('mouseup', () => { if (isResizing) { isResizing = false; document.body.style.cursor = ''; try { localStorage.setItem('kz_chat_height', chatBox.offsetHeight); } catch (e) {} } });
    }

    try {
        const savedHeight = parseInt(localStorage.getItem('kz_chat_height') || '0', 10);
        if (savedHeight && chatBox) chatBox.style.height = Math.max(36, Math.min(600, savedHeight)) + 'px';
    } catch (e) {}

    function drawCompass() {
        if (!myPlayer) return;
        const px = myPlayer.x + PlayerClass.PHYS.W / 2;
        const py = myPlayer.y + PlayerClass.PHYS.H / 2;

        if (!myPlayer.hasNut && Level.state.collected.nuts < Level.state.totalNuts) {
            let nutPos = null;
            for (let y = 0; y < Level.height; y++) {
                for (let x = 0; x < Level.width; x++) {
                    if (Level.grid[y][x] === Level.TILE.NUT) {
                        nutPos = { x: x * Level.tileSize + Level.tileSize / 2, y: y * Level.tileSize + Level.tileSize / 2 };
                        break;
                    }
                }
                if (nutPos) break;
            }
            if (nutPos) drawPointer(nutPos.x, nutPos.y, px, py, '#ffcc33', '🌰');
        }

        const portal = Level.portal;
        const color = Level.isPortalOpen() ? '#88ffcc' : 'rgba(136, 255, 204, 0.4)';
        drawPointer(portal.x + portal.w / 2, portal.y + portal.h / 2, px, py, color, '🌀');
    }

    function drawPointer(targetX, targetY, playerX, playerY, color, icon) {
        const padX = 80, padY = 80;
        const screenTX = targetX - camX;
        const screenTY = targetY - camY;
        const onScreen = screenTX > 0 && screenTX < viewW && screenTY > 0 && screenTY < viewH;

        if (onScreen) {
            const pulse = Math.sin(performance.now() * 0.005) * 0.3 + 0.7;
            ctx.globalAlpha = pulse; ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(screenTX, screenTY - 40, 18, 0, Math.PI * 2); ctx.stroke();
            ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(icon, screenTX, screenTY - 40); ctx.globalAlpha = 1;
        } else {
            const dx = targetX - playerX; const dy = targetY - playerY; const angle = Math.atan2(dy, dx);
            let ax = viewW / 2 + Math.cos(angle) * (viewW / 2 - padX);
            let ay = viewH / 2 + Math.sin(angle) * (viewH / 2 - padY);
            ax = Math.max(padX, Math.min(viewW - padX, ax)); ay = Math.max(padY, Math.min(viewH - padY, ay));
            const pulse = Math.sin(performance.now() * 0.006) * 0.3 + 0.7;
            ctx.globalAlpha = pulse;
            ctx.save(); ctx.translate(ax, ay); ctx.rotate(angle); ctx.fillStyle = color;
            ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
            const ix = ax - Math.cos(angle) * 26; const iy = ay - Math.sin(angle) * 26;
            ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(icon, ix, iy);
            const dist = Math.round(Math.sqrt(dx * dx + dy * dy) / Level.tileSize);
            ctx.globalAlpha = pulse * 0.8; ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Montserrat", sans-serif';
            ctx.fillText(dist + 'м', ix, iy + 18); ctx.globalAlpha = 1;
        }
    }

    function loop() {
        if (window.__gameActive === false) {
            isLoopRunning = false;
            return;
        }

        isLoopRunning = true;

        if (!paused && myPlayer) {
            myPlayer.update();
            checkPickup();
            checkPortal();
            updateCamera();
            Tiles.updateParticles();
        }

        if (socket && socket.readyState === WebSocket.OPEN && myPlayer) {
            socket.send(JSON.stringify({
                type: 'move', id: myId, nickname: myPlayer.nickname || 'Игрок',
                x: myPlayer.x, y: myPlayer.y, facing: myPlayer.facing,
                vx: myPlayer.vx, vy: myPlayer.vy, squash: myPlayer.squash,
                skew: myPlayer.skew, flipAngle: myPlayer.flipAngle,
                flipSpeed: myPlayer.flipSpeed, hasNut: myPlayer.hasNut,
                customColor: myPlayer.customColor || '#ffd84a',
                nickColor: myPlayer.nickColor || '#d0e0ff'
            }));
        }

        Tiles.drawBackground(ctx, viewW, viewH, camX, camY);
        ctx.save();
        ctx.translate(-camX, -camY);
        Tiles.drawLevel(ctx, camX, camY, viewW, viewH);
        Tiles.drawParticles(ctx);
        
        const now = Date.now();
        for (const id in otherPlayers) {
            if (id === myId) continue;
            const op = otherPlayers[id];
            if (!op.lastUpdate || now - op.lastUpdate > 2500) {
                delete otherPlayers[id];
                delete window.otherPlayers[id];
                delete window.otherNicknames[id];
                continue;
            }
            op.update();
            op.draw(ctx);
        }
        
        if (myPlayer) myPlayer.draw(ctx);
        
        ctx.restore();

        if (!paused) drawCompass();
        requestAnimationFrame(loop);
    }

    function start() {
        window.__gameActive = false;
        isLoopRunning = false;
        document.addEventListener('click', () => { if (window.Audio) Audio.init(); }, { once: true });
        window.addEventListener('keydown', () => { if (window.Audio) Audio.init(); }, { once: true });
        
        ctx.fillStyle = '#a8c8ff';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Поиск игры...', viewW / 2, viewH / 2);

        findRoom().then(room => {
            connectToServer(room);
        });
    }

    function startRoundTimer() {
        if (roundTimerInterval) clearInterval(roundTimerInterval);
        roundTime = 300;
        if (hudTimer) {
            hudTimer.textContent = '05:00';
            hudTimer.classList.remove('danger');
        }

        roundTimerInterval = setInterval(() => {
            roundTime--;
            const m = Math.floor(roundTime / 60).toString().padStart(2, '0');
            const s = (roundTime % 60).toString().padStart(2, '0');
            if (hudTimer) hudTimer.textContent = `${m}:${s}`;

            if (roundTime <= 10) {
                if (hudTimer) hudTimer.classList.add('danger');
            } else {
                if (hudTimer) hudTimer.classList.remove('danger');
            }

            if (roundTime <= 0) {
                clearInterval(roundTimerInterval);
            }
        }, 1000);
    }

    // КНОПКИ
    if (btnNext) btnNext.addEventListener('click', () => { location.reload(); });
    if (btnRestart) btnRestart.addEventListener('click', () => location.reload());
    if (btnToMap) btnToMap.addEventListener('click', () => { 
        localStorage.removeItem('kz_current_room'); 
        localStorage.removeItem('kz_xp'); 
        localStorage.removeItem('kz_level'); 
        location.href = 'map.html'; 
    });
    if (btnResume) btnResume.addEventListener('click', resumeGame);
    if (btnPauseRestart) btnPauseRestart.addEventListener('click', () => location.reload());
    if (btnPauseSettings) btnPauseSettings.addEventListener('click', () => { if (pauseSettings) pauseSettings.classList.toggle('hidden'); });
    if (btnPauseMenu) btnPauseMenu.addEventListener('click', () => { 
        localStorage.removeItem('kz_current_room'); 
        localStorage.removeItem('kz_xp'); 
        localStorage.removeItem('kz_level'); 
        location.href = 'index.html'; 
    });

    if (profileMenuBtn) {
        profileMenuBtn.addEventListener('click', () => {
            if (window.__gameActive && !winScreen.classList.contains('visible')) {
                if (paused) resumeGame(); else pauseGame();
            }
        });
    }

    if (btnWait) {
        btnWait.addEventListener('click', () => {
            btnWait.textContent = '⏳ Ожидание...';
            btnWait.disabled = true;
        });
    }

    if (btnLeaveAlone) {
        btnLeaveAlone.addEventListener('click', () => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'leave', id: myId }));
            }
            localStorage.removeItem('kz_current_room');
            localStorage.removeItem('kz_xp');
            localStorage.removeItem('kz_level');
            setTimeout(() => { location.href = 'index.html'; }, 100);
        });
    }

    if (btnSoloNext) {
        btnSoloNext.addEventListener('click', () => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'leave', id: myId }));
            }
            localStorage.removeItem('kz_current_room');
            sessionStorage.removeItem('kz_after_finish');
            location.reload();
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;

        if (e.key.toLowerCase() === 't') {
            e.preventDefault();
            if (chatInput) chatInput.focus();
            return;
        }

        if (e.key.toLowerCase() === 'q' && !qPressed) {
            qPressed = true;
            holdTimer = setTimeout(() => {
                if (emoteWheel && wheelContainer) {
                    if (myPlayer) {
                        const screenX = myPlayer.x - camX + PlayerClass.PHYS.W / 2;
                        const screenY = myPlayer.y - camY + PlayerClass.PHYS.H / 2;
                        wheelContainer.style.left = `${screenX}px`;
                        wheelContainer.style.top = `${screenY}px`;
                    }
                    isWheelOpen = true;
                    emoteWheel.classList.add('visible');
                }
            }, 200);
        }

        if (qPressed && ['1', '2', '3', '4'].includes(e.key)) {
            clearTimeout(holdTimer);
            if (emoteWheel) emoteWheel.classList.remove('visible');
            isWheelOpen = false;
            
            const emojis = { '1': '❤️', '2': '😂', '3': '😢', '4': '😡' };
            const emoji = emojis[e.key];
            
            if (emoji && myPlayer) {
                showEmote(myPlayer, emoji);
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'emote', nickname: myPlayer.nickname, emoji: emoji }));
                }
            }
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            if (window.__gameActive && !winScreen.classList.contains('visible')) {
                if (paused) resumeGame(); else pauseGame();
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key.toLowerCase() === 'q') {
            qPressed = false;
            clearTimeout(holdTimer);
            if (isWheelOpen && emoteWheel) {
                emoteWheel.classList.remove('visible');
                isWheelOpen = false;
            }
        }
    });

    window.addEventListener('beforeunload', () => {
        if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    });
    
    document.querySelectorAll('.emote-sector').forEach(sector => {
        sector.addEventListener('click', (e) => {
            const emoji = e.currentTarget.innerText.replace(/[1-4]/g, '').trim();
            
            if (emoteWheel) {
                emoteWheel.classList.remove('visible');
            }
            isWheelOpen = false;
            
            if (emoji && myPlayer) {
                showEmote(myPlayer, emoji);
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'emote', nickname: myPlayer.nickname, emoji: emoji }));
                }
            }
        });
    });
    
    start();
})();
