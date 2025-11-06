const config = {
  port: process.env.PORT || 3001,
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000", "https://two-truth-one-lie-game.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true
  },
  cleanup: {
    interval: 2 * 60 * 1000 // 2 minutes - more frequent cleanup
  },
  superadmin: {
    username: 'superadmin',
    password: 'admin123'
  },
  limits: {
    maxRooms: 10, // Limit concurrent rooms
    maxPlayersPerRoom: 20,
    gameTimeout: 10 * 60 * 1000 // 10 minutes max per game
  }
};

module.exports = config;