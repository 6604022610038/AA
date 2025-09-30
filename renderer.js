let ws;
let username = localStorage.getItem('chatUsername') || null;
let currentRoom;
let isRegisterMode = false;
// ใช้โครงสร้างนี้เพื่อเก็บเฉพาะชื่อห้องที่ผู้ใช้ได้เข้าร่วม
let joinedRooms = {}; 

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const chatContainer = document.getElementById('chatContainer');
const roomInput = document.getElementById('roomInput');
const joinRoomBtn = document.getElementById('joinRoomBtn'); 
const createRoomBtn = document.getElementById('createRoomBtn'); 
const roomList = document.getElementById('roomList'); 
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.createElement('input');
fileInput.type = 'file';

const chatContent = document.getElementById('chatContent'); 
const currentRoomNameDisplay = document.getElementById('currentRoomNameDisplay');
const logoutBtn = document.getElementById('logoutBtn');

// การเชื่อมต่อ WebSocket แบบ Dynamic
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const host = window.location.host;
ws = new WebSocket(`${protocol}://${host}`);

// --- ฟังก์ชันจัดการ UI State ---

// [NEW FUNCTION] ฟังก์ชันรีเซ็ต UI ทั้งหมดกลับไปหน้า Login
function resetChatUI() {
    username = null;
    currentRoom = null;
    joinedRooms = {};
    
    // Reset UI to Login state
    document.getElementById('loginArea').style.display = 'flex';
    chatContainer.style.display = 'none';
    chatContent.style.display = 'none';
    messagesDiv.innerHTML = '';
    roomList.innerHTML = '';
    
    // Reset input values
    usernameInput.value = '';
    passwordInput.value = '';
    messageInput.value = '';
    currentRoomNameDisplay.textContent = '';
    
    setLoginMode(); // Ensure UI buttons are set for login/register
}


function setLoginMode() {
    isRegisterMode = false;
    usernameInput.placeholder = "ชื่อผู้ใช้";
    passwordInput.placeholder = "รหัสผ่าน";
    loginBtn.textContent = 'เข้าสู่ระบบ';
    registerBtn.textContent = 'สมัครสมาชิก';
    loginBtn.style.display = 'block'; 
    if(logoutBtn) logoutBtn.style.display = 'none';

    loginBtn.removeEventListener('click', submitLogin);
    registerBtn.removeEventListener('click', submitRegistration);
    registerBtn.removeEventListener('click', switchToRegisterMode);

    loginBtn.addEventListener('click', submitLogin);
    registerBtn.addEventListener('click', switchToRegisterMode); 
}

function switchToRegisterMode() {
    isRegisterMode = true;
    usernameInput.placeholder = "ตั้งชื่อผู้ใช้ใหม่";
    passwordInput.placeholder = "ตั้งรหัสผ่าน";
    registerBtn.textContent = 'ยืนยันการสมัคร';
    loginBtn.style.display = 'none'; 
    if(logoutBtn) logoutBtn.style.display = 'none';

    loginBtn.removeEventListener('click', submitLogin);
    registerBtn.removeEventListener('click', submitRegistration);
    registerBtn.removeEventListener('click', switchToRegisterMode);

    registerBtn.addEventListener('click', submitRegistration); 
    loginBtn.addEventListener('click', setLoginMode); 
}

function submitLogin() {
    username = usernameInput.value.trim(); 
    const password = passwordInput.value;
    if(!username || !password) return alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน');
    
    localStorage.setItem('chatUsername', username); 
    
    ws.send(JSON.stringify({ type:'login', username, password }));
}

function submitRegistration() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if(!username || !password) return alert('กรุณาตั้งชื่อผู้ใช้และรหัสผ่าน');
    
    ws.send(JSON.stringify({ type:'register', username, password }));
}

document.addEventListener('DOMContentLoaded', () => {
    // [FIX] ไม่ต้องรอ onopen เพื่อทำ UI switch ถ้า username มีอยู่แล้ว
    if (username) {
        // [FIXED] รอให้ WebSocket เชื่อมต่อก่อนส่ง Login
        ws.onopen = () => {
            document.getElementById('loginArea').style.display = 'none';
            chatContainer.style.display = 'flex';
            if (chatContent) chatContent.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'block';
            
            // ส่ง Login เพื่อกู้ Session และให้ Server ส่งรายชื่อห้องกลับมา
            ws.send(JSON.stringify({ type:'login', username, password: '' }));
        };
    } else {
        setLoginMode();
    }
});

// ------------------------------------

function displayMessage(msgData) {
    const isMine = msgData.from === username;
    const msgDiv = document.createElement('div');
    
    msgDiv.className = `message ${isMine ? 'my-message' : 'other-message'}`;

    if (!isMine) {
        const senderSpan = document.createElement('div');
        senderSpan.className = 'message-sender';
        senderSpan.textContent = msgData.from;
        msgDiv.appendChild(senderSpan);
    }

    const contentWrapper = document.createElement('div');
    contentWrapper.style.marginTop = '5px';

    if (msgData.type === 'message') {
        const contentP = document.createElement('p');
        contentP.textContent = msgData.content;
        contentWrapper.appendChild(contentP);

    } else if (msgData.type === 'file') {
        const fileContent = msgData.content; 
        const filename = msgData.filename;
        const mimeType = fileContent.substring(5, fileContent.indexOf(';')); 

        if (mimeType.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = fileContent;
            img.alt = filename;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '5px';
            contentWrapper.appendChild(img);
        } else if (mimeType.startsWith('audio/')) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = fileContent;
            audio.style.width = '100%';
            contentWrapper.appendChild(audio);
        } else {
            const fileText = document.createElement('p');
            fileText.textContent = `[ไฟล์แนบ: ${filename}]`;
            contentWrapper.appendChild(fileText);
        }

        const downloadLink = document.createElement('a');
        downloadLink.href = fileContent;
        downloadLink.download = filename; 
        downloadLink.textContent = `📥 ดาวน์โหลด (${filename})`;
        downloadLink.style.display = 'block';
        downloadLink.style.marginTop = '5px';
        downloadLink.style.fontSize = '0.8em';
        downloadLink.style.color = isMine ? 'white' : '#e91e63'; 
        contentWrapper.appendChild(downloadLink);
    }
    
    msgDiv.appendChild(contentWrapper);

    if (msgData.timestamp) {
        const timeSpan = document.createElement('span');
        timeSpan.style.fontSize = '0.6em';
        timeSpan.style.opacity = '0.6';
        timeSpan.style.marginTop = '2px';
        timeSpan.style.display = 'block';
        timeSpan.textContent = msgData.timestamp;
        msgDiv.appendChild(timeSpan);
    }
    
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function renderJoinedRooms() {
    roomList.innerHTML = ''; 
    
    Object.keys(joinedRooms).forEach(roomName => {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'room-item';
        
        if (roomName === currentRoom) {
            roomDiv.classList.add('selected');
        }

        roomDiv.textContent = `🚪 ${roomName}`;
        
        roomDiv.addEventListener('click', () => {
            handleRoomAction(roomName, false); 
        });

        roomList.appendChild(roomDiv);
    });
}

function handleRoomAction(roomName, isNewRoom = false) { 
    if (!username) {
        alert('กรุณาเข้าสู่ระบบก่อน');
        return;
    }
    
    if (chatContent) chatContent.style.display = 'none';
    currentRoomNameDisplay.textContent = 'กำลังโหลด...';
    
    const message = { 
        type: 'createRoom',
        room: roomName,
        isNewRoom: isNewRoom 
    };
    
    ws.send(JSON.stringify(message));
}


ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // ===== Login / Register Response =====
    if(data.type === 'login') {
        if(data.success) {
            if (document.getElementById('loginArea').style.display !== 'none') {
                 // **[FIXED]** เมื่อ Login สำเร็จ ให้ซ่อนหน้า Login และแสดง Chat ทันที
                document.getElementById('loginArea').style.display='none';
                chatContainer.style.display='flex';
                if (logoutBtn) logoutBtn.style.display = 'block';
                alert(`ยินดีต้อนรับ ${username}!`);
            }
            if (chatContent) chatContent.style.display = 'none'; 

        } else {
            // หาก Login ไม่สำเร็จ
            localStorage.removeItem('chatUsername');
            setLoginMode();
            alert(data.message);
        }
    }
    
    if(data.type === 'register') {
        if(data.success) {
            alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านของคุณ');
            setLoginMode();
            usernameInput.value = ''; 
            passwordInput.value = '';
        } else alert(data.message);
    }
    
    // ===== Logout Response (สำคัญที่สุดในการแก้ไขปัญหาไม่ต้องรี) =====
    if(data.type === 'logout') {
        // [FIXED] ไม่มีการ window.location.reload();
        // Server ได้บันทึก lastRoom แล้ว
        resetChatUI(); // **[NEW]** เรียกฟังก์ชันรีเซ็ต UI ทันที
    }
    
    // ===== Available Rooms / History / Messages (Unchanged Logic) =====
    
    if(data.type === 'availableRooms') {
        joinedRooms = {}; 
        data.rooms.forEach(roomInfo => {
            joinedRooms[roomInfo.room] = true; 
        });
        renderJoinedRooms();
        return;
    }


    if(data.type === 'history') {
        messagesDiv.innerHTML = ''; 
        const roomName = data.room; 
        
        if (!joinedRooms[roomName]) {
            joinedRooms[roomName] = true; 
        }
        
        currentRoom = roomName; 
        
        renderJoinedRooms(); 
        
        if (currentRoomNameDisplay) {
            currentRoomNameDisplay.textContent = `ห้อง: ${currentRoom}`;
        }
        if (chatContent) chatContent.style.display = 'flex'; 

        data.messages.forEach(msg => {
            displayMessage(msg);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight; 
    }
    
    if(data.type === 'joinFailed') {
        alert(data.message);
        currentRoom = null; 
        if (chatContent) chatContent.style.display = 'none';
        if (currentRoomNameDisplay) currentRoomNameDisplay.textContent = '';
        renderJoinedRooms(); 
    }

    if(data.type === 'message' || data.type === 'file') {
        if (data.room === currentRoom && data.from !== username) {
            displayMessage(data); 
        }
    }
};

// --- Event Listeners สำหรับปุ่มห้องใหม่ ---

if (joinRoomBtn) {
    joinRoomBtn.addEventListener('click', () => {
        const room = roomInput.value.trim();
        
        if(!room) return alert('กรุณาระบุชื่อห้องที่ต้องการเข้าร่วม');
        handleRoomAction(room, false); 
        
        roomInput.value = '';
    });
}

if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => {
        const room = roomInput.value.trim();
        
        if(!room) return alert('กรุณาระบุชื่อห้องใหม่ที่ต้องการสร้าง');
    
        handleRoomAction(room, true); 
        
        roomInput.value = '';
    });
}

// Event Listener ส่งข้อความ
sendBtn.addEventListener('click', () => {
    const content = messageInput.value.trim();
    
    if(!content || !currentRoom || !username) {
        return alert('กรุณาเข้าสู่ระบบและเข้าร่วมห้องก่อนส่งข้อความ');
    }

    const tempMsgData = {
        type: 'message',
        from: username,
        room: currentRoom,
        content: content,
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) 
    };
    
    ws.send(JSON.stringify(tempMsgData));
    
    displayMessage(tempMsgData);

    messageInput.value = '';
});

// ส่งไฟล์ 
const sendFileBtn = document.createElement('button');
sendFileBtn.textContent = 'ส่งไฟล์';
sendFileBtn.className = 'file-btn'; 
const inputArea = document.querySelector('.input-area');
if (inputArea) {
    inputArea.appendChild(sendFileBtn); 
    inputArea.appendChild(fileInput); 
}

sendFileBtn.addEventListener('click', () => {
    if(!currentRoom) return alert('เลือกห้องก่อนส่งไฟล์');
    fileInput.click();
});

fileInput.addEventListener('change', () => {
    if(!fileInput.files[0]) return;
    const file = fileInput.files[0];
    const reader = new FileReader();

    if(!username || !currentRoom) return alert('เข้าสู่ระบบและเข้าห้องก่อนส่งไฟล์');

    reader.onload = (e) => {
        const fileData = {
            type: 'file',
            from: username,
            room: currentRoom,
            filename: file.name,
            content: e.target.result, 
            timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) 
        };

        ws.send(JSON.stringify(fileData));
        displayMessage(fileData);
        fileInput.value = ''; 
    };

    reader.readAsDataURL(file);
});


// Event Listener สำหรับปุ่ม Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
            // 1. ส่งคำสั่ง Logout ไป Server
            ws.send(JSON.stringify({ type: 'logout' })); 
            // 2. ลบข้อมูลผู้ใช้ (Logout handler จะจัดการ UI reset เมื่อ Server ตอบกลับ)
            localStorage.removeItem('chatUsername');
            // [REMOVED] window.location.reload(); 
        }
    });
}