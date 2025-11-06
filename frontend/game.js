class GameClient {
    constructor() {
        this.socket = io('https://game-production-8b3d.up.railway.app');
        this.username = '';
        this.currentRoom = null;
        this.gameState = null;
        this.timer = null;
        this.isSuperAdmin = false;
        this.adminPassword = '';
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
        this.initializeRouting();
    }

    initializeRouting() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.showPage(e.state.page);
            }
        });
        
        // Set initial state
        history.replaceState({ page: 'home-page' }, '', '/');
    }

    updateURL(path, page) {
        history.pushState({ page: page }, '', path);
    }

    initializeEventListeners() {
        // Home page
        document.getElementById('continue-btn').addEventListener('click', () => {
            const username = document.getElementById('username-input').value.trim();
            if (username) {
                this.username = username;
                this.showPage('room-page');
                this.loadRooms();
            } else {
                this.showToast('Masukkan nickname terlebih dahulu!', 'error');
            }
        });

        document.getElementById('admin-login-btn').addEventListener('click', () => {
            this.showPage('admin-login-page');
        });

        // Admin login page
        document.getElementById('admin-continue-btn').addEventListener('click', () => {
            const password = document.getElementById('admin-password').value.trim();
            if (password) {
                this.username = 'superadmin';
                this.adminPassword = password;
                this.isSuperAdmin = true;
                this.showPage('admin-page');
                this.loadAdminRooms();
            } else {
                this.showToast('Masukkan password admin!', 'error');
            }
        });

        document.getElementById('back-to-home-admin-btn').addEventListener('click', () => {
            this.showPage('home-page');
        });

        // Room page
        document.getElementById('create-room-btn').addEventListener('click', () => {
            const roomName = document.getElementById('room-name-input').value.trim();
            if (roomName) {
                this.socket.emit('create-room', { roomName, username: this.username });
            }
        });

        document.getElementById('refresh-rooms-btn').addEventListener('click', () => {
            this.loadRooms();
        });

        // Waiting page
        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.socket.emit('start-game', this.currentRoom.id);
        });

        document.getElementById('leave-room-btn').addEventListener('click', () => {
            if (this.currentRoom) {
                this.socket.emit('leave-room', { roomId: this.currentRoom.id });
                this.currentRoom = null;
            }
            this.showPage('room-page');
            this.loadRooms();
        });

        // Game page
        document.getElementById('submit-statements-btn').addEventListener('click', () => {
            this.submitStatements();
        });

        // Final page
        document.getElementById('back-to-rooms-btn').addEventListener('click', () => {
            if (this.isSuperAdmin) {
                this.showPage('admin-page');
                this.loadAdminRooms();
            } else {
                this.showPage('room-page');
                this.loadRooms();
            }
        });

        // Admin page
        document.getElementById('admin-refresh-btn').addEventListener('click', () => {
            this.loadAdminRooms();
        });

        document.getElementById('admin-logout-btn').addEventListener('click', () => {
            this.isSuperAdmin = false;
            this.adminPassword = '';
            this.username = '';
            this.showPage('home-page');
        });

        // Enter key support
        document.getElementById('username-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('continue-btn').click();
            }
        });

        document.getElementById('admin-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('admin-continue-btn').click();
            }
        });

        // Admin controls
        document.getElementById('skip-player-btn').addEventListener('click', () => {
            this.skipCurrentPlayer();
        });

        document.getElementById('force-leave-btn').addEventListener('click', () => {
            this.forceLeaveRoom();
        });
    }

    initializeSocketListeners() {

        this.socket.on('join-error', (message) => {
            this.showToast(message, 'error');
        });

        this.socket.on('player-joined', (players) => {
            if (this.currentRoom) {
                this.currentRoom.players = players;
                this.updatePlayersList();
            }
        });

        this.socket.on('rooms-list', (rooms) => {
            this.displayRooms(rooms);
        });

        this.socket.on('game-started', (gameState) => {
            this.gameState = gameState;
            this.showPage('game-page');
            this.updateGameState();
        });

        this.socket.on('statements-ready', (gameState) => {
            this.gameState = gameState;
            this.updateGameState();
        });

        this.socket.on('guess-submitted', (gameState) => {
            this.gameState = gameState;
            this.updateScoreboard();
        });

        this.socket.on('round-complete', (gameState) => {
            this.gameState = gameState;
            this.showRoundResults();
        });

        this.socket.on('game-complete', (finalScores) => {
            this.showFinalResults(finalScores);
        });

        this.socket.on('all-rooms-list', (rooms) => {
            this.displayAdminRooms(rooms);
        });

        this.socket.on('superadmin-error', (message) => {
            this.showToast(message, 'error');
        });

        this.socket.on('create-error', (message) => {
            this.showToast(message, 'error');
        });

        this.socket.on('room-created', (room) => {
            this.currentRoom = room;
            this.showToast('Room berhasil dibuat!', 'success');
            this.showWaitingRoom();
        });

        this.socket.on('room-joined', (room) => {
            this.currentRoom = room;
            this.showToast('Berhasil bergabung ke room!', 'success');
            this.showWaitingRoom();
        });

        this.socket.on('player-skipped', (gameState) => {
            this.gameState = gameState;
            this.updateGameState();
        });
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');
        
        // Update URL based on page
        switch(pageId) {
            case 'home-page':
                this.updateURL('/', pageId);
                break;
            case 'room-page':
                this.updateURL('/rooms', pageId);
                break;
            case 'waiting-page':
                this.updateURL('/room/' + (this.currentRoom?.name || 'waiting'), pageId);
                break;
            case 'game-page':
                this.updateURL('/game/' + (this.currentRoom?.name || 'playing'), pageId);
                break;
            case 'admin-page':
                this.updateURL('/admin', pageId);
                break;
            case 'admin-login-page':
                this.updateURL('/admin/login', pageId);
                break;
        }
    }

    loadRooms() {
        const roomsList = document.getElementById('rooms-list');
        roomsList.innerHTML = `
            <div class="loading-spinner text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Memuat room...</p>
            </div>
        `;
        this.socket.emit('get-rooms');
    }

    displayRooms(rooms) {
        const roomsList = document.getElementById('rooms-list');
        if (rooms.length === 0) {
            roomsList.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <p class="text-muted">Tidak ada room tersedia</p>
                    <small class="text-muted">Buat room baru untuk memulai permainan</small>
                </div>
            `;
            return;
        }

        roomsList.innerHTML = rooms.map(room => `
            <div class="room-item d-flex justify-content-between align-items-center slide-in-right">
                <div class="room-info">
                    <h4><i class="fas fa-door-open me-2 text-primary"></i>${room.name}</h4>
                    <p><i class="fas fa-users me-1"></i>${room.players}/${room.maxPlayers} pemain</p>
                </div>
                <button class="btn btn-primary btn-sm" onclick="gameClient.joinRoom('${room.id}')">
                    <i class="fas fa-sign-in-alt me-1"></i>Join
                </button>
            </div>
        `).join('');
    }

    joinRoom(roomId) {
        if (this.isSuperAdmin) {
            this.socket.emit('superadmin-join-room', { 
                roomId, 
                username: this.username, 
                password: this.adminPassword 
            });
        } else {
            this.socket.emit('join-room', { roomId, username: this.username });
        }
    }

    loadAdminRooms() {
        this.socket.emit('superadmin-get-all-rooms', {
            username: this.username,
            password: this.adminPassword
        });
    }

    displayAdminRooms(rooms) {
        const roomsList = document.getElementById('admin-rooms-list');
        if (rooms.length === 0) {
            roomsList.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-server fa-3x text-muted mb-3"></i>
                    <p class="text-muted">Tidak ada room aktif</p>
                </div>
            `;
            return;
        }

        roomsList.innerHTML = rooms.map(room => {
            const statusIcon = room.status === 'waiting' ? 'clock' : 
                              room.status === 'playing' ? 'play' : 'check';
            const statusColor = room.status === 'waiting' ? 'warning' : 
                               room.status === 'playing' ? 'success' : 'secondary';
            
            return `
                <div class="admin-room-item d-flex justify-content-between align-items-center mb-3 p-3 bg-light rounded">
                    <div class="room-info">
                        <h4><i class="fas fa-door-open me-2 text-primary"></i>${room.name}</h4>
                        <p class="mb-1"><i class="fas fa-users me-1"></i>${room.players}/${room.maxPlayers} pemain</p>
                        <small class="text-${statusColor}">
                            <i class="fas fa-${statusIcon} me-1"></i>Status: ${room.status}
                        </small>
                    </div>
                    <button class="btn btn-outline-danger btn-sm" onclick="gameClient.joinRoom('${room.id}')">
                        <i class="fas fa-eye me-1"></i>Observe
                    </button>
                </div>
            `;
        }).join('');
    }

    showWaitingRoom() {
        document.getElementById('room-title').textContent = `Room: ${this.currentRoom.name}`;
        this.updatePlayersList();
        
        const currentPlayer = this.currentRoom.players.find(p => p.username === this.username);
        const isHost = currentPlayer?.isHost;
        const isSuperAdmin = currentPlayer?.isSuperAdmin;
        
        document.getElementById('start-game-btn').style.display = (isHost || isSuperAdmin) ? 'block' : 'none';
        document.getElementById('admin-controls').style.display = isSuperAdmin ? 'block' : 'none';
        
        // Show/hide leave buttons based on user type
        if (isSuperAdmin) {
            document.getElementById('leave-room-btn').style.display = 'none';
        } else {
            document.getElementById('leave-room-btn').style.display = 'block';
        }
        
        this.showPage('waiting-page');
    }

    updatePlayersList() {
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = this.currentRoom.players.map(player => {
            let className = '';
            let roleText = 'Pemain';
            let roleIcon = 'fa-user';
            
            if (player.isSuperAdmin) {
                className = 'superadmin';
                roleText = 'SuperAdmin';
                roleIcon = 'fa-shield-alt';
            } else if (player.isHost) {
                className = 'host';
                roleText = 'Host';
                roleIcon = 'fa-crown';
            }
            
            const initials = player.username.substring(0, 2).toUpperCase();
            
            return `
                <div class="player-card ${className}">
                    <div class="player-avatar">
                        ${initials}
                    </div>
                    <div class="player-name">${player.username}</div>
                    <div class="player-role">
                        <i class="fas ${roleIcon} me-1"></i>${roleText}
                    </div>
                </div>
            `;
        }).join('');
    }

    updateGameState() {
        const { phase, currentPlayer, round, totalRounds } = this.gameState;
        
        document.getElementById('round-info').textContent = `Round ${round} of ${totalRounds}`;
        
        // Hide all phases
        document.querySelectorAll('.phase').forEach(phase => {
            phase.classList.remove('active');
        });

        const isCurrentPlayer = currentPlayer.username === this.username;
        const currentUserPlayer = this.gameState.players.find(p => p.username === this.username);
        const isSuperAdmin = currentUserPlayer?.isSuperAdmin;

        if (phase === 'writing') {
            if (isCurrentPlayer && !isSuperAdmin) {
                document.getElementById('writing-phase').classList.add('active');
                document.getElementById('writing-title').textContent = 'Giliran Anda Menulis!';
            } else {
                document.getElementById('waiting-phase').classList.add('active');
            }
            this.startTimer(120);
        } else if (phase === 'guessing') {
            if (!isCurrentPlayer && !isSuperAdmin) {
                this.showGuessingPhase();
            } else {
                document.getElementById('waiting-phase').classList.add('active');
            }
            this.startTimer(45);
        }

        this.updateScoreboard();
        
        // Show skip button for admin during active phases
        if (isSuperAdmin && (phase === 'writing' || phase === 'guessing')) {
            document.getElementById('skip-player-btn').style.display = 'block';
        } else {
            document.getElementById('skip-player-btn').style.display = 'none';
        }
    }

    submitStatements() {
        const truth1 = document.getElementById('truth1').value.trim();
        const truth2 = document.getElementById('truth2').value.trim();
        const lie = document.getElementById('lie').value.trim();

        if (!truth1 || !truth2 || !lie) {
            alert('Harap isi semua pernyataan!');
            return;
        }

        const statements = [truth1, truth2, lie];
        const lieIndex = 2;
        
        // Shuffle statements
        const shuffled = [...statements];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        const newLieIndex = shuffled.indexOf(lie);

        this.socket.emit('submit-statements', {
            roomId: this.currentRoom.id,
            statements: {
                statements: shuffled,
                lieIndex: newLieIndex
            }
        });

        // Clear inputs
        document.getElementById('truth1').value = '';
        document.getElementById('truth2').value = '';
        document.getElementById('lie').value = '';
    }

    showGuessingPhase() {
        document.getElementById('guessing-phase').classList.add('active');
        document.getElementById('guessing-title').textContent = 
            `Tebak mana yang bohong dari ${this.gameState.currentPlayer.username}!`;

        const statementsContainer = document.getElementById('statements-to-guess');
        statementsContainer.innerHTML = this.gameState.statements.statements.map((statement, index) => `
            <div class="guess-option" onclick="gameClient.selectGuess(${index})">
                ${statement}
            </div>
        `).join('');
    }

    selectGuess(index) {
        document.querySelectorAll('.guess-option').forEach((option, i) => {
            option.classList.toggle('selected', i === index);
        });

        this.socket.emit('submit-guess', {
            roomId: this.currentRoom.id,
            guess: index
        });
    }

    updateScoreboard() {
        const scoresList = document.getElementById('scores-list');
        const sortedPlayers = [...this.gameState.players].sort((a, b) => b.score - a.score);
        
        scoresList.innerHTML = sortedPlayers.map(player => `
            <div class="score-item ${player.username === this.gameState.currentPlayer.username ? 'current-player' : ''}">
                <span>${player.username}</span>
                <span>${player.score} pts</span>
            </div>
        `).join('');
    }

    showRoundResults() {
        document.querySelectorAll('.phase').forEach(phase => {
            phase.classList.remove('active');
        });
        
        document.getElementById('results-phase').classList.add('active');
        
        const resultsContainer = document.getElementById('round-results');
        const { statements, currentPlayer } = this.gameState;
        
        resultsContainer.innerHTML = `
            <h4>Pernyataan dari ${currentPlayer.username}:</h4>
            ${statements.statements.map((statement, index) => `
                <div class="statement-result ${index === statements.lieIndex ? 'lie' : 'truth'}">
                    ${statement} ${index === statements.lieIndex ? '(BOHONG)' : '(BENAR)'}
                </div>
            `).join('')}
        `;

        setTimeout(() => {
            this.updateGameState();
        }, 3000);
    }

    showFinalResults(finalScores) {
        this.showPage('final-page');
        
        const finalScoresContainer = document.getElementById('final-scores');
        finalScoresContainer.innerHTML = finalScores.map((player, index) => `
            <div class="final-score-item">
                <span>#${index + 1} ${player.username}</span>
                <span>${player.score} pts</span>
            </div>
        `).join('');
    }

    startTimer(seconds) {
        if (this.timer) clearInterval(this.timer);
        
        let timeLeft = seconds;
        const timerElement = document.getElementById('timer');
        
        this.timer = setInterval(() => {
            timerElement.textContent = timeLeft;
            timeLeft--;
            
            if (timeLeft < 0) {
                clearInterval(this.timer);
                timerElement.textContent = '0';
            }
        }, 1000);
    }

    skipCurrentPlayer() {
        if (this.isSuperAdmin && this.currentRoom) {
            this.socket.emit('admin-skip-player', {
                roomId: this.currentRoom.id,
                username: this.username,
                password: this.adminPassword
            });
        }
    }

    forceLeaveRoom() {
        if (this.isSuperAdmin) {
            this.showPage('admin-page');
            this.loadAdminRooms();
        }
    }

    showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }

        const toastId = 'toast-' + Date.now();
        const iconClass = type === 'success' ? 'fa-check-circle text-success' : 
                         type === 'error' ? 'fa-exclamation-circle text-danger' : 
                         'fa-info-circle text-info';

        const toastHTML = `
            <div id="${toastId}" class="toast align-items-center border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body d-flex align-items-center">
                        <i class="fas ${iconClass} me-2"></i>
                        ${message}
                    </div>
                    <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
        toast.show();

        // Remove toast element after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}

// Initialize game client
const gameClient = new GameClient();