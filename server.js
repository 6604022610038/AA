const WebSocket = require('ws');
const fs = require('fs');
const express = require('express');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 8080;

// 1. สร้าง Express App และ HTTP Server
const app = express();
const server = http.createServer(app);

// 2. กำหนดให้ Express เสิร์ฟไฟล์คงที่
app.use(express.static(path.join(__dirname)));

// 3. WebSocket Server
const wss = new WebSocket.Server({ server });

let users = {}; 
let clients = []; 
let roomData = {}; // { roomName: { password: 'pass', members: [username, ...], history: [{type, from, content, ...}, ...] } }

// โหลดข้อมูลที่มีอยู่ (ถ้ามี)
try {
    const data = fs.readFileSync('data.json');
    const loadedData = JSON.parse(data);
    users = loadedData.users || {};
    roomData = loadedData.rooms || {};
    
    // ล้างผู้ใช้ในห้องออกเมื่อ Server เริ่มต้นใหม่
    Object.keys(roomData).forEach(roomName => {
        if (!roomData[roomName].members) {
            roomData[roomName].members = [];
        } else {
            roomData[roomName].members = [];
        }
    });
    console.log('Data loaded successfully.');
} catch (e) {
    console.log('No data file found or failed to load data. Starting fresh.');
}

function saveData() {
    const dataToSave = {
        users: users,
        // บันทึกเฉพาะ password และ history ของห้อง
        rooms: Object.keys(roomData).reduce((acc, key) => {
            acc[key] = {
                password: roomData[key].password || '',
                history: roomData[key].history || []
            };
            return acc;
        }, {})
    };
    fs.writeFileSync('data.json', JSON.stringify(dataToSave, null, 2));
}

function findClient(ws) {
    return clients.find(c => c.ws === ws);
}

function getTimestamp() {
    return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

// **[MODIFIED FUNCTION]** ฟังก์ชันส่งรายชื่อห้องทั้งหมดที่มี (ไม่รวมรหัสผ่าน)
function sendAvailableRooms(ws) {
    const availableRooms = Object.keys(roomData).map(roomName => ({
        room: roomName,
        // ส่ง flag บอกว่าเป็น private room 
        isPrivate: !!roomData[roomName].password 
    }));
    ws.send(JSON.stringify({ type: 'availableRooms', rooms: availableRooms }));
}


wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
        let data;
        try { data = JSON.parse(msg); }
        catch(e) { return; }
        
        const clientInfo = findClient(ws) || { username: data.username, room: null };
        
        // ===== Register / Login Logic =====
        if(data.type === 'register') {
            if(users[data.username]) {
                ws.send(JSON.stringify({ type: 'register', success:false, message:'มีผู้ใช้นี้แล้ว' }));
            } else {
                users[data.username] = data.password;
                saveData(); 
                ws.send(JSON.stringify({ type: 'register', success:true }));
            }
            return;
        }

        if(data.type === 'login') {
            const storedPassword = users[data.username];
            // [FIXED] อนุญาตให้ Login ด้วยรหัสว่าง (สำหรับ Auto-login)
            if(storedPassword && (storedPassword === data.password || data.password === '')) {
                if (!clientInfo.username) {
                    ws.username = data.username;
                    clients.push({ ws, username: data.username, room: null });
                }
                ws.send(JSON.stringify({ type: 'login', success:true }));
                
                // **[KEY FIX]** ส่งรายชื่อห้องทั้งหมดที่มีทันทีหลัง Login สำเร็จ
                sendAvailableRooms(ws); 
                
            } else {
                ws.send(JSON.stringify({ type: 'login', success:false, message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }));
            }
            return;
        }
        
        if (!ws.username) return; 

        // ===== Create/Join Room Logic (รวมการแก้ไขรหัสผ่าน) =====
        if(data.type === 'createRoom') { 
            const roomName = data.room;
            const roomPassword = data.password || ''; 
            const isNewRoom = data.isNewRoom;

            // --- 1. ออกจากห้องเก่า ---
            if (clientInfo.room && roomData[clientInfo.room]) {
                roomData[clientInfo.room].members = roomData[clientInfo.room].members.filter(u => u !== ws.username);
            }
            clientInfo.room = null;

            // --- 2. สร้างห้องใหม่ ---
            if (isNewRoom) {
                if (roomData[roomName]) {
                    ws.send(JSON.stringify({ type: 'joinFailed', message: 'ห้องชื่อนี้มีอยู่แล้ว กรุณาเลือก "เข้าร่วม" แทน' }));
                    return;
                }
                
                roomData[roomName] = { 
                    password: roomPassword, 
                    members: [], 
                    history: []
                };
                saveData();
                
                // **[NEW]** เมื่อสร้างห้องใหม่สำเร็จ ให้ส่งรายชื่อห้องทั้งหมดไปยัง Client เพื่ออัปเดต UI
                sendAvailableRooms(ws);
            }
            
            // --- 3. เข้าร่วม/สลับห้องที่มีอยู่ ---
            if (!roomData[roomName]) {
                ws.send(JSON.stringify({ type: 'joinFailed', message: 'ห้องนี้ไม่มีอยู่' }));
                return;
            }

            const existingRoom = roomData[roomName];
            
            // **[FIXED]** ตรวจสอบรหัสผ่าน: อนุญาตให้ผ่านเมื่อสลับห้อง (ส่งรหัสว่างมา)
            if (existingRoom.password) {
                // ถ้ามีการส่งรหัสผ่านมา และรหัสที่ส่งมาไม่ตรงกัน ให้ปฏิเสธ
                if (roomPassword && existingRoom.password !== roomPassword) {
                    ws.send(JSON.stringify({ type: 'joinFailed', message: 'รหัสผ่านห้องไม่ถูกต้อง' }));
                    return;
                }
            }
            
            // เข้าร่วมห้อง
            if (!existingRoom.members.includes(ws.username)) {
                existingRoom.members.push(ws.username);
            }
            clientInfo.room = roomName;

            // ส่ง History กลับไป
            ws.send(JSON.stringify({ 
                type: 'history', 
                room: roomName, 
                messages: existingRoom.history 
            }));
            return;
        }

        // ===== Send Message / File Logic & Logout Logic (เหมือนเดิม) =====
        if((data.type === 'message' || data.type === 'file') && ws.username && clientInfo.room) {
            const roomName = clientInfo.room;
            const currentRoom = roomData[roomName];
            if (!currentRoom) return;
            const msgData = {
                type: data.type,
                from: ws.username,
                room: roomName,
                content: data.content || null,
                filename: data.filename || null,
                timestamp: getTimestamp()
            };
            currentRoom.history.push(msgData);
            saveData(); 
            clients.forEach(c => {
                if(c.ws.readyState === WebSocket.OPEN && c.room === roomName) {
                    if (c.username !== ws.username) {
                         c.ws.send(JSON.stringify(msgData));
                    }
                }
            });
            return;
        }
        
        if(data.type === 'logout') {
            ws.send(JSON.stringify({ type: 'logout', success: true }));
            return;
        }
    });

    ws.on('close', () => {
        const clientInfo = findClient(ws);
        if (clientInfo) {
            if(clientInfo.room && roomData[clientInfo.room]) {
                roomData[clientInfo.room].members = roomData[clientInfo.room].members.filter(u => u !== clientInfo.username);
            }
            clients = clients.filter(c => c.ws !== ws);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});