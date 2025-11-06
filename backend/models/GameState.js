const { GAME_PHASES, WRITING_TIME, GUESSING_TIME } = require('../utils/constants');
const { calculatePoints } = require('../utils/helpers');

class GameState {
  constructor(room) {
    this.roomId = room.id;
    this.phase = GAME_PHASES.WRITING;
    const activePlayers = room.getActivePlayers();
    this.currentPlayer = activePlayers[room.currentRound % activePlayers.length];
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