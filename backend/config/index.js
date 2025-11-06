const config = {
  port: process.env.PORT || 3001,
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"]
  },
  cleanup: {
    interval: 5 * 60 * 1000 // 5 minutes
  },
  superadmin: {
    username: 'superadmin',
    password: 'admin123'
  }
};

module.exports = config;