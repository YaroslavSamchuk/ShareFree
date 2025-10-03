// Знаходимо наш iframe на сторінці
const iframe = document.getElementById('video-player');

// Весь код починає працювати тільки ПІСЛЯ того, як iframe повністю завантажиться
iframe.onload = () => {
    // Отримуємо доступ до документа всередині iframe
    const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    // Знаходимо сам елемент <video> всередині iframe
    const videoElement = innerDoc.querySelector('video');

    // Якщо відеоелемент не знайдено, зупиняємо виконання і повідомляємо про помилку
    if (!videoElement) {
        console.error("Помилка: елемент <video> не знайдено всередині iframe. Можливо, структура плеєра змінилася.");
        alert("Не вдалося отримати доступ до відео. Спробуйте оновити сторінку.");
        return;
    }

    // Тепер у нас є прямий доступ до плеєра!
    console.log("Доступ до відеоелемента отримано:", videoElement);

    const socket = io();
    let isHost = false;
    let currentLobbyId = null;

    // --- Елементи DOM ---
    const lobbyIdInput = document.getElementById('lobbyIdInput');
    const createLobbyBtn = document.getElementById('createLobbyBtn');
    const joinLobbyBtn = document.getElementById('joinLobbyBtn');
    const currentLobbyDisplay = document.getElementById('currentLobby');
    const playerContainer = document.querySelector('.player-container');
    
    // --- Логіка лоббі ---
    createLobbyBtn.addEventListener('click', () => {
        const lobbyId = generateLobbyId();
        currentLobbyId = lobbyId;
        isHost = true;
        socket.emit('createLobby', lobbyId);
        currentLobbyDisplay.textContent = lobbyId;
        playerContainer.classList.remove('no-events');
        alert(`Лоббі створено! Поділіться цим ID: ${lobbyId}`);
        bindHostEvents(); // Прив'язуємо події тільки для хоста
    });

    joinLobbyBtn.addEventListener('click', () => {
        const lobbyId = lobbyIdInput.value.trim();
        if (lobbyId) {
            currentLobbyId = lobbyId;
            isHost = false;
            socket.emit('joinLobby', lobbyId);
            currentLobbyDisplay.textContent = lobbyId;
            playerContainer.classList.add('no-events');
            alert(`Ви приєднались до лоббі: ${lobbyId}`);
        } else {
            alert('Будь ласка, введіть ID лоббі');
        }
    });

    function generateLobbyId() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    // --- Керування плеєром та синхронізація ---

    function bindHostEvents() {
        if (!isHost) return;

        videoElement.addEventListener('play', () => {
            if (!videoElement.seeking) {
                socket.emit('play', { lobbyId: currentLobbyId, time: videoElement.currentTime });
            }
        });

        videoElement.addEventListener('pause', () => {
            if (!videoElement.seeking) {
                socket.emit('pause', { lobbyId: currentLobbyId, time: videoElement.currentTime });
            }
        });

        videoElement.addEventListener('seeked', () => {
            // Після перемотування надсилаємо актуальний статус
            const eventName = videoElement.paused ? 'pause' : 'play';
            socket.emit(eventName, { lobbyId: currentLobbyId, time: videoElement.currentTime });
        });
    }

    // --- Обробка команд від сервера (для клієнтів) ---

    socket.on('play', (data) => {
        if (!isHost) {
            if (Math.abs(videoElement.currentTime - data.time) > 2) {
                videoElement.currentTime = data.time;
            }
            if (videoElement.paused) {
                videoElement.play();
            }
        }
    });

    socket.on('pause', (data) => {
        if (!isHost) {
            // Клієнт також синхронізує час при паузі
            if (Math.abs(videoElement.currentTime - data.time) > 2) {
                videoElement.currentTime = data.time;
            }
            if (!videoElement.paused) {
                videoElement.pause();
            }
        }
    });

    // --- Синхронізація для нових учасників ---
    
    socket.on('requestSync', () => {
        if (isHost) {
            socket.emit('sync', { 
                lobbyId: currentLobbyId, 
                time: videoElement.currentTime,
                isPlaying: !videoElement.paused
            });
        }
    });

    socket.on('sync', (data) => {
        if (!isHost) {
            videoElement.currentTime = data.time;
            if (data.isPlaying) {
                videoElement.play();
            } else {
                videoElement.pause();
            }
        }
    });
};

// Обробник помилки, якщо iframe не завантажився
iframe.onerror = () => {
    console.error("Помилка завантаження iframe. Перевірте посилання на плеєр.");
    alert("Не вдалося завантажити плеєр. Можливо, посилання застаріло або недоступне.");
};