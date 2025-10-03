// API endpoint для WebRTC сигналинга (ограиченная функциональность без Socket.IO)
export default function handler(req, res) {
  // Устанавливаем CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const { type, roomId, userId, data } = req.body;

    // Валидация входных данных
    if (!type || !roomId || !userId) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: type, roomId, userId'
      });
      return;
    }

    // Обработка различных типов сигналов
    switch (type) {
      case 'offer':
        res.status(200).json({
          success: true,
          message: 'Offer received',
          type: 'offer',
          roomId,
          userId,
          data
        });
        break;
      
      case 'answer':
        res.status(200).json({
          success: true,
          message: 'Answer received',
          type: 'answer',
          roomId,
          userId,
          data
        });
        break;
      
      case 'ice-candidate':
        res.status(200).json({
          success: true,
          message: 'ICE candidate received',
          type: 'ice-candidate',
          roomId,
          userId,
          data
        });
        break;
      
      default:
        res.status(400).json({
          success: false,
          message: 'Unknown signal type'
        });
    }
  } else {
    res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }
}