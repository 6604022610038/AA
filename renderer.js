let ws;
let username;
let currentRoom;
let isRegisterMode = false; // **[เพิ่ม]** ตัวแปรสถานะ UI

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const chatContainer = document.getElementById('chatContainer');
const roomInput = document.getElementById('roomInput');
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

// การเชื่อมต่อ WebSocket แบบ Dynamic
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const host = window.location.host;
ws = new WebSocket(`${protocol}://${host}`);

// --- ฟังก์ชันจัดการ UI State ---

function setLoginMode() {
    isRegisterMode = false;
    
    // ตั้งค่า Placeholder และข้อความปุ่ม
    usernameInput.placeholder = "ชื่อผู้ใช้";
    passwordInput.placeholder = "รหัสผ่าน";
    loginBtn.textContent = 'เข้าสู่ระบบ';
    registerBtn.textContent = 'สมัครสมาชิก';

    // จัดการการแสดงผลปุ่ม (ใช้ปุ่มที่มีอยู่)
    loginBtn.style.display = 'block'; // ปุ่มเข้าสู่ระบบแสดง
    
    // ล้าง Event Listener เดิมออกก่อน
    loginBtn.removeEventListener('click', submitLogin);
    registerBtn.removeEventListener('click', submitRegistration);
    registerBtn.removeEventListener('click', switchToRegisterMode);

    // ใส่ Event Listener ใหม่
    loginBtn.addEventListener('click', submitLogin);
    registerBtn.addEventListener('click', switchToRegisterMode); // ปุ่มสมัครสมาชิกจะทำหน้าที่สลับโหมด
}

function switchToRegisterMode() {
    isRegisterMode = true;
    
    // เปลี่ยน UI เป็นโหมดสมัครสมาชิก
    usernameInput.placeholder = "ตั้งชื่อผู้ใช้ใหม่";
    passwordInput.placeholder = "ตั้งรหัสผ่าน";
    registerBtn.textContent = 'ยืนยันการสมัคร';
    loginBtn.style.display = 'none'; // ซ่อนปุ่มเข้าสู่ระบบชั่วคราว

    // ล้าง Event Listener เดิมออกก่อน
    loginBtn.removeEventListener('click', submitLogin);
    registerBtn.removeEventListener('click', submitRegistration);
    registerBtn.removeEventListener('click', switchToRegisterMode);

    // ใส่ Event Listener ใหม่
    registerBtn.addEventListener('click', submitRegistration); // ปุ่มสมัครสมาชิกจะทำหน้าที่ยืนยันการสมัคร
    
    // อนุญาตให้คลิกปุ่ม Login (ซึ่งตอนนี้ซ่อนอยู่) เพื่อกลับไปโหมด Login ได้
    loginBtn.addEventListener('click', setLoginMode); // ถ้าเปลี่ยนใจก็คลิกปุ่มที่ซ่อนไว้ หรือใช้ปุ่มอื่น (ตอนนี้เราใช้ปุ่มเดียว)
}

// --- ฟังก์ชันส่งข้อมูลไปยัง Server ---

function submitLogin() {
    username = usernameInput.value.trim(); 
    const password = passwordInput.value;
    if(!username || !password) return alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน');
    ws.send(JSON.stringify({ type:'login', username, password }));
}

function submitRegistration() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if(!username || !password) return alert('กรุณาตั้งชื่อผู้ใช้และรหัสผ่าน');
    
    ws.send(JSON.stringify({ type:'register', username, password }));
}

// เรียกใช้เมื่อโหลดหน้าจอ เพื่อตั้งค่าเริ่มต้นให้เป็นโหมด Login
document.addEventListener('DOMContentLoaded', setLoginMode);

// ------------------------------------

// **ฟังก์ชัน: สำหรับแสดงข้อความใน DOM (รวมชื่อผู้ส่ง/Bubble/ไฟล์มีเดีย)**
function displayMessage(msgData) {
    const isMine = msgData.from === username;
    const msgDiv = document.createElement('div');
    
    msgDiv.className = `message ${isMine ? 'my-message' : 'other-message'}`;

    // 1. แสดงชื่อผู้ส่ง
    if (!isMine) {
        const senderSpan = document.createElement('div');
        senderSpan.className = 'message-sender';
        senderSpan.textContent = msgData.from;
        msgDiv.appendChild(senderSpan);
    }

    // 2. สร้าง Content Wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.style.marginTop = '5px';

    if (msgData.type === 'message') {
        // **ประเภท: ข้อความปกติ**
        const contentP = document.createElement('p');
        contentP.textContent = msgData.content;
        contentWrapper.appendChild(contentP);

    } else if (msgData.type === 'file') {
        // **ประเภท: ไฟล์ (Base64)**
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

        // **เพิ่มปุ่มดาวน์โหลดสำหรับไฟล์ทุกชนิด**
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

    // 3. แสดง Timestamp 
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

// **ฟังก์ชัน: สำหรับจัดการการเข้าร่วมห้อง**
function joinRoom(roomName, roomPassword = '') {
    if (!username) {
        alert('กรุณาเข้าสู่ระบบก่อน');
        return;
    }
    
    currentRoom = roomName; 

    if (currentRoomNameDisplay) {
        currentRoomNameDisplay.textContent = `ห้อง: ${currentRoom}`;
    }

    ws.send(JSON.stringify({ 
        type: 'createRoom', 
        room: roomName,
        password: roomPassword
    }));
    
    document.querySelectorAll('.room-item').forEach(item => {
        item.classList.remove('selected');
        if (item.textContent === roomName) {
            item.classList.add('selected');
        }
    });
}


ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Login / Register Response
    if(data.type === 'login') {
        if(data.success) {
            document.getElementById('loginArea').style.display='none';
            chatContainer.style.display='flex';
            if (chatContent) chatContent.style.display = 'none'; 
        } else alert(data.message);
    }
    
    // **[แก้ไข]** เมื่อสมัครสมาชิกสำเร็จ ให้กลับไปโหมด Login
    if(data.type === 'register') {
        if(data.success) {
            alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านของคุณ');
            setLoginMode(); // กลับไปโหมด Login ทันที
            usernameInput.value = ''; // ล้างฟอร์ม
            passwordInput.value = '';
        } else alert(data.message);
    }
    
    // ===== History (เปิดเผยส่วนแชทเมื่อเข้าร่วมห้องสำเร็จ) =====
    if(data.type === 'history') {
        messagesDiv.innerHTML = ''; 
        currentRoom = data.room; 

        if (currentRoomNameDisplay) {
            currentRoomNameDisplay.textContent = `ห้อง: ${currentRoom}`;
        }
        if (chatContent) chatContent.style.display = 'flex'; 

        data.messages.forEach(msg => {
            displayMessage(msg);
        });
        
        document.querySelectorAll('.room-item').forEach(item => {
            item.classList.remove('selected');
            if (item.textContent === data.room) {
                item.classList.add('selected');
            }
        });
    }
    
    // **[เพิ่ม]** กรณีเข้าร่วมห้องไม่สำเร็จ (เช่น รหัสห้องไม่ถูกต้อง)
    if(data.type === 'joinFailed') {
        alert(data.message);
        currentRoom = null; 
        if (chatContent) chatContent.style.display = 'none';
        if (currentRoomNameDisplay) currentRoomNameDisplay.textContent = '';
    }

    // ===== Rooms (อัปเดต: ทำให้คลิกได้) =====
    if(data.type === 'roomList') {
        roomList.innerHTML = '';
        
        data.rooms.forEach(roomName => {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            roomDiv.textContent = roomName;
            roomDiv.title = 'คลิกเพื่อเข้าร่วมห้อง ' + roomName;
            
            roomDiv.addEventListener('click', () => {
                const roomPassword = roomPasswordInput ? roomPasswordInput.value.trim() : '';
                joinRoom(roomName, roomPassword); 
            });

            if (roomName === currentRoom) {
                roomDiv.classList.add('selected');
            }
            
            roomList.appendChild(roomDiv);
        });
    }

    // ===== New Message (ใช้ displayMessage) =====
    if(data.type === 'message' || data.type === 'file') {
        if (data.room === currentRoom) {
            if (data.from !== username) { // ไม่แสดงข้อความของตัวเองซ้ำ
                displayMessage(data); 
            }
        }
    }
};

// --- Event Listeners (ใช้ฟังก์ชัน submit/toggle แทน) ---

// Event Listener สำหรับปุ่ม "สร้าง/เข้าร่วมห้อง"
createRoomBtn.addEventListener('click', () => {
    const room = roomInput.value.trim();
    const password = roomPasswordInput ? roomPasswordInput.value.trim() : ''; 
    
    if(!room) return alert('กรุณาระบุชื่อห้อง');
    
    joinRoom(room, password); 
    
    roomInput.value = '';
    if (roomPasswordInput) roomPasswordInput.value = '';
});

// Event Listener ส่งข้อความ (แสดงผลทันที)
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
const inputArea = document.querySelector('.input-area');
if (inputArea) {
    inputArea.appendChild(sendFileBtn); 
    inputArea.appendChild(fileInput); 
}


sendFileBtn.addEventListener('click', () => {
    if(!currentRoom) return alert('เลือกห้องก่อนส่งไฟล์');
    fileInput.click();
});

// Event Listener ส่งไฟล์ (แสดงผลทันที)
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