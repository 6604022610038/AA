let ws;
let username = localStorage.getItem('chatUsername') || null;
let currentRoom;
let isRegisterMode = false;
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
const roomPasswordInput = document.getElementById('roomPasswordInput'); 
const logoutBtn = document.getElementById('logoutBtn');

// [ใหม่] Mobile Elements
const mobileToggle = document.getElementById('mobileToggle'); 
const sidebar = document.querySelector('.sidebar'); 

// การเชื่อมต่อ WebSocket แบบ Dynamic
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const host = window.location.host;
ws = new WebSocket(`${protocol}://${host}`);

// --- ฟังก์ชันจัดการ UI State ---

function resetChatUI() {
    username = null;
    currentRoom = null;
    joinedRooms = {};
    
    document.getElementById('loginArea').style.display = 'flex';
    chatContainer.style.display = 'none';
    
    messagesDiv.innerHTML = '';
    roomList.innerHTML = '';
    usernameInput.value = '';
    passwordInput.value = '';
    messageInput.value = '';
    currentRoomNameDisplay.textContent = '';
    
    // [ใหม่] ซ่อนปุ่ม Mobile Toggle และปิด Sidebar
    if (mobileToggle) {
        mobileToggle.style.display = 'none';
    }
    if (sidebar) {
        sidebar.classList.remove('active');
    }

    setLoginMode(); 
}

function showChatUI() {
    document.getElementById('loginArea').style.display = 'none';
    chatContainer.style.display = 'flex'; // แสดง Container หลัก
    
    // [ใหม่] แสดงปุ่ม Mobile Toggle เมื่อเข้าสู่ระบบแล้ว
    if (mobileToggle) {
        mobileToggle.style.display = 'block'; 
    }
}

function hideChatUI() {
    document.getElementById('loginArea').style.display = 'block';
    chatContainer.style.display = 'none';
    chatContent.style.display = 'none'; // ซ่อน Chat Area ด้วย
    
    // [ใหม่] ซ่อนปุ่ม Mobile Toggle และปิด Sidebar
    if (mobileToggle) {
        mobileToggle.style.display = 'none';
    }
    if (sidebar) {
        sidebar.classList.remove('active');
    }

    resetChatUI();
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
    loginBtn.style.display = 'block';
    loginBtn.textContent = 'ยกเลิก / ย้อนกลับ'; 
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
        ws.onopen = () => {
            // [แก้ไข] ใช้ showChatUI เพื่อแสดงผล UI และปุ่ม Mobile Toggle
            showChatUI(); 
            if (chatContent) chatContent.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'block';
            
            ws.send(JSON.stringify({ type:'login', username, password: '' }));
        };
    } else {
        setLoginMode();
    }
});

// ------------------------------------

// ฟังก์ชันแสดงข้อความ (ไม่มีการเปลี่ยนแปลง)
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
            handleRoomAction(roomName, '', false); 
            // [ใหม่] ปิด Sidebar เมื่อเลือกห้องบนมือถือ
            if (sidebar) {
                sidebar.classList.remove('active');
            }
        });

        roomList.appendChild(roomDiv);
    });
}

function handleRoomAction(roomName, roomPassword = '', isNewRoom = false) {
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

    if (roomPassword) {
        message.password = roomPassword;
    }
    
    ws.send(JSON.stringify(message));
}


ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if(data.type === 'login') {
        if(data.success) {
            if (document.getElementById('loginArea').style.display !== 'none') {
                alert(`ยินดีต้อนรับ ${username}!`);
            }
            // [แก้ไข] ใช้ showChatUI
            showChatUI();
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
        hideChatUI(); // [แก้ไข] ใช้ hideChatUI
    }
    
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

// Event Listener ส่งข้อความ
function sendMessage() {
    const content = messageInput.value.trim();
    
    if(!content || !currentRoom || !username) {
        return; 
    }

    // **[แก้ไข: ปรับ Timestamp ให้เป็น วันที่และเวลา]**
    const tempMsgData = {
        type: 'message',
        from: username,
        room: currentRoom,
        content: content,
        timestamp: new Date().toLocaleString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    };
    
    ws.send(JSON.stringify(tempMsgData));
    displayMessage(tempMsgData);
    messageInput.value = '';
}

// ผูกปุ่ม "ส่ง" เข้ากับฟังก์ชัน sendMessage
sendBtn.addEventListener('click', sendMessage);

// **[LOGIC]** ตรวจจับการกดปุ่ม Enter ในช่องข้อความ
messageInput.addEventListener('keypress', (e) => {
    // รหัสคีย์ 13 คือปุ่ม Enter
    if (e.key === 'Enter') {
        // [สำคัญ] ป้องกันการขึ้นบรรทัดใหม่ใน Input Box เมื่อกด Enter
        e.preventDefault(); 
        sendMessage();
    }
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
        // **[แก้ไข: ปรับ Timestamp ให้เป็น วันที่และเวลา]**
        const fileData = {
            type: 'file',
            from: username,
            room: currentRoom,
            filename: file.name,
            content: e.target.result, 
            timestamp: new Date().toLocaleString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) 
        };

        ws.send(JSON.stringify(fileData));
        displayMessage(fileData);
        fileInput.value = ''; 
    };

    reader.readAsDataURL(file);
});


if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
            ws.send(JSON.stringify({ type: 'logout' })); 
            localStorage.removeItem('chatUsername');
        }
    });
}

// [ใหม่] Logic สำหรับ Mobile Toggle (ต้องเพิ่มใน index.html ด้วย)
if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
        if (sidebar) {
            sidebar.classList.toggle('active'); // สลับคลาส active เพื่อเปิด/ปิด sidebar
        }
    });
}