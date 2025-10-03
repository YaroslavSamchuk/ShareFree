// API endpoint для управления комнатами
export default function handler(req, res) {
  // Устанавливаем CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    // Создание новой комнаты
    const { roomName } = req.body;
    const roomId = generateRoomId();
    
    res.status(200).json({
      success: true,
      roomId: roomId,
      roomName: roomName || `Room ${roomId}`,
      message: 'Room created successfully'
    });
  } else if (req.method === 'GET') {
    // Получение информации о комнате
    const { roomId } = req.query;
    
    if (!roomId) {
      res.status(400).json({
        success: false,
        message: 'Room ID is required'
      });
      return;
    }

    res.status(200).json({
      success: true,
      roomId: roomId,
      participants: [],
      created: new Date().toISOString()
    });
  } else {
    res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }
}

function generateRoomId() {
  return Math.random().toString(36).substr(2, 9);
}