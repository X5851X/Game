class SocketManager {
  constructor(io, roomManager, gameManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.gameManager = gameManager;
    this.playerSockets = new Map();
    
    // Start periodic cleanup for inactive rooms
    this.startInactiveRoomCleanup();
  }

  startInactiveRoomCleanup() {
    setInterval(() => {
      const deletedRooms = this.roomManager.cleanupInactiveRooms();
      if (deletedRooms.length > 0) {
        // Update room list for all clients
        this.io.emit('room-list-updated', this.roomManager.getAvailableRooms());
      }
    }, 300000); // Check every 5 minutes
  }

  handleConnection(socket) {

    socket.on('create-room', (data) => {
      const result = this.roomManager.createRoom(data.roomName, data.username, socket.id);
      if (result.success) {
        socket.join(result.room.id);
        this.playerSockets.set(socket.id, result.room.id);
        socket.emit('room-created', result.room);
        // Broadcast new room to all clients
        this.io.emit('room-list-updated', this.roomManager.getAvailableRooms());
      } else {
        socket.emit('create-error', result.message);
      }
    });

    socket.on('join-room', (data) => {
      const isSuperAdmin = data.password && this.roomManager.isSuperAdmin(data.username, data.password);
      const result = this.roomManager.joinRoom(data.roomId, data.username, socket.id, isSuperAdmin);
      if (result.success) {
        socket.join(data.roomId);
        this.playerSockets.set(socket.id, data.roomId);
        socket.emit('room-joined', result.room);
        this.io.to(data.roomId).emit('player-joined', result.room.getPlayersData());
        // Update room list for all clients
        this.io.emit('room-list-updated', this.roomManager.getAvailableRooms());
      } else {
        socket.emit('join-error', result.message);
      }
    });

    socket.on('start-game', (roomId) => {
      const room = this.roomManager.getRoom(roomId);
      if (room) {
        if (!room.canStart()) {
          socket.emit('join-error', 'Minimal 2 pemain untuk memulai permainan');
          return;
        }
        const result = this.gameManager.startGame(room);
        if (result.success) {
          this.io.to(roomId).emit('game-started', result.gameState);
          
          // Start 300-second timeout for writing
          setTimeout(() => {
            const currentRoom = this.roomManager.getRoom(roomId);
            if (currentRoom && currentRoom.gameState && currentRoom.gameState.phase === 'writing') {
              // Skip current player if they haven't submitted
              const skipResult = this.gameManager.skipCurrentPlayer(roomId, currentRoom);
              if (skipResult.success) {
                if (skipResult.gameComplete) {
                  this.io.to(roomId).emit('game-complete', skipResult.finalScores);
                } else {
                  this.io.to(roomId).emit('player-skipped', skipResult.gameState);
                }
              }
            }
          }, 300000); // 5 minutes
        }
      }
    });

    socket.on('submit-statements', (data) => {
      const room = this.roomManager.getRoom(data.roomId);
      if (!room) {
        socket.emit('join-error', 'Room not found');
        return;
      }
      
      const result = this.gameManager.submitStatements(data.roomId, data.statements, room);
      if (result.success) {
        this.io.to(data.roomId).emit('statements-ready', result.gameState);
        
        // Auto-timeout after 45 seconds if not all players have guessed
        setTimeout(() => {
          const currentRoom = this.roomManager.getRoom(data.roomId);
          if (currentRoom && currentRoom.gameState && currentRoom.gameState.phase === 'guessing') {
            this.io.to(data.roomId).emit('round-complete', currentRoom.gameState);
          }
        }, 45000);
      }
    });

    socket.on('submit-guess', (data) => {
      const room = this.roomManager.getRoom(data.roomId);
      if (room) {
        const result = this.gameManager.submitGuess(data.roomId, socket.id, data.guess, room);
        if (result.success) {
          // Send immediate score update to the player who guessed
          socket.emit('score-updated', {
            playerId: socket.id,
            points: result.pointsEarned,
            newScore: result.playerScore
          });
          
          // Send updated game state to all players
          this.io.to(data.roomId).emit('guess-submitted', result.gameState);
          
          // Don't show results immediately - wait for 45 second timer to complete
          // Timer is already set in submit-statements event
        }
      }
    });

    socket.on('get-rooms', () => {
      socket.emit('rooms-list', this.roomManager.getAvailableRooms());
    });

    socket.on('superadmin-get-all-rooms', (data) => {
      if (this.roomManager.isSuperAdmin(data.username, data.password)) {
        socket.emit('all-rooms-list', this.roomManager.getAllRooms());
      } else {
        socket.emit('superadmin-error', 'Invalid credentials');
      }
    });

    socket.on('superadmin-join-room', (data) => {
      if (this.roomManager.isSuperAdmin(data.username, data.password)) {
        const result = this.roomManager.joinRoom(data.roomId, data.username, socket.id, true);
        if (result.success) {
          socket.join(data.roomId);
          this.playerSockets.set(socket.id, data.roomId);
          socket.emit('room-joined', result.room);
          this.io.to(data.roomId).emit('player-joined', result.room.getPlayersData());
        } else {
          socket.emit('join-error', result.message);
        }
      } else {
        socket.emit('superadmin-error', 'Invalid credentials');
      }
    });

    socket.on('admin-skip-player', (data) => {
      if (this.roomManager.isSuperAdmin(data.username, data.password)) {
        const room = this.roomManager.getRoom(data.roomId);
        if (room && room.status === 'playing') {
          const result = this.gameManager.skipCurrentPlayer(data.roomId, room);
          if (result.success) {
            this.io.to(data.roomId).emit('player-skipped', result.gameState);
            if (result.gameComplete) {
              setTimeout(() => {
                this.io.to(data.roomId).emit('game-complete', result.finalScores);
                // Mark room as finished
                room.status = 'finished';
              }, 2000);
            }
          }
        }
      } else {
        socket.emit('superadmin-error', 'Invalid credentials');
      }
    });

    socket.on('leave-room', (data) => {
      const roomId = this.playerSockets.get(socket.id);
      if (roomId) {
        socket.leave(roomId);
        const room = this.roomManager.removePlayerFromRooms(socket.id);
        if (room) {
          this.io.to(roomId).emit('player-joined', room.getPlayersData());
          // Check if room is empty after player leaves
          if (room.players.length === 0) {
            this.roomManager.deleteRoom(roomId);
          }
        }
        this.playerSockets.delete(socket.id);
        this.io.emit('room-list-updated', this.roomManager.getAvailableRooms());
      }
    });

    socket.on('confirm-leave-game', (data) => {
      const roomId = this.playerSockets.get(socket.id);
      if (roomId) {
        socket.leave(roomId);
        const room = this.roomManager.removePlayerFromRooms(socket.id);
        if (room) {
          this.io.to(roomId).emit('player-joined', room.getPlayersData());
          // Check if room is empty after player leaves
          if (room.players.length === 0) {
            this.roomManager.deleteRoom(roomId);
          }
        }
        this.playerSockets.delete(socket.id);
        socket.emit('left-game-confirmed');
        this.io.emit('room-list-updated', this.roomManager.getAvailableRooms());
      }
    });

    socket.on('force-next-player', (data) => {
      const room = this.roomManager.getRoom(data.roomId);
      if (room && room.status === 'playing') {
        console.log('Force next player triggered for room:', data.roomId);
        const gameResult = this.gameManager.nextRound(data.roomId, room);
        if (gameResult.gameComplete) {
          this.io.to(data.roomId).emit('game-complete', gameResult.finalScores);
          room.status = 'finished';
        } else {
          console.log('Moving to next player:', gameResult.gameState.currentPlayer.username);
          this.io.to(data.roomId).emit('next-player', gameResult.gameState);
        }
      } else {
        console.log('Room not found or not playing:', data.roomId, room?.status);
      }
    });

    socket.on('exit-podium', (data) => {
      const room = this.roomManager.getRoom(data.roomId);
      if (room) {
        this.roomManager.deleteRoom(data.roomId);
        this.io.emit('room-list-updated', this.roomManager.getAvailableRooms());
      }
    });

    socket.on('disconnect', () => {
      this.handleDisconnect(socket.id);
    });
  }

  handleDisconnect(socketId) {
    const roomId = this.playerSockets.get(socketId);
    if (roomId) {
      const room = this.roomManager.removePlayerFromRooms(socketId);
      if (room) {
        this.io.to(roomId).emit('player-joined', room.getPlayersData());
        if (room.players.length === 0) {
          this.roomManager.deleteRoom(roomId);
        }
      }
      this.playerSockets.delete(socketId);
      this.io.emit('room-list-updated', this.roomManager.getAvailableRooms());
    }
  }
}

module.exports = SocketManager;