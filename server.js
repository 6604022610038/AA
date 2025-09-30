const WebSocket = require('ws');
const fs = require('fs'); // ใช้สำหรับบันทึกข้อมูลถาวร
const express = require('express');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 8080;

// 1. สร้าง Express App และ HTTP Server
const app = express();
const server = http.createServer(app);

// 2. กำหนดให้ Express เสิร์ฟไฟล์คงที่
app.use(express.static(path.join(__dirname))); // เสิร์ฟจาก root directory

const wss = new WebSocket.Server({ server });

// โครงสร้างข้อมูลใหม่:
// users: { username: { password: 'xxx', lastRoom: 'ชื่อห้องล่าสุด' } }
// clients: [ { ws, username, room } ]
// rooms: { roomName: { password: 'xxx', users: Set<string>, history: [msgData, ...] } }
let users = {}; 
let clients = []; 
let rooms = {}; 

// โหลดข้อมูลที่มีอยู่ (ถ้ามี)
try {
    const data = fs.readFileSync('data.json');
    const loadedData = JSON.parse(data);
    users = loadedData.users || {};
    rooms = loadedData.rooms || {};
    // ล้างผู้ใช้ในห้องออกเมื่อ Server เริ่มต้นใหม่
    Object.keys(rooms).forEach(roomName => {
        // [ปรับปรุงความเสถียร] ใช้ Set แทน Array ในการเก็บผู้ใช้ที่ออนไลน์อยู่
        rooms[roomName].users = new Set(); 
    });
    console.log('Data loaded successfully.');
} catch (e) {
    console.log('No data file found or failed to load data. Starting fresh.');
}

function saveData() {
    const dataToSave = {
        users: users,
        // บันทึกเฉพาะ password และ history ของห้อง
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

// ฟังก์ชันส่งรายการห้องที่ "ไม่มีรหัส" เท่านั้น (ตามความต้องการ)
function broadcastRooms() {
    const publicRooms = Object.keys(rooms).filter(name => !rooms[name].password); 
    
    clients.forEach(c => {
        if(c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type: 'roomList', rooms: publicRooms }));
        }
    });
}

function leaveRoom(ws) {
    if (ws.room && rooms[ws.room]) {
        // [ปรับปรุงความเสถียร] ใช้ Set.delete
        rooms[ws.room].users.delete(ws.username);
        
        // Broadcast รายการห้องใหม่ (ถ้าห้องที่ออกเป็นห้องสาธารณะ)
        if (!rooms[ws.room].password) {
            broadcastRooms();
        }
    }
    ws.room = null;
}


// **ฟังก์ชันใหม่: จัดการการสร้าง/เข้าร่วมห้อง (รวมถึงการตรวจสอบรหัส)**
function createOrJoinRoom(ws, roomName, roomPassword = '') {
    
    // 1. ตรวจสอบว่าชื่อห้องถูกระบุหรือไม่
    if (!roomName) return;

    if(!rooms[roomName]) {
        // สร้างห้องใหม่
        rooms[roomName] = { 
            password: roomPassword, 
            users: new Set(), // [ปรับปรุงความเสถียร] ใช้ Set
            history: [] 
        };
        saveData(); 
    }

    const room = rooms[roomName];
    
    // 2. ตรวจสอบรหัสผ่าน (ถ้าห้องมีรหัส แต่รหัสที่ส่งมาไม่ถูกต้อง)
    if (room.password && room.password !== roomPassword) {
        // ส่งข้อความแจ้งเตือนกลับไป
        return ws.send(JSON.stringify({ type:'joinFailed', message:'รหัสห้องไม่ถูกต้อง' }));
    }
    
    // 3. ออกจากห้องเก่า (ถ้ามี)
    leaveRoom(ws);

    // 4. เข้าร่วมห้องใหม่
    room.users.add(ws.username); // [ปรับปรุงความเสถียร] ใช้ Set.add
    ws.room = roomName;
    
    // 5. บันทึกห้องล่าสุด
    if (users[ws.username]) {
        users[ws.username].lastRoom = roomName;
    }
    saveData();

    // 6. ส่งประวัติแชทกลับไป (Real-time)
    ws.send(JSON.stringify({ 
        type: 'history', 
        room: roomName, 
        messages: room.history 
    }));
    
    // 7. Broadcast รายการห้องใหม่ (ถ้าเป็นห้องสาธารณะ)
    if (!room.password) {
        broadcastRooms();
    }
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
                    lastRoom: null 
                };
                saveData(); 
                ws.send(JSON.stringify({ type: 'register', success:true }));
            }
        }

        // ===== Login (คืนค่าห้องเดิม) =====
        if(data.type === 'login') {
            if(users[data.username] && users[data.username].password === data.password) {
                
                // 1. เตรียม Client Session
                ws.username = data.username;
                // ลบ Client เก่าออกถ้ามีการ Login ซ้ำ
                clients = clients.filter(c => c.username !== ws.username);
                clients.push({ ws, username:data.username, room:null });
                ws.send(JSON.stringify({ type:'login', success:true }));
                
                // 2. คืนค่าห้องล่าสุด (Auto-rejoin)
                const lastRoom = users[data.username].lastRoom;
                // [ปรับปรุงความเสถียร] ตรวจสอบว่าห้องยังมีอยู่ในระบบก่อน Auto-join
                if (lastRoom && rooms[lastRoom]) {
                    // Try to auto-join the last room without a password 
                    // (Server side logic will check for password in createOrJoinRoom)
                    createOrJoinRoom(ws, lastRoom, ''); 
                } else {
                    // ถ้าไม่มีห้องล่าสุด ให้ Broadcast Room List
                    broadcastRooms(); 
                }
                
            } else {
                ws.send(JSON.stringify({ type:'login', success:false, message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }));
            }
        }

        // ===== Create/Join Room (จัดการรหัสห้องและประวัติ) =====
        if(data.type === 'createRoom' && ws.username) {
            createOrJoinRoom(ws, data.room, data.password);
        }

        // ===== Send Message / File (บันทึกประวัติและ Broadcast) =====
        if((data.type === 'message' || data.type === 'file') && ws.username && ws.room) {
            const msgData = {
                type: data.type,
                from: ws.username,
                room: ws.room,
                content: data.content || null,
                filename: data.filename || null,
                timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) 
            };
            
            const room = rooms[ws.room];
            if (room) {
                // 1. บันทึกประวัติ
                room.history.push(msgData);
                if (room.history.length > 100) { room.history.shift(); } // จำกัดจำนวนประวัติ
                saveData(); 
            }
            
            // 2. Broadcast ข้อความ (Real-time)
            clients.forEach(c => {
                if(c.ws.readyState === WebSocket.OPEN && c.room === ws.room) {
                    c.ws.send(JSON.stringify(msgData));
                }
            });
        }
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