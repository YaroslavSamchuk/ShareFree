// --- DOM Елементи ---
const lobbyContainer = document.getElementById('lobbyContainer');
const videoSection = document.getElementById('videoSection');
const joinButton = document.getElementById('joinRoom');
const roomNameInput = document.getElementById('roomName');
const roomTitle = document.getElementById('roomTitle');
const startStreamButton = document.getElementById('startStream');
const statusMessage = document.getElementById('statusMessage');
const streamContainer = document.getElementById('stream-container');
const localPreviewContainer = document.getElementById('local-preview');
const controlsBar = document.getElementById('controls-bar');
const playPauseBtn = document.getElementById('playPauseBtn');
const muteBtn = document.getElementById('muteBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');

// --- Глобальні змінні ---
let socket;
let localStream;
let myPeerConnections = {};
let myId;
let currentRoomId;
let mainVideoEl = null;
let inactivityTimer; // Таймер для приховування інтерфейсу

const peerConnectionConfig = {
    'iceServers': [
        { 'urls': 'stun:stun.l.google.com:19302' },
        { 'urls': 'stun:stun1.l.google.com:19302' }
    ]
};

// --- Обробники подій для UI ---
joinButton.addEventListener('click', () => {
    const roomName = roomNameInput.value.trim();
    if (roomName) {
        currentRoomId = roomName;
        lobbyContainer.style.display = 'none';
        videoSection.style.display = 'block';
        roomTitle.textContent = `Кімната: ${roomName}`;
        connectToSocket();
    } else {
        alert('Будь ласка, введіть назву кімнати.');
    }
});

startStreamButton.addEventListener('click', async () => {
    try {
        const streamOptions = {
            video: {
                cursor: "never",
                frameRate: { ideal: 60 } 
            },
            audio: {
                autoGainControl: false,
                echoCancellation: false,
                noiseSuppression: false,
                sampleRate: 48000
            }
        };
        
        localStream = await navigator.mediaDevices.getDisplayMedia(streamOptions);
        
        statusMessage.textContent = 'Ви транслюєте свій екран.';
        startStreamButton.style.display = 'none';

        addVideoStream(socket.id, localStream, true, true);

        for (const peerId in myPeerConnections) {
            localStream.getTracks().forEach(track => {
                myPeerConnections[peerId].addTrack(track, localStream);
            });
        }

    } catch (err) {
        console.error("Не вдалося отримати доступ до екрана:", err);
        statusMessage.textContent = 'Помилка доступу до екрана.';
    }
});

playPauseBtn.addEventListener('click', () => {
    if (mainVideoEl && mainVideoEl.paused) {
        mainVideoEl.play();
        playPauseBtn.textContent = '⏸️';
    } else if (mainVideoEl) {
        mainVideoEl.pause();
        playPauseBtn.textContent = '▶️';
    }
});

muteBtn.addEventListener('click', () => {
    if (mainVideoEl) {
        mainVideoEl.muted = !mainVideoEl.muted;
        muteBtn.textContent = mainVideoEl.muted ? '🔇' : '🔊';
    }
});

fullscreenBtn.addEventListener('click', () => {
    if (streamContainer.requestFullscreen) {
        streamContainer.requestFullscreen();
    } else if (streamContainer.webkitRequestFullscreen) { /* Safari */
        streamContainer.webkitRequestFullscreen();
    } else if (streamContainer.msRequestFullscreen) { /* IE11 */
        streamContainer.msRequestFullscreen();
    }
});

// --- Логіка приховування інтерфейсу ---
function hideUI() {
    streamContainer.classList.add('inactive');
}

function showUI() {
    streamContainer.classList.remove('inactive');
}

streamContainer.addEventListener('mousemove', () => {
    showUI();
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(hideUI, 3000);
});

streamContainer.addEventListener('mouseleave', () => {
    hideUI();
});


// --- Логіка Socket.IO та WebRTC ---
function connectToSocket() {
    socket = io();

    socket.on('connect', () => {
        myId = socket.id;
        socket.emit('join-room', currentRoomId);
    });

    socket.on('user-connected', (userId) => {
        console.log(`Новий користувач приєднався: ${userId}`);
        const peerConnection = createPeerConnection(userId);
        myPeerConnections[userId] = peerConnection;
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }
    });

    socket.on('offer', (payload) => {
        const peerConnection = createPeerConnection(payload.caller);
        myPeerConnections[payload.caller] = peerConnection;
        peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer))
            .then(() => peerConnection.createAnswer())
            .then(answer => peerConnection.setLocalDescription(answer))
            .then(() => {
                socket.emit('answer', { target: payload.caller, caller: socket.id, answer: peerConnection.localDescription });
            });
    });

    socket.on('answer', (payload) => {
        myPeerConnections[payload.caller]?.setRemoteDescription(new RTCSessionDescription(payload.answer));
    });

    socket.on('ice-candidate', (payload) => {
        myPeerConnections[payload.caller]?.addIceCandidate(new RTCIceCandidate(payload.candidate));
    });

    socket.on('user-disconnected', (userId) => {
        if (myPeerConnections[userId]) {
            myPeerConnections[userId].close();
            delete myPeerConnections[userId];
        }
        const videoElement = document.getElementById(userId);
        if (videoElement && videoElement === mainVideoEl) {
            videoElement.remove();
            mainVideoEl = null;
            controlsBar.style.display = 'none';
            statusMessage.textContent = 'Ведучий відключився. Очікування на нову трансляцію...';
            startStreamButton.style.display = 'inline-block';
        }
    });
}

function createPeerConnection(targetId) {
    const peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { target: targetId, caller: socket.id, candidate: event.candidate });
        }
    };
    peerConnection.ontrack = (event) => {
        addVideoStream(targetId, event.streams[0], false, false);
    };
    peerConnection.onnegotiationneeded = () => {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                socket.emit('offer', { target: targetId, caller: socket.id, offer: peerConnection.localDescription });
            });
    };
    return peerConnection;
}

function addVideoStream(id, stream, isMuted = false, isLocal = false) {
    if (document.getElementById(id)) return;
    
    const video = document.createElement('video');
    video.srcObject = stream;
    video.id = id;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = isMuted;

    if (isLocal) {
        localPreviewContainer.innerHTML = '';
        localPreviewContainer.append(video);
    } else {
        streamContainer.innerHTML = ''; // Очищуємо, щоб була тільки одна основна трансляція
        streamContainer.append(video);
        mainVideoEl = video;
        
        statusMessage.textContent = 'Трансляція почалась!';
        startStreamButton.style.display = 'none';
        controlsBar.style.display = 'flex';
        
        // Повертаємо контейнери на місце, оскільки ми очистили streamContainer
        streamContainer.append(localPreviewContainer);
        streamContainer.append(controlsBar);
        
        // Запускаємо таймер неактивності
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(hideUI, 3000);
    }
}