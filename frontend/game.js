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
            // Always redirect to home page when back button is pressed
            this.handleBackNavigation();
        });
        
        // Prevent back button during game
        window.addEventListener('beforeunload', (e) => {
            if (this.currentRoom && this.gameState) {
                e.preventDefault();
                e.returnValue = 'Anda sedang dalam permainan. Yakin ingin keluar?';
            }
        });
        
        // Set initial state
        history.replaceState({ page: 'home-page' }, '', '/');
    }

    handleBackNavigation() {
        // Always go to home page when back button is pressed
        this.resetToHome();
    }

    resetToHome() {
        // Disconnect from current room if any
        if (this.currentRoom) {
            this.socket.emit('leave-room', { roomId: this.currentRoom.id });
        }
        
        // Reset all game state
        this.currentRoom = null;
        this.gameState = null;
        this.username = '';
        this.isSuperAdmin = false;
        
        // Clear any timers
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // Go to home page
        this.showPage('home-page');
        
        // Clear input fields
        document.getElementById('username-input').value = '';
        document.getElementById('room-name-input').value = '';
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
            this.leaveRoomAndCleanup();
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

        // Exit game functionality
        document.getElementById('exit-game-btn').addEventListener('click', () => {
            this.showExitGameModal();
        });

        document.getElementById('confirm-exit-game').addEventListener('click', () => {
            this.confirmExitGame();
        });
    }

    initializeSocketListeners() {

        this.socket.on('join-error', (message) => {
            this.showToast(message, 'error');
            // If duplicate username, suggest adding number
            if (message.includes('sudah digunakan')) {
                const suggestion = this.username + Math.floor(Math.random() * 100);
                this.showToast(`Coba gunakan: ${suggestion}`, 'info');
            }
        });

        this.socket.on('player-joined', (players) => {
            if (this.currentRoom) {
                this.currentRoom.players = players;
                this.updatePlayersList();
                this.updateHostControls();
            }
        });

        this.socket.on('rooms-list', (rooms) => {
            this.displayRooms(rooms);
        });

        this.socket.on('room-list-updated', (rooms) => {
            // Only update if we're on the rooms page
            if (document.getElementById('room-page').classList.contains('active')) {
                this.displayRooms(rooms);
            }
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

        this.socket.on('score-updated', (data) => {
            if (data.points > 0) {
                this.showToast(`+${data.points} poin! Total: ${data.newScore}`, 'success');
            } else if (data.points < 0) {
                this.showToast(`${data.points} poin! Total: ${data.newScore}`, 'error');
            } else {
                this.showToast('Tebakan salah! +0 poin', 'error');
            }
            // Update scoreboard immediately
            this.updateScoreboard();
        });

        this.socket.on('round-complete', (gameState) => {
            this.gameState = gameState;
            // Clear any existing timers
            if (this.countdownTimer) {
                clearInterval(this.countdownTimer);
                this.countdownTimer = null;
            }
            this.isCountdownRunning = false;
            this.showRoundResults();
        });

        this.socket.on('next-player', (gameState) => {
            this.gameState = gameState;
            // Clear any existing timers to prevent conflicts
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
            if (this.countdownTimer) {
                clearInterval(this.countdownTimer);
                this.countdownTimer = null;
            }
            this.isCountdownRunning = false;
            console.log('Next player:', gameState.currentPlayer.username);
            this.updateGameState();
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

        this.socket.on('left-game-confirmed', () => {
            this.currentRoom = null;
            this.gameState = null;
            if (this.isSuperAdmin) {
                this.showPage('admin-page');
                this.loadAdminRooms();
            } else {
                this.showPage('room-page');
                this.loadRooms();
            }
            this.showToast('Anda telah keluar dari permainan', 'info');
        });

        this.socket.on('room-cleanup-scheduled', (data) => {
            this.showToast(`Room akan dihapus dalam ${data.seconds} detik`, 'info');
        });

        this.socket.on('room-deleted', () => {
            if (this.currentRoom) {
                this.showToast('Room telah dihapus', 'info');
                this.leaveRoomAndCleanup();
            }
        });
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');
        
        // Update URL and push state to prevent back navigation issues
        switch(pageId) {
            case 'home-page':
                this.updateURL('/', pageId);
                // Push extra state to prevent going back
                history.pushState({ page: 'home-page' }, '', '/');
                break;
            case 'room-page':
                this.updateURL('/rooms', pageId);
                break;
            case 'waiting-page':
                this.updateURL('/room/' + (this.currentRoom?.name || 'waiting'), pageId);
                break;
            case 'game-page':
                this.updateURL('/game/' + (this.currentRoom?.name || 'playing'), pageId);
                // Push extra states to prevent back navigation during game
                history.pushState({ page: 'game-page', preventBack: true }, '', window.location.pathname);
                history.pushState({ page: 'game-page', preventBack: true }, '', window.location.pathname);
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
        this.updateHostControls();
        this.showPage('waiting-page');
    }

    updateHostControls() {
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
                this.startTimer(300); // Only show timer for current player
            } else {
                document.getElementById('waiting-phase').classList.add('active');
                // Hide timer for waiting players
                const timerElement = document.getElementById('timer');
                if (timerElement) {
                    timerElement.style.display = 'none';
                }
            }
        } else if (phase === 'guessing') {
            this.showGuessingPhase();
            this.startTimer(45); // Show 45-second timer for all during guessing
            // Show timer for guessing phase
            const timerElement = document.getElementById('timer');
            if (timerElement) {
                timerElement.style.display = 'block';
            }
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
            this.showToast('Harap isi semua pernyataan!', 'error');
            return;
        }

        const statements = [truth1, truth2, lie];
        const lieIndex = 2;

        this.socket.emit('submit-statements', {
            roomId: this.currentRoom.id,
            statements: {
                statements: statements,
                lieIndex: lieIndex
            }
        });

        // Clear inputs
        document.getElementById('truth1').value = '';
        document.getElementById('truth2').value = '';
        document.getElementById('lie').value = '';
    }

    showGuessingPhase() {
        document.getElementById('guessing-phase').classList.add('active');
        
        const isCurrentPlayer = this.gameState.currentPlayer.username === this.username;
        const currentUserPlayer = this.gameState.players.find(p => p.username === this.username);
        const isSuperAdmin = currentUserPlayer?.isSuperAdmin;
        
        if (isCurrentPlayer && !isSuperAdmin) {
            document.getElementById('guessing-title').textContent = 
                'Pernyataan Anda sedang ditebak oleh pemain lain!';
        } else {
            document.getElementById('guessing-title').textContent = 
                `Tebak mana yang bohong dari ${this.gameState.currentPlayer.username}!`;
        }

        const statementsContainer = document.getElementById('statements-to-guess');
        statementsContainer.innerHTML = this.gameState.statements.statements.map((statement, index) => `
            <div class="guess-option ${isCurrentPlayer && !isSuperAdmin ? 'disabled' : ''}" 
                 ${!isCurrentPlayer && !isSuperAdmin ? `onclick="gameClient.selectGuess(${index})"` : ''}>
                <div class="statement-text">${statement}</div>
                <div class="guess-indicator" style="display: none;">
                    <i class="fas fa-check-circle text-success"></i>
                    <i class="fas fa-times-circle text-danger"></i>
                </div>
            </div>
        `).join('');
    }

    selectGuess(index) {
        // Prevent multiple selections
        if (document.querySelector('.guess-option.selected')) {
            return;
        }

        document.querySelectorAll('.guess-option').forEach((option, i) => {
            if (i === index) {
                option.classList.add('selected');
                option.style.pointerEvents = 'none';
            } else {
                option.style.opacity = '0.5';
                option.style.pointerEvents = 'none';
            }
        });

        this.socket.emit('submit-guess', {
            roomId: this.currentRoom.id,
            guess: index
        });
    }

    updateScoreboard() {
        const scoresList = document.getElementById('scores-list');
        const sortedPlayers = [...this.gameState.players].sort((a, b) => b.score - a.score);
        
        scoresList.innerHTML = sortedPlayers.map((player, index) => {
            const isCurrentPlayer = player.username === this.gameState.currentPlayer.username;
            const isMyself = player.username === this.username;
            const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
            
            return `
                <div class="score-item ${isCurrentPlayer ? 'current-player' : ''} ${isMyself ? 'my-score' : ''}">
                    <div class="player-info">
                        <span class="rank">${rankIcon}</span>
                        <span class="username">${player.username}</span>
                    </div>
                    <span class="score">${player.score} pts</span>
                </div>
            `;
        }).join('');
    }

    showRoundResults() {
        document.querySelectorAll('.phase').forEach(phase => {
            phase.classList.remove('active');
        });
        
        document.getElementById('results-phase').classList.add('active');
        
        const resultsContainer = document.getElementById('round-results');
        const { statements, currentPlayer } = this.gameState;
        
        resultsContainer.innerHTML = `
            <div class="text-center mb-4">
                <h4><i class="fas fa-user-circle me-2 text-primary"></i>Pernyataan dari ${currentPlayer.username}:</h4>
                <div class="countdown-timer mt-3">
                    <span class="badge bg-warning fs-6">Pemain selanjutnya dalam <span id="next-countdown">10</span> detik</span>
                </div>
            </div>
            <div class="statements-results">
                ${statements.statements.map((statement, index) => `
                    <div class="statement-result ${index === statements.lieIndex ? 'lie' : 'truth'} mb-3 p-3 rounded">
                        <div class="d-flex align-items-center">
                            <i class="fas ${index === statements.lieIndex ? 'fa-times-circle text-danger' : 'fa-check-circle text-success'} me-2"></i>
                            <span class="flex-grow-1">${statement}</span>
                            <span class="badge ${index === statements.lieIndex ? 'bg-danger' : 'bg-success'} ms-2">
                                ${index === statements.lieIndex ? 'BOHONG' : 'BENAR'}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Start 10-second countdown
        this.startResultsCountdown();
    }

    startResultsCountdown() {
        let timeLeft = 10;
        const countdownElement = document.getElementById('next-countdown');
        
        if (countdownElement) {
            countdownElement.textContent = timeLeft;
        }
        
        // Clear any existing countdown
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
        
        // Prevent multiple timers for same room
        if (this.isCountdownRunning) {
            console.log('Countdown already running, skipping');
            return;
        }
        
        this.isCountdownRunning = true;
        
        this.countdownTimer = setInterval(() => {
            timeLeft--;
            if (countdownElement) {
                countdownElement.textContent = Math.max(0, timeLeft);
            }
            
            if (timeLeft <= 0) {
                clearInterval(this.countdownTimer);
                this.countdownTimer = null;
                this.isCountdownRunning = false;
                console.log('Timer reached 0, forcing next player');
                // Force move to next player if countdown reaches 0
                if (this.currentRoom && this.gameState) {
                    this.socket.emit('force-next-player', { roomId: this.currentRoom.id });
                }
            }
        }, 1000);
    }

    showGuessResults() {
        // Show correct/incorrect indicators on guess options
        const guessOptions = document.querySelectorAll('.guess-option');
        const { lieIndex } = this.gameState.statements;
        
        guessOptions.forEach((option, index) => {
            const indicator = option.querySelector('.guess-indicator');
            const checkIcon = indicator.querySelector('.fa-check-circle');
            const xIcon = indicator.querySelector('.fa-times-circle');
            
            if (index === lieIndex) {
                // This was the lie - show check for correct guess
                option.classList.add('correct-answer');
                checkIcon.style.display = 'inline';
                xIcon.style.display = 'none';
            } else {
                // This was truth - show X for wrong guess
                option.classList.add('wrong-answer');
                checkIcon.style.display = 'none';
                xIcon.style.display = 'inline';
            }
            
            indicator.style.display = 'block';
        });
    }

    showFinalResults(finalScores) {
        this.showPage('final-page');
        
        const finalScoresContainer = document.getElementById('final-scores');
        const topThree = finalScores.slice(0, 3);
        const others = finalScores.slice(3);
        
        let html = '';
        
        // Show podium with 2-1-3 layout
        if (topThree.length > 0) {
            html += '<div class="podium-container mb-5">';
            html += '<div class="podium-stage">';
            
            // Position 2 (left)
            if (topThree[1]) {
                html += `
                    <div class="podium-position second-place">
                        <div class="podium-player">
                            <div class="player-avatar silver">${topThree[1].username.substring(0, 2).toUpperCase()}</div>
                            <h4 class="player-name">${topThree[1].username}</h4>
                            <div class="player-score">${topThree[1].score} pts</div>
                        </div>
                        <div class="podium-base second">
                            <div class="podium-number">2</div>
                        </div>
                    </div>
                `;
            }
            
            // Position 1 (center)
            if (topThree[0]) {
                html += `
                    <div class="podium-position first-place">
                        <div class="podium-player">
                            <div class="crown">👑</div>
                            <div class="player-avatar gold">${topThree[0].username.substring(0, 2).toUpperCase()}</div>
                            <h4 class="player-name">${topThree[0].username}</h4>
                            <div class="player-score">${topThree[0].score} pts</div>
                        </div>
                        <div class="podium-base first">
                            <div class="podium-number">1</div>
                        </div>
                    </div>
                `;
            }
            
            // Position 3 (right)
            if (topThree[2]) {
                html += `
                    <div class="podium-position third-place">
                        <div class="podium-player">
                            <div class="player-avatar bronze">${topThree[2].username.substring(0, 2).toUpperCase()}</div>
                            <h4 class="player-name">${topThree[2].username}</h4>
                            <div class="player-score">${topThree[2].score} pts</div>
                        </div>
                        <div class="podium-base third">
                            <div class="podium-number">3</div>
                        </div>
                    </div>
                `;
            }
            
            html += '</div></div>';
        }
        
        // Show all players ranking (including top 3)
        html += '<div class="other-players-section">';
        html += '<h4 class="text-center mb-4"><i class="fas fa-list-ol me-2 text-primary"></i>Peringkat Lengkap</h4>';
        html += '<div class="other-scores">';
        
        finalScores.forEach((player, index) => {
            const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
            const isTopThree = index < 3;
            const cardClass = isTopThree ? 'border-warning bg-light' : '';
            
            html += `
                <div class="other-score-item d-flex justify-content-between align-items-center p-3 mb-2 rounded ${cardClass}">
                    <div class="d-flex align-items-center">
                        <span class="rank-badge me-3" style="font-size: 1.2rem; min-width: 40px; text-align: center;">${rankIcon}</span>
                        <div>
                            <div class="player-name fw-bold">${player.username}</div>
                            ${isTopThree ? '<small class="text-muted">🏆 Podium Finisher</small>' : ''}
                        </div>
                    </div>
                    <span class="score fw-bold text-primary" style="font-size: 1.1rem;">${player.score} pts</span>
                </div>
            `;
        });
        
        html += '</div></div>';
        
        finalScoresContainer.innerHTML = html;
        
        // Add confetti effect
        setTimeout(() => {
            this.showConfetti();
        }, 500);
        
        // Schedule room cleanup after 45 seconds
        setTimeout(() => {
            this.scheduleRoomCleanup();
        }, 45000);
    }

    showConfetti() {
        // Enhanced confetti effect
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
        const shapes = ['circle', 'square', 'triangle'];
        
        // Create multiple waves of confetti
        for (let wave = 0; wave < 3; wave++) {
            setTimeout(() => {
                for (let i = 0; i < 30; i++) {
                    const confetti = document.createElement('div');
                    const shape = shapes[Math.floor(Math.random() * shapes.length)];
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    const size = Math.random() * 8 + 6;
                    
                    confetti.style.position = 'fixed';
                    confetti.style.width = size + 'px';
                    confetti.style.height = size + 'px';
                    confetti.style.backgroundColor = color;
                    confetti.style.left = Math.random() * 100 + 'vw';
                    confetti.style.top = '-20px';
                    confetti.style.zIndex = '10000';
                    confetti.style.pointerEvents = 'none';
                    
                    if (shape === 'circle') {
                        confetti.style.borderRadius = '50%';
                    } else if (shape === 'triangle') {
                        confetti.style.width = '0';
                        confetti.style.height = '0';
                        confetti.style.backgroundColor = 'transparent';
                        confetti.style.borderLeft = size/2 + 'px solid transparent';
                        confetti.style.borderRight = size/2 + 'px solid transparent';
                        confetti.style.borderBottom = size + 'px solid ' + color;
                    }
                    
                    const duration = Math.random() * 3 + 2;
                    const delay = Math.random() * 0.5;
                    confetti.style.animation = `confetti-fall ${duration}s linear ${delay}s forwards`;
                    
                    document.body.appendChild(confetti);
                    
                    setTimeout(() => {
                        if (confetti.parentNode) {
                            confetti.remove();
                        }
                    }, (duration + delay) * 1000 + 500);
                }
            }, wave * 500);
        }
        
        // Add CSS animation if not exists
        if (!document.getElementById('confetti-style')) {
            const style = document.createElement('style');
            style.id = 'confetti-style';
            style.textContent = `
                @keyframes confetti-fall {
                    0% {
                        transform: translateY(-20px) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) rotate(720deg);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    startTimer(seconds) {
        if (this.timer) clearInterval(this.timer);
        
        let timeLeft = seconds;
        const timerElement = document.getElementById('timer');
        
        if (timerElement) {
            timerElement.style.display = 'block';
            timerElement.textContent = timeLeft;
        }
        
        this.timer = setInterval(() => {
            timeLeft--;
            if (timerElement) {
                timerElement.textContent = timeLeft;
            }
            
            if (timeLeft < 0) {
                clearInterval(this.timer);
                if (timerElement) {
                    timerElement.textContent = '0';
                }
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

    showExitGameModal() {
        const modal = new bootstrap.Modal(document.getElementById('exitGameModal'));
        modal.show();
    }

    confirmExitGame() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('exitGameModal'));
        modal.hide();
        
        this.socket.emit('confirm-leave-game', { roomId: this.currentRoom?.id });
    }

    scheduleRoomCleanup() {
        // Notify server to cleanup room after game ends
        if (this.currentRoom) {
            this.socket.emit('cleanup-room', { roomId: this.currentRoom.id });
        }
    }

    leaveRoomAndCleanup() {
        // Leave room and cleanup
        if (this.currentRoom) {
            this.socket.emit('exit-podium', { roomId: this.currentRoom.id });
            this.socket.emit('leave-room', { roomId: this.currentRoom.id });
            this.currentRoom = null;
        }
        
        this.gameState = null;
        
        if (this.isSuperAdmin) {
            this.showPage('admin-page');
            this.loadAdminRooms();
        } else {
            this.showPage('room-page');
            this.loadRooms();
        }
        
        this.showToast('Terima kasih telah bermain!', 'success');
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