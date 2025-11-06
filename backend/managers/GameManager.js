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

    // Shuffle statements to prevent pattern recognition
    const shuffledData = this.shuffleStatements(statements.statements, statements.lieIndex);
    gameState.setStatements(shuffledData.statements, shuffledData.lieIndex);
    return { success: true, gameState };
  }

  shuffleStatements(statements, originalLieIndex) {
    const shuffled = [...statements];
    const lieStatement = statements[originalLieIndex];
    
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Find new lie index after shuffle
    const newLieIndex = shuffled.indexOf(lieStatement);
    return { statements: shuffled, lieIndex: newLieIndex };
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

    // Update gameState with current room data
    gameState.players = room.getPlayersData();

    const allGuessed = gameState.allPlayersGuessed(room);
    let roundComplete = false;
    let gameComplete = false;

    if (allGuessed) {
      roundComplete = true;
      // Don't increment round here, do it in nextRound method
    }

    return {
      success: true,
      gameState,
      roundComplete,
      gameComplete: false
    };
  }

  getFinalScores(room) {
    return room.getActivePlayers()
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        rank: index + 1,
        username: player.username,
        score: player.score,
        isWinner: index < 3 // Top 3 are winners
      }));
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

  nextRound(roomId, room) {
    room.currentRound++;
    const activePlayers = room.getActivePlayers();
    
    if (room.currentRound >= activePlayers.length) {
      // Game complete
      room.status = 'finished';
      this.activeGames.delete(roomId);
      return {
        gameComplete: true,
        finalScores: this.getFinalScores(room)
      };
    } else {
      // Next round
      const newGameState = new GameState(room);
      this.activeGames.set(roomId, newGameState);
      room.gameState = newGameState;
      return {
        gameComplete: false,
        gameState: newGameState
      };
    }
  }

  endGame(roomId) {
    this.activeGames.delete(roomId);
  }
}

module.exports = GameManager;