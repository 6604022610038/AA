const WebSocket = require('ws');
const fs = require('fs');
const express = require('express');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 8080;

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname)));

const wss = new WebSocket.Server({ server });

let users = {}; 
let clients = []; 
let rooms = {}; 

// โหลดข้อมูลที่มีอยู่ (ถ้ามี)
try {
    const data = fs.readFileSync('data.json');
    const loadedData = JSON.parse(data);
    users = loadedData.users || {};
    rooms = loadedData.rooms || {};
    
    // [แก้ไข/เพิ่ม] สำหรับรองรับโครงสร้างข้อมูลใหม่: joinedRoomsList
    Object.keys(users).forEach(username => {
        if (!users[username].joinedRoomsList) {
            // หากไม่มี joinedRoomsList ให้สร้างและใส่ lastRoom ที่เคยมีอยู่เข้าไป
            users[username].joinedRoomsList = users[username].lastRoom ? [users[username].lastRoom] : [];
        }
    });

    Object.keys(rooms).forEach(roomName => {
        if (!rooms[roomName].users) {
            rooms[roomName].users = new Set();
        } else {
            rooms[roomName].users = new Set(Array.from(rooms[roomName].users));
        }
    });
    console.log('Data loaded successfully.');
} catch (e) {
    console.log('No data file found or failed to load data. Starting fresh.');
}

function saveData() {
    const dataToSave = {
        users: users,
        rooms: Object.keys(rooms).reduce((acc, key) => {
            acc[key] = {
                password: rooms[key].password,
                history: rooms[key].history
            };
            return acc;
        }, {})
    };
    fs.writeFileSync('data.json', JSON.stringify(dataToSave, null, 2));
}

// **[แก้ไขหลัก]** ฟังก์ชันส่งรายการห้องที่ "เคยเข้า" หรือ "กำลังเข้า" เท่านั้น
function sendAvailableRooms(ws) {
    if (!ws.username || ws.readyState !== WebSocket.OPEN) return;

    // 1. ดึงชื่อห้องทั้งหมดจาก joinedRoomsList
    const userJoinedRooms = [];
    if (users[ws.username] && users[ws.username].joinedRoomsList) {
        userJoinedRooms.push(...users[ws.username].joinedRoomsList);
    }

    // 2. ลบห้องซ้ำ และแปลงเป็นรูปแบบที่ Client ต้องการ
    const uniqueRooms = [...new Set(userJoinedRooms)].map(roomName => ({
        room: roomName
    }));

    // 3. ส่งข้อมูลกลับ
    ws.send(JSON.stringify({ type: 'availableRooms', rooms: uniqueRooms }));
}


function leaveRoom(ws) {
    if (ws.room && rooms[ws.room]) {
        rooms[ws.room].users.delete(ws.username);
    }
    ws.room = null;
}

// ฟังก์ชันจัดการการสร้าง/เข้าร่วมห้อง
function createOrJoinRoom(ws, roomName, roomPassword = '', isNewRoom = false) { 
    
    if (!ws.username || !roomName) return;

    const roomExists = !!rooms[roomName];

    // 1. ตรวจสอบการสร้างห้องซ้ำ
    if (isNewRoom && roomExists) {
        return ws.send(JSON.stringify({ type:'joinFailed', message:`ห้อง "${roomName}" มีอยู่แล้ว` }));
    }

    // 2. สร้างห้องใหม่ (ถ้ายังไม่มี)
    if(!roomExists) {
        rooms[roomName] = { 
            password: roomPassword, 
            users: new Set(), 
            history: [] 
        };
        saveData(); 
    }

    const room = rooms[roomName];
    
    // 3. ตรวจสอบรหัสผ่าน
    if (room.password) {
        
        const isRejoiningRoom = (users[ws.username] && users[ws.username].lastRoom === roomName);
        
        if (roomPassword === room.password || (roomPassword === '' && isRejoiningRoom)) {
            // รหัสผ่านถูกต้อง หรือเป็น Auto-rejoin ในห้องที่เคยเข้าล่าสุด (เข้าได้เลย)
        } else {
             // รหัสผ่านไม่ถูกต้อง
             return ws.send(JSON.stringify({ type:'joinFailed', message:'รหัสห้องไม่ถูกต้อง' }));
        }
    }
    
    // 4. ออกจากห้องเก่า (ถ้ามี)
    leaveRoom(ws);

    // 5. เข้าร่วมห้องใหม่
    room.users.add(ws.username);
    ws.room = roomName;
    
    // 6. บันทึกห้องล่าสุดและรายชื่อห้องทั้งหมดที่เข้าร่วม
    if (users[ws.username]) {
        users[ws.username].lastRoom = roomName;
        // [แก้ไข/เพิ่ม]: บันทึกชื่อห้องลงในรายการห้องที่เคยเข้าร่วมทั้งหมด
        if (!users[ws.username].joinedRoomsList.includes(roomName)) {
            users[ws.username].joinedRoomsList.push(roomName);
        }
    }
    saveData();
    
    // 7. [FIX] ส่งรายการห้องที่อัปเดตกลับไปหาผู้ใช้คนนี้คนเดียว (เพราะมีการอัปเดต lastRoom/joinedRoomsList)
    sendAvailableRooms(ws);

    // 8. ส่งประวัติแชทกลับไป
    ws.send(JSON.stringify({ 
        type: 'history', 
        room: roomName, 
        messages: room.history 
    }));
}


wss.on('connection', (ws) => {
    
    ws.on('message', (msg) => {
        let data;
        try { data = JSON.parse(msg); } 
        catch(e) { return; }

        // ===== Register =====
        if(data.type === 'register') {
            if(users[data.username]) {
                ws.send(JSON.stringify({ type: 'register', success:false, message:'มีผู้ใช้นี้แล้ว' }));
            } else {
                users[data.username] = { 
                    password: data.password, 
                    lastRoom: null,
                    joinedRoomsList: [] // [แก้ไข/เพิ่ม]: เพิ่มรายการห้องที่เคยเข้า
                };
                saveData(); 
                ws.send(JSON.stringify({ type: 'register', success:true }));
            }
        }

        // ===== Login (คืนค่าห้องเดิม) =====
        if(data.type === 'login') {
            if(users[data.username] && (data.password === '' || users[data.username].password === data.password)) {
                
                // 1. เตรียม Client Session
                ws.username = data.username;
                clients = clients.filter(c => c.username !== ws.username);
                clients.push({ ws, username:data.username, room:null });
                ws.send(JSON.stringify({ type:'login', success:true }));
                
                // **[FIX] ส่งรายการห้องที่เคยเข้าทั้งหมด**
                sendAvailableRooms(ws);

                // 2. คืนค่าห้องล่าสุด (Auto-rejoin)
                const lastRoom = users[data.username].lastRoom;
                if (lastRoom && rooms[lastRoom]) {
                    createOrJoinRoom(ws, lastRoom, ''); // ส่งรหัสว่างเพื่อ Auto-rejoin
                }
            } else {
                ws.send(JSON.stringify({ type:'login', success:false, message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }));
            }
        }

        // ===== Create/Join Room (จัดการรหัสห้องและประวัติ) =====
        if(data.type === 'createRoom' && ws.username) {
            createOrJoinRoom(ws, data.room, data.password, data.isNewRoom);
        }
        
        // ... (ส่วนอื่นๆ ไม่มีการเปลี่ยนแปลง) ...
    });

    ws.on('close', () => {
        // 1. บันทึกห้องปัจจุบันก่อนตัดการเชื่อมต่อ
        if (ws.username && ws.room && users[ws.username]) {
            users[ws.username].lastRoom = ws.room;
            saveData(); 
        }

        // 2. จัดการการออกจากห้องและลบ client
        leaveRoom(ws);
        clients = clients.filter(c => c.ws !== ws);
    });
});

// 3. ให้ HTTP Server เริ่มฟังการเชื่อมต่อ
server.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});