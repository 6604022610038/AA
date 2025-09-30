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

// ฟังก์ชันส่งรายการห้องทั้งหมด (ถาวร) ไปยัง Client
function sendAvailableRooms(ws) {
    const availableRooms = Object.keys(rooms).map(roomName => ({
        room: roomName
    }));

    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'availableRooms', rooms: availableRooms }));
    }
}

function leaveRoom(ws) {
    if (ws.room && rooms[ws.room]) {
        rooms[ws.room].users.delete(ws.username);
    }
    ws.room = null;
}


// **[แก้ไขหลัก]** ฟังก์ชันจัดการการสร้าง/เข้าร่วมห้อง
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
        // แจ้งให้ Client ทุกคนทราบว่ามีห้องใหม่ถูกสร้าง
        clients.forEach(c => sendAvailableRooms(c.ws));
    }

    const room = rooms[roomName];
    
    // 3. ตรวจสอบรหัสผ่าน **(ปรับปรุง Logic ที่นี่)**
    if (room.password) { // ถ้าห้องมีรหัสผ่าน (Private Room)
        
        // **เงื่อนไขใหม่:** ตรวจสอบว่าห้องนี้เป็นห้องล่าสุดที่เคยเข้าหรือไม่
        const isRejoiningRoom = (users[ws.username] && users[ws.username].lastRoom === roomName);
        
        // อนุญาตให้เข้าได้ 3 กรณี:
        // 1. รหัสผ่านถูกต้อง (Join ครั้งแรก/Rejoin ด้วยรหัสผ่าน)
        // 2. รหัสผ่านเป็นค่าว่าง (สลับห้อง/Auto-rejoin) และเป็นห้องที่เคยเข้าล่าสุด
        // 3. รหัสผ่านเป็นค่าว่าง (สลับห้อง/Auto-rejoin) และผู้ใช้ไม่ได้พยายามส่งรหัสใหม่ แต่ห้องเป็นห้องเดิมที่เคยเข้ามาก่อน
        if (roomPassword === room.password || (roomPassword === '' && isRejoiningRoom)) {
            // รหัสผ่านถูกต้อง หรือเป็น Auto-rejoin ในห้องที่เคยเข้าล่าสุด
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
    
    // 6. บันทึกห้องล่าสุด
    if (users[ws.username]) {
        users[ws.username].lastRoom = roomName;
    }
    saveData();

    // 7. ส่งประวัติแชทกลับไป
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
                    lastRoom: null 
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
                
                // ส่งรายการห้องทั้งหมดที่มี (ถาวร)
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
        
        // ===== Logout =====
        if(data.type === 'logout' && ws.username) {
            if (users[ws.username] && ws.room) {
                users[ws.username].lastRoom = ws.room; // บันทึกห้องล่าสุด
                saveData();
            }
            leaveRoom(ws);
            clients = clients.filter(c => c.ws !== ws);
            ws.send(JSON.stringify({ type: 'logout', success: true }));
        }


        // ===== Send Message / File (บันทึกประวัติและ Broadcast) =====
        if((data.type === 'message' || data.type === 'file') && ws.username && ws.room) {
            const msgData = {
                type: data.type,
                from: ws.username,
                room: ws.room,
                content: data.content || null,
                filename: data.filename || null,
                timestamp: data.timestamp // ใช้ timestamp จาก Client (renderer.js)
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
                    // ไม่ต้องส่งกลับไปหาตัวเองเพราะ Client แสดงผลเองทันที
                    if (c.username !== ws.username) {
                         c.ws.send(JSON.stringify(msgData));
                    }
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