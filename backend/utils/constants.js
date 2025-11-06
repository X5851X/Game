const GAME_CONSTANTS = {
  MAX_PLAYERS: 20,
  MIN_PLAYERS: 2,
  WRITING_TIME: 60,
  GUESSING_TIME: 45,
  POINTS: {
    FAST: 10,
    MEDIUM: 5,
    SLOW: 2,
    TIMEOUT: 0
  },
  ROOM_STATUS: {
    WAITING: 'waiting',
    PLAYING: 'playing',
    FINISHED: 'finished'
  },
  GAME_PHASES: {
    WRITING: 'writing',
    GUESSING: 'guessing',
    RESULTS: 'results'
  }
};

module.exports = GAME_CONSTANTS;