let ws;
let username;
let currentRoom;

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

// **การเชื่อมต่อ WebSocket แบบ Dynamic** (รองรับ Render Deployment)
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const host = window.location.host;
ws = new WebSocket(`${protocol}://${host}`);

// **ฟังก์ชันใหม่: สำหรับแสดงข้อความใน DOM (รวมชื่อผู้ส่ง/Bubble)**
function displayMessage(msgData) {
    const isMine = msgData.from === username;
    const msgDiv = document.createElement('div');
    
    // กำหนด Class และตำแหน่ง
    msgDiv.className = `message ${isMine ? 'my-message' : 'other-message'}`;

    // 1. แสดงชื่อผู้ส่ง (แสดงสำหรับข้อความคนอื่นเท่านั้น หรือข้อความประเภทอื่นๆ ที่ไม่ใช่ข้อความปกติ)
    if (!isMine) {
        const senderSpan = document.createElement('div');
        senderSpan.className = 'message-sender';
        senderSpan.textContent = msgData.from;
        msgDiv.appendChild(senderSpan);
    }

    // 2. แสดงเนื้อหาข้อความ
    const contentP = document.createElement('p');
    contentP.textContent = msgData.content;
    msgDiv.appendChild(contentP);

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
    // เลื่อนลงไปด้านล่างสุดเสมอ
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// **ฟังก์ชันใหม่: สำหรับจัดการการเข้าร่วมห้อง**
function joinRoom(roomName) {
    if (!username) {
        alert('กรุณาเข้าสู่ระบบก่อน');
        return;
    }
    // ส่งคำสั่ง 'createRoom' เพื่อให้เซิร์ฟเวอร์จัดการการเข้าร่วม/สร้างห้อง
    ws.send(JSON.stringify({ type: 'createRoom', room: roomName }));
    
    // อัปเดต UI ให้เน้นห้องที่เลือก
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
            // เมื่อ Login สำเร็จ ให้เซิร์ฟเวอร์ส่ง roomList มา
            ws.send(JSON.stringify({ type: 'getRooms' })); // Optional: ถ้าอยากให้ server ส่ง roomList ทันที
        } else alert(data.message);
    }
    if(data.type === 'register') {
        if(data.success) alert('สมัครสมาชิกสำเร็จ!');
        else alert(data.message);
    }
    
    // ===== History (ใหม่) =====
    if(data.type === 'history') {
        messagesDiv.innerHTML = ''; // ล้างข้อความเก่าก่อนแสดงประวัติ
        currentRoom = data.room; // ตั้งค่าห้องปัจจุบัน

        // แสดงข้อความในประวัติทั้งหมด
        data.messages.forEach(msg => {
            displayMessage(msg);
        });
        
        // อัปเดต UI ให้เน้นห้องที่เข้าร่วมใหม่
        document.querySelectorAll('.room-item').forEach(item => {
            item.classList.remove('selected');
            if (item.textContent === data.room) {
                item.classList.add('selected');
            }
        });
    }

    // ===== Rooms (อัปเดต: ทำให้คลิกได้) =====
    if(data.type === 'roomList') {
        roomList.innerHTML = '';
        
        data.rooms.forEach(roomName => {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            roomDiv.textContent = roomName;
            roomDiv.title = 'คลิกเพื่อเข้าร่วมห้อง ' + roomName;
            
            // **เชื่อมต่อกับฟังก์ชัน joinRoom**
            roomDiv.addEventListener('click', () => {
                joinRoom(roomName); 
            });

            // ตรวจสอบและใส่ class 'selected' หากห้องนั้นเป็นห้องปัจจุบัน
            if (roomName === currentRoom) {
                roomDiv.classList.add('selected');
            }
            
            roomList.appendChild(roomDiv);
        });
    }

    // ===== New Message (ใช้ displayMessage) =====
    if(data.type === 'message' || data.type === 'file') {
        displayMessage(data); 
    }
};

// --- Event Listeners ---

registerBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if(!username || !password) return alert('กรอกข้อมูลให้ครบ');
    ws.send(JSON.stringify({ type:'register', username, password }));
});

loginBtn.addEventListener('click', () => {
    username = usernameInput.value.trim(); // เก็บ username ในตัวแปร global
    const password = passwordInput.value;
    if(!username || !password) return alert('กรอกข้อมูลให้ครบ');
    ws.send(JSON.stringify({ type:'login', username, password }));
});

// Event Listener สำหรับปุ่ม "สร้าง/เข้าร่วมห้อง"
createRoomBtn.addEventListener('click', () => {
    const room = roomInput.value.trim();
    if(!room) return alert('กรุณาระบุชื่อห้อง');
    
    joinRoom(room); // ใช้ฟังก์ชัน joinRoom เพื่อจัดการ
    roomInput.value = '';
});

sendBtn.addEventListener('click', () => {
    const content = messageInput.value.trim();
    if(!content || !currentRoom) return alert('เลือกห้องหรือกรอกข้อความ');

    // 1. สร้าง Object ข้อมูลที่คล้ายกับที่เซิร์ฟเวอร์จะสร้าง
    const tempMsgData = {
        type: 'message',
        from: username, // ใช้ชื่อผู้ใช้ที่เราเก็บไว้
        room: currentRoom,
        content: content,
        timestamp: new Date().toLocaleTimeString() // สร้าง Timestamp ทันที
    };
    
    // 2. ส่งข้อมูลไปยังเซิร์ฟเวอร์ (เพื่อบันทึกประวัติและ Broadcast)
    ws.send(JSON.stringify(tempMsgData));
    
    // 3. **(ส่วนที่เพิ่ม/แก้ไข)**: เรียกใช้ฟังก์ชันแสดงข้อความทันทีบน Client ของตัวเอง
    displayMessage(tempMsgData);

    messageInput.value = '';
});

//

// ส่งไฟล์
const sendFileBtn = document.createElement('button');
sendFileBtn.textContent = 'ส่งไฟล์';
document.querySelector('.input-area').appendChild(sendFileBtn); // เพิ่มปุ่มส่งไฟล์
document.querySelector('.input-area').appendChild(fileInput); // ซ่อน file input

sendFileBtn.addEventListener('click', () => {
    if(!currentRoom) return alert('เลือกห้องก่อนส่งไฟล์');
    fileInput.click();
});

fileInput.addEventListener('change', () => {
    if(!fileInput.files[0]) return;
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        // ส่งข้อมูลไฟล์เป็น Base64
        ws.send(JSON.stringify({
            type: 'file',
            filename: file.name,
            content: e.target.result // Base64 data
        }));
    };
    reader.readAsDataURL(file);
});