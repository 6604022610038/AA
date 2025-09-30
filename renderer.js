let ws;
let username = localStorage.getItem('chatUsername') || null;
let currentRoom;
let isRegisterMode = false;
let joinedRooms = {}; // **[แก้ไข]** { roomName: true } เพื่อเก็บห้องที่เข้าร่วมแล้ว

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
const roomPasswordInput = document.getElementById('roomPasswordInput'); 
const logoutBtn = document.getElementById('logoutBtn');

// การเชื่อมต่อ WebSocket แบบ Dynamic
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const host = window.location.host;
ws = new WebSocket(`${protocol}://${host}`);

// --- ฟังก์ชันจัดการ UI State ---

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
    if (username) {
        document.getElementById('loginArea').style.display = 'none';
        chatContainer.style.display = 'flex';
        if (chatContent) chatContent.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        
        ws.onopen = () => {
            // เมื่อเชื่อมต่อแล้ว ให้ส่ง Login เพื่อกู้ Session และห้องล่าสุด
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
        downloadLink.style.color = isMine ? 'white' : '#0084ff';
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

// **[ใหม่]** ฟังก์ชันวาดรายการห้องที่เข้าร่วม
function renderJoinedRooms() {
    roomList.innerHTML = ''; // ล้างและวาดใหม่ทั้งหมด
    
    Object.keys(joinedRooms).forEach(roomName => {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'room-item';
        
        // กำหนดสถานะ Selected
        if (roomName === currentRoom) {
            roomDiv.classList.add('selected');
        }

        roomDiv.textContent = `🚪 ${roomName}`;
        
        // **[Event Listener]** คลิกเพื่อสลับห้อง
        roomDiv.addEventListener('click', () => {
            // ส่งรหัสเป็นว่าง ('') Server จะใช้รหัสที่เคยบันทึกไว้
            handleRoomAction(roomName, '', false); 
        });

        roomList.appendChild(roomDiv);
    });
}

function handleRoomAction(roomName, roomPassword = '', isNewRoom = false) {
    if (!username) {
        alert('กรุณาเข้าสู่ระบบก่อน');
        return;
    }
    
    // ตั้งสถานะโหลด
    if (chatContent) chatContent.style.display = 'none';
    currentRoomNameDisplay.textContent = 'กำลังโหลด...';
    
    // ส่งคำสั่งไป Server (Server จะตรวจสอบรหัสและจัดการ Join)
    ws.send(JSON.stringify({ 
        type: 'createRoom', 
        room: roomName,
        password: roomPassword,
        isNewRoom: isNewRoom
    }));
}


ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Login / Register Response
    if(data.type === 'login') {
        if(data.success) {
            alert(`ยินดีต้อนรับ ${username}!`); 
            
            document.getElementById('loginArea').style.display='none';
            chatContainer.style.display='flex';
            if (chatContent) chatContent.style.display = 'none'; 
            if (logoutBtn) logoutBtn.style.display = 'block';

        } else {
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
    
    if(data.type === 'logout') {
        localStorage.removeItem('chatUsername');
        window.location.reload(); 
    }

    // ===== History (เปิดเผยส่วนแชทเมื่อเข้าร่วมห้องสำเร็จ) =====
    if(data.type === 'history') {
        messagesDiv.innerHTML = ''; 
        const roomName = data.room; 
        
        // 1. **[แก้ไข]** อัปเดตโครงสร้าง JoinedRooms: เพิ่มห้องใหม่ถ้ายังไม่มี
        if (!joinedRooms[roomName]) {
            joinedRooms[roomName] = true; 
        }
        
        // 2. **[แก้ไข]** ตั้งค่าห้องปัจจุบัน
        currentRoom = roomName; 
        
        // 3. **[แก้ไข]** วาดรายการห้องใหม่ทั้งหมด (ซึ่งรวมห้องเก่าไว้ด้วย)
        renderJoinedRooms(); 
        
        // 4. แสดงผลแชท
        if (currentRoomNameDisplay) {
            currentRoomNameDisplay.textContent = `ห้อง: ${currentRoom}`;
        }
        if (chatContent) chatContent.style.display = 'flex'; 

        data.messages.forEach(msg => {
            displayMessage(msg);
        });
    }
    
    // กรณีเข้าร่วมห้องไม่สำเร็จ 
    if(data.type === 'joinFailed') {
        alert(data.message);
        currentRoom = null; 
        if (chatContent) chatContent.style.display = 'none';
        if (currentRoomNameDisplay) currentRoomNameDisplay.textContent = '';
        renderJoinedRooms(); // วาดห้องที่เหลือ (ถ้ามี)
    }

    // ===== New Message (เดิม) =====
    if(data.type === 'message' || data.type === 'file') {
        if (data.room === currentRoom) {
            if (data.from !== username) { 
                displayMessage(data); 
            }
        }
    }
};

// --- Event Listeners สำหรับปุ่มห้องใหม่ ---

if (joinRoomBtn) {
    joinRoomBtn.addEventListener('click', () => {
        const room = roomInput.value.trim();
        const password = roomPasswordInput ? roomPasswordInput.value.trim() : ''; 
        
        if(!room) return alert('กรุณาระบุชื่อห้องที่ต้องการเข้าร่วม');
        handleRoomAction(room, password, false); 
        
        roomInput.value = '';
        if (roomPasswordInput) roomPasswordInput.value = '';
    });
}

if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => {
        const room = roomInput.value.trim();
        const password = roomPasswordInput ? roomPasswordInput.value.trim() : ''; 
        
        if(!room) return alert('กรุณาระบุชื่อห้องใหม่ที่ต้องการสร้าง');
    
        handleRoomAction(room, password, true); 
        
        roomInput.value = '';
        if (roomPasswordInput) roomPasswordInput.value = '';
    });
}

// Event Listener ส่งข้อความ (เดิม)
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

// ส่งไฟล์ (เดิม)
const sendFileBtn = document.createElement('button');
sendFileBtn.textContent = 'ส่งไฟล์';
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
    };

    reader.readAsDataURL(file);
});


// **[ใหม่]** Event Listener สำหรับปุ่ม Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
            ws.send(JSON.stringify({ type: 'logout' })); 
            localStorage.removeItem('chatUsername');
            window.location.reload(); 
        }
    });
}