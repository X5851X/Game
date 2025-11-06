const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const calculatePoints = (timeLeft, totalTime) => {
  const ratio = timeLeft / totalTime;
  if (ratio > 0.67) return 10;
  if (ratio > 0.33) return 5;
  if (ratio > 0) return 2;
  return 0;
};

const validateUsername = (username) => {
  return username && 
         typeof username === 'string' && 
         username.trim().length > 0 && 
         username.trim().length <= 20;
};

const validateRoomName = (roomName) => {
  return roomName && 
         typeof roomName === 'string' && 
         roomName.trim().length > 0 && 
         roomName.trim().length <= 30;
};

module.exports = {
  generateRoomId,
  shuffleArray,
  calculatePoints,
  validateUsername,
  validateRoomName
};