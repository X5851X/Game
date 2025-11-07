const Player = require('./Player');
const { MAX_PLAYERS, ROOM_STATUS } = require('../utils/constants');

class Room {
  constructor(id, name, hostUsername, hostSocketId) {
    this.id = id;
    this.name = name;
    this.players = [new Player(hostSocketId, hostUsername, true)];
    this.status = ROOM_STATUS.WAITING;
    this.maxPlayers = MAX_PLAYERS;
    this.currentRound = 0;
    this.currentPlayerIndex = 0;
    this.gameState = null;
    this.createdAt = new Date();
    this.lastActivity = new Date();
  }

  addPlayer(socketId, username, isSuperAdmin = false) {
    if (!isSuperAdmin && this.players.length >= this.maxPlayers) {
      return { success: false, message: 'Room is full' };
    }
    
    if (!isSuperAdmin && this.status !== ROOM_STATUS.WAITING) {
      return { success: false, message: 'Game already started' };
    }

    // Check for duplicate username (case-insensitive)
    const existingPlayer = this.players.find(p => 
      p.username.toLowerCase() === username.toLowerCase() && !p.isSuperAdmin
    );
    if (existingPlayer && !isSuperAdmin) {
      return { success: false, message: 'Username sudah digunakan di room ini' };
    }

    this.lastActivity = new Date();
    const player = new Player(socketId, username, false, isSuperAdmin);
    this.players.push(player);
    return { success: true, player };
  }

  removePlayer(socketId) {
    const index = this.players.findIndex(p => p.id === socketId);
    if (index !== -1) {
      const removedPlayer = this.players[index];
      this.players.splice(index, 1);
      
      // If the removed player was the host, assign host to the last non-superadmin player
      if (removedPlayer.isHost && this.players.length > 0) {
        const activePlayers = this.players.filter(p => !p.isSuperAdmin);
        if (activePlayers.length > 0) {
          // Make the last active player the new host
          const lastPlayer = activePlayers[activePlayers.length - 1];
          lastPlayer.isHost = true;
        }
      }
      
      return true;
    }
    return false;
  }

  getPlayer(socketId) {
    return this.players.find(p => p.id === socketId);
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextPlayer() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
  }

  canStart() {
    const activePlayers = this.getActivePlayers();
    return activePlayers.length >= 2 && this.status === ROOM_STATUS.WAITING;
  }

  isEmpty() {
    return this.players.length === 0;
  }

  getPlayersData() {
    return this.players.map(p => ({
      id: p.id,
      username: p.username,
      score: p.score,
      isHost: p.isHost,
      isSuperAdmin: p.isSuperAdmin
    }));
  }

  getActivePlayers() {
    return this.players.filter(p => !p.isSuperAdmin);
  }

  getNextActivePlayerIndex() {
    const activePlayers = this.getActivePlayers();
    return this.players.findIndex(p => p.id === activePlayers[this.currentRound % activePlayers.length].id);
  }
}

module.exports = Room;