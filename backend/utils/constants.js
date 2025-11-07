const MAX_PLAYERS = 20;
const MIN_PLAYERS = 2;
const WRITING_TIME = 300; // 5 minutes for writing
const GUESSING_TIME = 45;

const POINTS = {
  FAST: 10,
  MEDIUM: 5,
  SLOW: 2,
  TIMEOUT: 0,
  WRONG: -5
};

const ROOM_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished'
};

const GAME_PHASES = {
  WRITING: 'writing',
  GUESSING: 'guessing',
  RESULTS: 'results'
};

module.exports = {
  MAX_PLAYERS,
  MIN_PLAYERS,
  WRITING_TIME,
  GUESSING_TIME,
  POINTS,
  ROOM_STATUS,
  GAME_PHASES
};