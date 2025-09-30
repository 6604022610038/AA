const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// ใช้ PORT จาก Environment Variable (สำคัญสำหรับการ Deploy บน Render)
const PORT = process.env.PORT || 8080;

// 1. สร้าง Express App และ HTTP Server
const app = express();
const server = http.createServer(app);

// 2. กำหนดให้ Express เสิร์ฟไฟล์คงที่
app.use(express.static(path.join(__dirname, '/')));

const wss = new WebSocket.Server({ server });

// โครงสร้างข้อมูลที่ปรับปรุงแล้ว: เก็บ lastRoom
let users = {}; // { username: { password: '...', lastRoom: 'ชื่อห้องล่าสุด' } }
let clients = []; // { ws, username, room }
let rooms = {}; // { roomName: { users: [username,...], history: [...] } }

// 3. ให้ HTTP Server เริ่มฟังการเชื่อมต่อ
server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

function leaveRoom(ws) {
    if(rooms[ws.room]) {
        rooms[ws.room].users = rooms[ws.room].users.filter(u => u !== ws.username);
        // ลบห้องถ้าไม่มีผู้ใช้เหลืออยู่ (ทำให้ห้องหายไปจาก Room List)
        if(rooms[ws.room].users.length === 0) delete rooms[ws.room]; 
    }
    ws.room = null;
}

// **ฟังก์ชันใหม่: จัดการการเข้าร่วมห้องภายใน (ใช้ซ้ำในการเข้าห้องปกติและการคืนค่าห้องเดิม)**
function joinRoomInternal(ws, roomName) {
    // 1. ออกจากห้องเก่าก่อน (ถ้ามี)
    if(ws.room) leaveRoom(ws);

    // 2. สร้างห้องถ้ายังไม่มี
    if(!rooms[roomName]) {
        rooms[roomName] = { users: [], history: [] };
    }

    // 3. เข้าร่วมห้องใหม่
    rooms[roomName].users.push(ws.username);
    ws.room = roomName;
    
    // 4. บันทึกห้องล่าสุดในข้อมูลผู้ใช้ถาวร (อัปเดตทุกครั้งที่ผู้ใช้เข้าห้องใหม่)
    if (users[ws.username]) {
        users[ws.username].lastRoom = roomName;
    }

    // 5. ส่งประวัติแชทของห้องนี้ให้ผู้ใช้ที่เพิ่งเข้าร่วม
    ws.send(JSON.stringify({ 
        type: 'history', 
        room: roomName, 
        messages: rooms[roomName].history || [] 
    }));

    broadcastRooms();
}

function broadcastRooms() {
    const roomNames = Object.keys(rooms);
    clients.forEach(c => {
        if(c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type:'roomList', rooms:roomNames }));
        }
    });
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
                // **แก้ไข: Store เป็น Object**
                users[data.username] = { 
                    password: data.password, 
                    lastRoom: null 
                };
                ws.send(JSON.stringify({ type: 'register', success:true }));
            }
        }

        // ===== Login (อนุญาตให้ reconnect และคืนค่าห้องเดิม) =====
        if(data.type === 'login') {
            if(users[data.username] && users[data.username].password === data.password) {
                
                // ไม่จำเป็นต้องเช็คการล็อกอินซ้ำซ้อนแล้ว อนุญาตให้เซสชั่นใหม่เข้ามา
                ws.username = data.username;
                clients.push({ ws, username:data.username, room:null });
                ws.send(JSON.stringify({ type:'login', success:true }));

                // **ส่วนใหม่: คืนค่าห้องล่าสุด**
                if (users[data.username].lastRoom) {
                    // เรียก joinRoomInternal เพื่อให้ผู้ใช้กลับเข้าห้องเดิมและรับประวัติ
                    joinRoomInternal(ws, users[data.username].lastRoom);
                } else {
                    // ถ้าไม่มีห้องล่าสุด ให้ Broadcast Room List
                    broadcastRooms();
                }

            } else {
                ws.send(JSON.stringify({ type:'login', success:false, message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }));
            }
        }

        // ===== Create Room / Join Room Logic =====
        if(data.type === 'createRoom' && ws.username) {
            const roomName = data.room;
            joinRoomInternal(ws, roomName);
        }

        // ===== Send Message (เก็บ History) =====
        if((data.type === 'message' || data.type === 'file') && ws.username && ws.room) {
            const msgData = {
                type: data.type,
                from: ws.username,
                room: ws.room,
                content: data.content || null,
                filename: data.filename || null,
                timestamp: new Date().toLocaleTimeString() 
            };

            // 1. บันทึกข้อความลงในประวัติ
            rooms[ws.room].history.push(msgData);

            // 2. ส่งข้อความไปยังผู้ใช้ทั้งหมดในห้อง
            clients.forEach(c => {
                if(c.ws.readyState === WebSocket.OPEN && c.room === ws.room) {
                    c.ws.send(JSON.stringify(msgData));
                }
            });
        }
    });

    ws.on('close', () => {
        // 1. **ส่วนใหม่: บันทึกห้องปัจจุบันก่อนตัดการเชื่อมต่อ**
        if (ws.username && ws.room && users[ws.username]) {
            users[ws.username].lastRoom = ws.room;
        }

        // 2. จัดการการออกจากห้องและลบ client
        if(ws.room) leaveRoom(ws);
        
        clients = clients.filter(c => c.ws !== ws);
        broadcastRooms();
    });
});