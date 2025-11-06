const GameState = require('../models/GameState');
const { ROOM_STATUS } = require('../utils/constants');

class GameManager {
  constructor() {
    this.activeGames = new Map();
  }

  startGame(room) {
    const activePlayers = room.getActivePlayers();
    if (activePlayers.length < 2) {
      return { success: false, message: 'Need at least 2 active players' };
    }

    room.status = ROOM_STATUS.PLAYING;
    room.currentRound = 0;

    const gameState = new GameState(room);
    this.activeGames.set(room.id, gameState);
    room.gameState = gameState;

    return { success: true, gameState };
  }

  submitStatements(roomId, statements) {
    const gameState = this.activeGames.get(roomId);
    if (!gameState) {
      return { success: false, message: 'Game not found' };
    }

    gameState.setStatements(statements.statements, statements.lieIndex);
    return { success: true, gameState };
  }

  submitGuess(roomId, playerId, guess, room) {
    const gameState = this.activeGames.get(roomId);
    if (!gameState) {
      return { success: false, message: 'Game not found' };
    }

    const points = gameState.addGuess(playerId, guess, gameState.timeLeft);
    const player = room.getPlayer(playerId);
    if (player) {
      player.addScore(points);
    }

    const allGuessed = gameState.allPlayersGuessed(room);
    let roundComplete = false;
    let gameComplete = false;

    if (allGuessed) {
      roundComplete = true;
      room.currentRound++;
      
      const activePlayers = room.getActivePlayers();
      if (room.currentRound >= activePlayers.length) {
        gameComplete = true;
        room.status = ROOM_STATUS.FINISHED;
        this.activeGames.delete(roomId);
      } else {
        const newGameState = new GameState(room);
        this.activeGames.set(roomId, newGameState);
        room.gameState = newGameState;
      }
    }

    return {
      success: true,
      gameState,
      roundComplete,
      gameComplete,
      finalScores: gameComplete ? room.getActivePlayers().sort((a, b) => b.score - a.score) : null
    };
  }

  getGameState(roomId) {
    return this.activeGames.get(roomId);
  }

  skipCurrentPlayer(roomId, room) {
    const gameState = this.activeGames.get(roomId);
    if (!gameState) {
      return { success: false, message: 'Game not found' };
    }

    // Move to next round
    room.currentRound++;
    const activePlayers = room.getActivePlayers();
    
    if (room.currentRound >= activePlayers.length) {
      // Game complete
      room.status = ROOM_STATUS.FINISHED;
      this.activeGames.delete(roomId);
      return {
        success: true,
        gameComplete: true,
        finalScores: activePlayers.sort((a, b) => b.score - a.score)
      };
    } else {
      // Next round
      const newGameState = new GameState(room);
      this.activeGames.set(roomId, newGameState);
      room.gameState = newGameState;
      return {
        success: true,
        gameState: newGameState,
        gameComplete: false
      };
    }
  }

  endGame(roomId) {
    this.activeGames.delete(roomId);
  }
}

module.exports = GameManager;