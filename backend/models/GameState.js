const { GAME_PHASES, WRITING_TIME, GUESSING_TIME } = require('../utils/constants');
const { calculatePoints } = require('../utils/helpers');

class GameState {
  constructor(room) {
    this.roomId = room.id;
    this.phase = GAME_PHASES.WRITING;
    const activePlayers = room.getActivePlayers();
    
    // Select random player who hasn't played yet
    const unplayedPlayers = activePlayers.filter(p => !p.hasPlayed);
    console.log('Active players:', activePlayers.map(p => ({ username: p.username, hasPlayed: p.hasPlayed })));
    console.log('Unplayed players:', unplayedPlayers.map(p => p.username));
    
    if (unplayedPlayers.length > 0) {
      const randomIndex = Math.floor(Math.random() * unplayedPlayers.length);
      this.currentPlayer = {
        id: unplayedPlayers[randomIndex].id,
        username: unplayedPlayers[randomIndex].username,
        isHost: unplayedPlayers[randomIndex].isHost,
        isSuperAdmin: unplayedPlayers[randomIndex].isSuperAdmin
      };
    } else {
      // All players have played, game should end
      this.currentPlayer = {
        id: activePlayers[0].id,
        username: activePlayers[0].username,
        isHost: activePlayers[0].isHost,
        isSuperAdmin: activePlayers[0].isSuperAdmin
      };
    }
    
    this.round = room.currentRound + 1;
    this.totalRounds = activePlayers.length;
    this.players = room.getPlayersData();
    this.statements = null;
    this.guesses = new Map();
    this.timeLeft = WRITING_TIME;
    this.roundResults = null;
  }

  setStatements(statements, lieIndex) {
    this.statements = {
      statements,
      lieIndex
    };
    this.phase = GAME_PHASES.GUESSING;
    this.timeLeft = GUESSING_TIME;
    this.guesses.clear();
  }

  addGuess(playerId, guess, timeLeft) {
    let points = 0;
    if (guess === this.statements.lieIndex) {
      points = calculatePoints(timeLeft, GUESSING_TIME);
    }

    this.guesses.set(playerId, { guess, points, timeLeft });
    return points;
  }

  allPlayersGuessed(room) {
    const activePlayers = room.getActivePlayers();
    const currentPlayerId = this.currentPlayer.id;
    const activePlayersWhoShouldGuess = activePlayers.filter(p => p.id !== currentPlayerId);
    return this.guesses.size >= activePlayersWhoShouldGuess.length;
  }

  getRoundResults() {
    const results = {
      statements: this.statements,
      currentPlayer: this.currentPlayer,
      guesses: Array.from(this.guesses.entries()).map(([playerId, data]) => ({
        playerId,
        ...data
      }))
    };
    return results;
  }
}

module.exports = GameState;