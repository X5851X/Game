const Room = require('../models/Room');
const { generateRoomId, validateUsername, validateRoomName } = require('../utils/helpers');
const { ROOM_STATUS } = require('../utils/constants');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomName, username, socketId) {
    if (!validateRoomName(roomName) || !validateUsername(username)) {
      return { success: false, message: 'Invalid room name or username' };
    }
    
    const roomId = generateRoomId();
    const room = new Room(roomId, roomName, username, socketId);
    this.rooms.set(roomId, room);
    return { success: true, room };
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId, username, socketId, isSuperAdmin = false) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, message: 'Room not found' };
    }

    // Regular players cannot join started games
    if (!isSuperAdmin && room.status !== ROOM_STATUS.WAITING) {
      return { success: false, message: 'Game sudah dimulai, tidak bisa join' };
    }

    // Update room activity
    room.lastActivity = new Date();
    
    const result = room.addPlayer(socketId, username, isSuperAdmin);
    return result.success ? { success: true, room } : result;
  }

  isSuperAdmin(username, password) {
    const { superadmin } = require('../config');
    return username === superadmin.username && password === superadmin.password;
  }

  getAllRooms() {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      players: room.players.length,
      maxPlayers: room.maxPlayers,
      status: room.status
    }));
  }

  removePlayerFromRooms(socketId) {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.removePlayer(socketId)) {
        // Never auto-delete rooms - let them be cleaned up manually or by timeout
        return room;
      }
    }
    return null;
  }

  deleteRoom(roomId) {
    // Method to explicitly delete room when game is finished
    this.rooms.delete(roomId);
  }

  getAvailableRooms() {
    return Array.from(this.rooms.values())
      .filter(room => room.status === ROOM_STATUS.WAITING && room.players.length < room.maxPlayers)
      .map(room => ({
        id: room.id,
        name: room.name,
        players: room.players.length,
        maxPlayers: room.maxPlayers
      }));
  }

  cleanupEmptyRooms() {
    // Disabled - rooms will only be cleaned up by inactive room cleanup
    return;
  }

  cleanupInactiveRooms() {
    const now = new Date();
    const threeHours = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
    const deletedRooms = [];
    
    for (const [roomId, room] of this.rooms.entries()) {
      const roomAge = now - room.createdAt;
      const lastActivity = room.lastActivity || room.createdAt;
      const inactiveTime = now - lastActivity;
      
      // Delete room if:
      // 1. Room is older than 3 hours with no activity, OR
      // 2. Room has been inactive for 3 hours
      if (roomAge > threeHours && inactiveTime > threeHours) {
        this.rooms.delete(roomId);
        deletedRooms.push(roomId);
      }
    }
    
    return deletedRooms;
  }
}

module.exports = RoomManager;