class SocketManager {
  constructor(io, roomManager, gameManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.gameManager = gameManager;
    this.playerSockets = new Map();
  }

  handleConnection(socket) {

    socket.on('create-room', (data) => {
      const result = this.roomManager.createRoom(data.roomName, data.username, socket.id);
      if (result.success) {
        socket.join(result.room.id);
        this.playerSockets.set(socket.id, result.room.id);
        socket.emit('room-created', result.room);
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
        }
      }
    });

    socket.on('submit-statements', (data) => {
      const result = this.gameManager.submitStatements(data.roomId, data.statements);
      if (result.success) {
        this.io.to(data.roomId).emit('statements-ready', result.gameState);
      }
    });

    socket.on('submit-guess', (data) => {
      const room = this.roomManager.getRoom(data.roomId);
      if (room) {
        const result = this.gameManager.submitGuess(data.roomId, socket.id, data.guess, room);
        if (result.success) {
          this.io.to(data.roomId).emit('guess-submitted', result.gameState);
          
          if (result.roundComplete) {
            setTimeout(() => {
              this.io.to(data.roomId).emit('round-complete', result.gameState);
            }, 2000);
          }
          
          if (result.gameComplete) {
            setTimeout(() => {
              this.io.to(data.roomId).emit('game-complete', result.finalScores);
              // Delete room after game is complete
              setTimeout(() => {
                this.roomManager.deleteRoom(data.roomId);
              }, 10000); // Delete room 10 seconds after game ends
            }, 4000);
          }
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
        // Only emit update if room still exists (not deleted)
        if (room) {
          this.io.to(roomId).emit('player-joined', room.getPlayersData());
        }
        this.playerSockets.delete(socket.id);
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
      // Only emit update if room still exists (not deleted)
      if (room) {
        this.io.to(roomId).emit('player-joined', room.getPlayersData());
      }
      this.playerSockets.delete(socketId);
    }
  }
}

module.exports = SocketManager;