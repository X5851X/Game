const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const config = require('./config');
const RoomManager = require('./managers/RoomManager');
const GameManager = require('./managers/GameManager');
const SocketManager = require('./managers/SocketManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: config.cors
});

app.use(cors());
app.use(express.json());

const roomManager = new RoomManager();
const gameManager = new GameManager();
const socketManager = new SocketManager(io, roomManager, gameManager);

io.on('connection', (socket) => {
  socketManager.handleConnection(socket);
});

// Cleanup empty rooms periodically
setInterval(() => {
  roomManager.cleanupEmptyRooms();
}, config.cleanup.interval);

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});