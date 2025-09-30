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

// **[แก้ไข/เพิ่ม]** ตัวแปร DOM Element ใหม่ 2 ตัว
const chatContent = document.getElementById('chatContent'); 
const currentRoomNameDisplay = document.getElementById('currentRoomNameDisplay'); // <--- แก้ไขตรงนี้

// **การเชื่อมต่อ WebSocket แบบ Dynamic** (รองรับ Render Deployment)
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const host = window.location.host;
ws = new WebSocket(`${protocol}://${host}`);

// **ฟังก์ชัน: สำหรับแสดงข้อความใน DOM (รวมชื่อผู้ส่ง/Bubble/ไฟล์มีเดีย)**
function displayMessage(msgData) {
    const isMine = msgData.from === username;
    const msgDiv = document.createElement('div');
    
    // กำหนด Class และตำแหน่ง
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
        // ดึง MIME Type จาก Base64 string
        const mimeType = fileContent.substring(5, fileContent.indexOf(';')); 

        if (mimeType.startsWith('image/')) {
            // **ถ้าเป็นรูปภาพ: แสดงรูปภาพ**
            const img = document.createElement('img');
            img.src = fileContent;
            img.alt = filename;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '5px';
            contentWrapper.appendChild(img);
            
        } else if (mimeType.startsWith('audio/')) {
            // **ถ้าเป็นไฟล์เสียง: แสดง Audio Player**
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = fileContent;
            audio.style.width = '100%';
            contentWrapper.appendChild(audio);

        } else {
            // **ถ้าเป็นไฟล์อื่นๆ: แสดงชื่อไฟล์และปุ่มดาวน์โหลด**
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
    
    // เพิ่ม Content Wrapper ลงใน Message Bubble
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
function joinRoom(roomName) {
    if (!username) {
        alert('กรุณาเข้าสู่ระบบก่อน');
        return;
    }
    
    // ตั้งค่า currentRoom ที่นี่ทันที
    currentRoom = roomName; 

    // **[เพิ่ม]** อัปเดตชื่อห้องที่แสดง
    if (currentRoomNameDisplay) {
        currentRoomNameDisplay.textContent = `ห้อง: ${currentRoom}`;
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
            // ซ่อนส่วนแชทไว้ก่อนหลัง Login
            if (chatContent) chatContent.style.display = 'none'; 
            username = usernameInput.value.trim(); 
        } else alert(data.message);
    }
    if(data.type === 'register') {
        if(data.success) alert('สมัครสมาชิกสำเร็จ!');
        else alert(data.message);
    }
    
    // ===== History (เปิดเผยส่วนแชทเมื่อเข้าร่วมห้องสำเร็จ) =====
    if(data.type === 'history') {
        messagesDiv.innerHTML = ''; 
        currentRoom = data.room; 

        // **[เพิ่ม]** อัปเดตชื่อห้องที่แสดงอีกครั้ง
        if (currentRoomNameDisplay) {
            currentRoomNameDisplay.textContent = `ห้อง: ${currentRoom}`;
        }
        // แสดงส่วนแชทออกมาเมื่อเข้าห้องสำเร็จ
        if (chatContent) chatContent.style.display = 'flex'; 

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
    // ข้อความที่มาจาก Server (ที่ถูก Broadcast)
    if(data.type === 'message' || data.type === 'file') {
        // ต้องมั่นใจว่าข้อความนั้นมาจากห้องปัจจุบันเท่านั้น
        if (data.room === currentRoom) {
            displayMessage(data); 
        }
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
    // เก็บ username ไว้ทันทีเพื่อให้ joinRoom ใช้งานได้
    username = usernameInput.value.trim(); 
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

// Event Listener ส่งข้อความ (แสดงผลทันที)
sendBtn.addEventListener('click', () => {
    const content = messageInput.value.trim();
    
    if(!content || !currentRoom || !username) {
        return alert('กรุณาเข้าสู่ระบบและเข้าร่วมห้องก่อนส่งข้อความ');
    }

    // 1. สร้าง Object ข้อมูลชั่วคราว
    const tempMsgData = {
        type: 'message',
        from: username,
        room: currentRoom,
        content: content,
        timestamp: new Date().toLocaleTimeString() 
    };
    
    // 2. ส่งข้อมูลไปยังเซิร์ฟเวอร์
    ws.send(JSON.stringify(tempMsgData));
    
    // 3. แสดงข้อความทันทีบน Client ของตัวเอง
    displayMessage(tempMsgData);

    messageInput.value = '';
});


// ส่งไฟล์
const sendFileBtn = document.createElement('button');
sendFileBtn.textContent = 'ส่งไฟล์';
document.querySelector('.input-area').appendChild(sendFileBtn); 
document.querySelector('.input-area').appendChild(fileInput); 

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
            content: e.target.result, // Base64 data (รวม MIME Type)
            timestamp: new Date().toLocaleTimeString() 
        };

        // 1. ส่งข้อมูลไปยังเซิร์ฟเวอร์
        ws.send(JSON.stringify(fileData));

        // 2. แสดงไฟล์ที่ส่งทันทีบนหน้าแชทของตัวเอง
        displayMessage(fileData);
    };

    reader.readAsDataURL(file);
});