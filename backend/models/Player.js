class Player {
  constructor(id, username, isHost = false, isSuperAdmin = false) {
    this.id = id;
    this.username = username;
    this.score = 0;
    this.isHost = isHost;
    this.isSuperAdmin = isSuperAdmin;
    this.hasPlayed = false;
    this.currentGuess = null;
  }

  addScore(points) {
    this.score += points;
  }

  resetGuess() {
    this.currentGuess = null;
  }

  setGuess(guess) {
    this.currentGuess = guess;
  }
}

module.exports = Player;