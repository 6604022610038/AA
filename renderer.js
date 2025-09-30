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
        // ตรวจสอบ Base64 string format
        const base64Data = fileContent.substring(fileContent.indexOf(',') + 1);
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
        downloadLink.style.color = isMine ? 'white' : '#e91e63'; // เปลี่ยนสีลิงก์ให้เข้ากับ PinkChatApp
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

// **[แก้ไข]** ฟังก์ชันวาดรายการห้องที่เข้าร่วม
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
    
    // ตั้งสถานะโหลด
    if (chatContent) chatContent.style.display = 'none';
    currentRoomNameDisplay.textContent = 'กำลังโหลด...';
    
    // สร้าง Object ข้อความ
    const message = { 
        type: 'createRoom',
        room: roomName,
        isNewRoom: isNewRoom 
    };
    
    ws.send(JSON.stringify(message));
}


ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Login / Register Response
    if(data.type === 'login') {
        if(data.success) {
            if (data.success && document.getElementById('loginArea').style.display !== 'none') {
                 // แสดง alert เมื่อเป็นการ Login ครั้งแรกเท่านั้น
                alert(`ยินดีต้อนรับ ${username}!`); 
            }
            document.getElementById('loginArea').style.display='none';
            chatContainer.style.display='flex';
            if (chatContent) chatContent.style.display = 'none'; 
            if (logoutBtn) logoutBtn.style.display = 'block';

        } else {
            // หาก Login ไม่สำเร็จจากการ Auto-login ให้กลับไปหน้า Login
            localStorage.removeItem('chatUsername');
            setLoginMode();
            alert(data.message);
        }
    }
    
    // ... (Registration Logic เดิม) ...
    if(data.type === 'register') {
        if(data.success) {
            alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านของคุณ');
            setLoginMode();
            usernameInput.value = ''; 
            passwordInput.value = '';
        } else alert(data.message);
    }
    
    if(data.type === 'logout') {
        // Server ได้บันทึก lastRoom แล้ว Client จะทำการ Reload เพื่อรีเซ็ต
        localStorage.removeItem('chatUsername');
        window.location.reload(); 
    }
    
    // รับรายชื่อห้องทั้งหมดที่มีจาก Server ทันทีหลัง Login 
    if(data.type === 'availableRooms') {
        // ล้าง joinedRooms ก่อน (ถ้ามีข้อมูลเก่า) 
        joinedRooms = {}; 
        data.rooms.forEach(roomInfo => {
            // เพิ่มห้องทั้งหมดที่เคยถูกสร้างแล้วเข้าใน joinedRooms เพื่อให้แสดงใน Sidebar
            joinedRooms[roomInfo.room] = true; 
        });
        
        // วาดรายการห้องใหม่ทั้งหมด
        renderJoinedRooms();
        
        return;
    }


    // ===== History (เปิดเผยส่วนแชทเมื่อเข้าร่วมห้องสำเร็จ) =====
    if(data.type === 'history') {
        messagesDiv.innerHTML = ''; 
        const roomName = data.room; 
        
        // 1. อัปเดตโครงสร้าง JoinedRooms: เพิ่มห้องใหม่ถ้ายังไม่มี
        if (!joinedRooms[roomName]) {
            joinedRooms[roomName] = true; 
        }
        
        // 2. ตั้งค่าห้องปัจจุบัน
        currentRoom = roomName; 
        
        // 3. วาดรายการห้องใหม่ทั้งหมด (เพื่อเน้นห้องที่เลือก)
        renderJoinedRooms(); 
        
        // 4. แสดงผลแชท
        if (currentRoomNameDisplay) {
            currentRoomNameDisplay.textContent = `ห้อง: ${currentRoom}`;
        }
        if (chatContent) chatContent.style.display = 'flex'; 

        data.messages.forEach(msg => {
            displayMessage(msg);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight; // สกอร์ไปด้านล่าง
    }
    
    // กรณีเข้าร่วมห้องไม่สำเร็จ (รวมถึงห้องซ้ำ)
    if(data.type === 'joinFailed') {
        alert(data.message);
        // หากมีข้อผิดพลาด ให้ยกเลิกการเลือกห้องปัจจุบัน
        currentRoom = null; 
        if (chatContent) chatContent.style.display = 'none';
        if (currentRoomNameDisplay) currentRoomNameDisplay.textContent = '';
        renderJoinedRooms(); // วาดห้องที่เหลือ (ถ้ามี)
    }

    // ===== New Message (Real-time Logic) =====
    if(data.type === 'message' || data.type === 'file') {
        // **[สำคัญ]** แสดงข้อความเมื่ออยู่ในห้องปัจจุบันเท่านั้น 
        // และไม่ใช่ข้อความของตัวเอง (ข้อความของตัวเองแสดงทันทีที่ปุ่มถูกกด)
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
        handleRoomAction(room, false); // isNewRoom: false (เป็นการ Join)
        
        roomInput.value = '';
    });
}

if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => {
        const room = roomInput.value.trim();
        
        if(!room) return alert('กรุณาระบุชื่อห้องใหม่ที่ต้องการสร้าง');
    
        handleRoomAction(room, true); // isNewRoom: true (เป็นการ Create)
        
        roomInput.value = '';
    });
}

// Event Listener ส่งข้อความ (รวม Logic การแสดงข้อความของตัวเองทันที)
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
    
    // **[Real-time Client Logic]** แสดงข้อความของตัวเองทันที โดยไม่ต้องรอ Server ตอบกลับ
    displayMessage(tempMsgData);

    messageInput.value = '';
});

// ส่งไฟล์ (เดิม)
const sendFileBtn = document.createElement('button');
sendFileBtn.textContent = 'ส่งไฟล์';
sendFileBtn.className = 'file-btn'; // เพิ่ม class เพื่อให้ใช้ style ใน index.html ได้
const inputArea = document.querySelector('.input-area');
if (inputArea) {
    // เพิ่มปุ่มส่งไฟล์
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
        // **[Real-time Client Logic]** แสดงข้อความของตัวเองทันที
        displayMessage(fileData);
        fileInput.value = ''; // ล้างค่าไฟล์
    };

    reader.readAsDataURL(file);
});


// Event Listener สำหรับปุ่ม Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
            // 1. ส่งคำสั่ง Logout ไป Server
            ws.send(JSON.stringify({ type: 'logout' })); 
            // 2. ลบข้อมูลผู้ใช้
            localStorage.removeItem('chatUsername');
            // 3. Reload หน้าเพจเพื่อรีเซ็ต UI และกลับไปหน้า Login
            window.location.reload(); 
        }
    });
}