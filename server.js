const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Налаштовуємо Express для віддачі статичних файлів з папки 'public'
// Static file serving handled by Vercel - commented out Express static middleware

io.on('connection', (socket) => {
    console.log(`Новий користувач підключився: ${socket.id}`);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Користувач ${socket.id} приєднався до кімнати ${roomId}`);

        // Повідомляємо всім іншим у кімнаті, що підключився новий користувач
        socket.to(roomId).emit('user-connected', socket.id);

        // Обробка сигнальних даних WebRTC
        socket.on('offer', (payload) => {
            io.to(payload.target).emit('offer', payload);
        });

        socket.on('answer', (payload) => {
            io.to(payload.target).emit('answer', payload);
        });

        socket.on('ice-candidate', (payload) => {
            io.to(payload.target).emit('ice-candidate', payload);
        });

        socket.on('disconnect', () => {
            console.log(`Користувач ${socket.id} відключився`);
            socket.to(roomId).emit('user-disconnected', socket.id);
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер запущено на http://localhost:${PORT}`));