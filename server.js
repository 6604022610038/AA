const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// ใช้ PORT จาก Environment Variable (จำเป็นสำหรับการ Deploy บน Render)
const PORT = process.env.PORT || 8080;

// 1. สร้าง Express App และ HTTP Server
const app = express();
const server = http.createServer(app);

// 2. กำหนดให้ Express เสิร์ฟไฟล์คงที่ (index.html, renderer.js, etc.)
app.use(express.static(path.join(__dirname, '/')));

// 3. สร้าง WebSocket Server โดยผสานรวมกับ HTTP Server
const wss = new WebSocket.Server({ server });

// โครงสร้างข้อมูล
let users = {}; // { username: password }
let clients = []; // { ws, username, room }
// ปรับโครงสร้าง rooms: { roomName: { users: [username,...], history: [{from, type, content, filename, timestamp},...] } }
let rooms = {};

// 4. ให้ HTTP Server เริ่มฟังการเชื่อมต่อ
server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

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
                users[data.username] = data.password;
                ws.send(JSON.stringify({ type: 'register', success:true }));
            }
        }

        // ===== Login =====
        if(data.type === 'login') {
            if(users[data.username] && users[data.username] === data.password) {
                // ป้องกันการ Login ซ้ำซ้อน
                if(clients.some(c => c.username === data.username)) {
                    ws.send(JSON.stringify({ type:'login', success:false, message:'ผู้ใช้นี้เข้าสู่ระบบอยู่แล้ว' }));
                    return;
                }
                
                ws.username = data.username;
                clients.push({ ws, username:data.username, room:null });
                ws.send(JSON.stringify({ type:'login', success:true }));
            } else {
                ws.send(JSON.stringify({ type:'login', success:false, message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }));
            }
        }

        // ===== Create Room / Join Room Logic =====
        // คำสั่งนี้ใช้ได้ทั้งการสร้างห้องใหม่และการเข้าร่วมห้องที่มีอยู่ (รวมถึงการย้ายห้อง)
        if(data.type === 'createRoom' && ws.username) {
            const roomName = data.room;
            
            // 1. ออกจากห้องเก่าก่อน (ถ้ามี)
            if(ws.room) leaveRoom(ws);

            // 2. สร้างห้องถ้ายังไม่มี
            if(!rooms[roomName]) {
                rooms[roomName] = { users: [], history: [] };
            }

            // 3. เข้าร่วมห้องใหม่
            rooms[roomName].users.push(ws.username);
            ws.room = roomName;
            
            // 4. **ส่งประวัติแชทของห้องนี้ให้ผู้ใช้ที่เพิ่งเข้าร่วม**
            ws.send(JSON.stringify({ 
                type: 'history', 
                room: roomName, 
                messages: rooms[roomName].history || [] 
            }));

            broadcastRooms();
        }

        // ===== Send Message (เก็บ History) =====
        if((data.type === 'message' || data.type === 'file') && ws.username && ws.room) {
            const msgData = {
                type: data.type,
                from: ws.username,
                room: ws.room,
                content: data.content || null,
                filename: data.filename || null,
                timestamp: new Date().toLocaleTimeString() // เพิ่ม Timestamp
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
        if(ws.room) leaveRoom(ws);
        clients = clients.filter(c => c.ws !== ws);
        broadcastRooms();
    });
});

function leaveRoom(ws) {
    if(rooms[ws.room]) {
        rooms[ws.room].users = rooms[ws.room].users.filter(u => u !== ws.username);
        // หากไม่มีใครอยู่ในห้องแล้ว อาจลบห้องทิ้ง เพื่อให้ห้องไม่แสดงใน roomList
        if(rooms[ws.room].users.length === 0) delete rooms[ws.room]; 
    }
    ws.room = null;
}

function broadcastRooms() {
    // ส่งรายการห้องทั้งหมดให้ผู้ใช้ทั้งหมด
    const roomNames = Object.keys(rooms);
    clients.forEach(c => {
        if(c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type:'roomList', rooms:roomNames }));
        }
    });
}