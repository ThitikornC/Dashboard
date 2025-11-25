"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const fs_1 = __importDefault(require("fs"));
// Basic early logging and global error handlers to surface startup failures
console.log('Starting server.js');
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err && (err.stack || err.message || err));
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason && (reason.stack || reason));
});
const app = (0, express_1.default)();
const __dirname = path_1.default.dirname((0, url_1.fileURLToPath)(import.meta.url));
// Load .env (simple parser) so local MONGODB_URI/MONGODB_DB are available
try {
    const envPath = path_1.default.join(__dirname, '.env');
    if (fs_1.default.existsSync(envPath)) {
        const content = fs_1.default.readFileSync(envPath, 'utf8');
        content.split(/\r?\n/).forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#'))
                return;
            const m = line.match(/^([^=]+)=(.*)$/);
            if (!m)
                return;
            let key = m[1].trim();
            let val = m[2].trim();
            if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
                val = val.slice(1, -1);
            }
            if (!process.env[key])
                process.env[key] = val;
        });
        console.log('Loaded .env');
    }
}
catch (e) {
    console.warn('Could not load .env file:', e && e.message);
}
// Mongo helper
let mongoClient = null;
async function getFeedbackCollection() {
    const uri = process.env.MONGODB_URI || null;
    if (!uri)
        return null;
    try {
        if (!mongoClient) {
            const { MongoClient } = await Promise.resolve().then(() => __importStar(require('mongodb')));
            // Newer mongodb driver versions ignore legacy options; create client without them
            mongoClient = new MongoClient(uri);
            await mongoClient.connect();
            console.log('Connected to MongoDB');
        }
        const dbName = process.env.MONGODB_DB || 'Huroa2';
        return mongoClient.db(dbName).collection('feedbacks');
    }
    catch (err) {
        console.error('MongoDB connection error:', err && err.message);
        return null;
    }
}
// Middleware
app.use(express_1.default.static(__dirname));
app.use(express_1.default.json()); // เพิ่ม middleware สำหรับ parse JSON
// Middleware to set Content Security Policy (CSP)
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' http://localhost:3000; script-src 'self'");
    next();
});
// In-memory storage สำหรับข้อเสนอแนะ
let feedbackList = [];
app.get("/", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "index-analytics.html"));
});
app.get("/gamematch", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "gamematch.html"));
});
app.get("/matchsetting", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "teachermatch.html"));
});
app.get("/catagoly", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "catagoly.html"));
});
app.get("/gamepicture", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "gamepicture.html"));
});
app.get("/teacherpicture", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "teacherpicture.html"));
});
// Proxy endpoint สำหรับ /api/active-clients เพื่อหลีกเลี่ยงปัญหา CORS
// จะเรียก API ภายนอกและส่งต่อผลลัพธ์ให้ client
app.get('/api/active-clients', async (req, res) => {
    try {
        // ใช้ global fetch ถ้ามี (Node 18+), ถ้าไม่มีก็ dynamic import 'node-fetch'
        let fetchFn = null;
        if (typeof fetch !== 'undefined') {
            fetchFn = fetch;
        }
        else {
            const mod = await Promise.resolve().then(() => __importStar(require('node-fetch')));
            fetchFn = mod.default;
        }
        const externalUrl = 'https://huaroa-production.up.railway.app/api/active-clients';
        const externalRes = await fetchFn(externalUrl);
        const data = await externalRes.json();
        // ตั้ง CORS header ให้ client สามารถดึงข้อมูลได้จากเบราว์เซอร์
        res.set('Access-Control-Allow-Origin', '*');
        res.json(data);
    }
    catch (err) {
        console.error('Error proxying active-clients:', err);
        res.status(502).json({ success: false, message: 'Proxy error fetching active-clients' });
    }
});
// Proxy endpoint สำหรับ /status/active-clients เพื่อหลีกเลี่ยงปัญหา CORS
app.get('/status/active-clients', async (req, res) => {
    try {
        let fetchFn = null;
        if (typeof fetch !== 'undefined') {
            fetchFn = fetch;
        }
        else {
            const mod = await Promise.resolve().then(() => __importStar(require('node-fetch')));
            fetchFn = mod.default;
        }
        const externalUrl = 'https://huaroa-production.up.railway.app/status/active-clients';
        const externalRes = await fetchFn(externalUrl);
        const data = await externalRes.json();
        // ตั้ง CORS header ให้ client สามารถดึงข้อมูลได้จากเบราว์เซอร์
        res.set('Access-Control-Allow-Origin', '*');
        res.json(data);
    }
    catch (err) {
        console.error('Error proxying status/active-clients:', err);
        res.status(502).json({ success: false, message: 'Proxy error fetching status/active-clients' });
    }
});
// Proxy endpoint สำหรับ /status/usage-average เพื่อหลีกเลี่ยงปัญหา CORS
app.get('/status/usage-average', async (req, res) => {
    try {
        let fetchFn = null;
        if (typeof fetch !== 'undefined') {
            fetchFn = fetch;
        }
        else {
            const mod = await Promise.resolve().then(() => __importStar(require('node-fetch')));
            fetchFn = mod.default;
        }
        // ใช้ query string ที่ร้องขอโดยลูกค้า (server จะเรียก external endpoint ตรงๆ)
        // โปรดสังเกตว่า client ควรเรียก /status/usage-average (same-origin) แล้ว server จะส่งต่อ
        const externalUrl = 'https://huaroa-production.up.railway.app/status/usage-average?period=all%20|%20ConvertTo-Json%20-Depth%205';
        const externalRes = await fetchFn(externalUrl);
        const data = await externalRes.json();
        // ตั้ง CORS header ให้ client สามารถดึงข้อมูลได้จากเบราว์เซอร์
        res.set('Access-Control-Allow-Origin', '*');
        res.json(data);
    }
    catch (err) {
        console.error('Error proxying status/usage-average:', err);
        res.status(502).json({ success: false, message: 'Proxy error fetching status/usage-average' });
    }
});
// API สำหรับข้อเสนอแนะ
app.post("/api/feedback", async (req, res) => {
    try {
        const { feedback, timestamp, name, phone } = req.body;
        if (!feedback) {
            return res.status(400).json({
                success: false,
                message: "กรุณากรอกข้อเสนอแนะ"
            });
        }
        const createdAt = new Date().toLocaleString('th-TH', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const doc = {
            name: name || null,
            phone: phone || null,
            feedback: feedback,
            timestamp: timestamp || new Date().toISOString(),
            createdAt
        };
        const coll = await getFeedbackCollection();
        if (coll) {
            const result = await coll.insertOne(doc);
            doc._id = result.insertedId;
            console.log('📝 ได้รับข้อเสนอแนะใหม่ (DB):', doc);
            return res.json({ success: true, message: "บันทึกข้อเสนอแนะสำเร็จ", data: doc });
        }
        // Fallback: store in-memory
        const feedbackItem = Object.assign({ id: Date.now() }, doc);
        feedbackList.push(feedbackItem);
        console.log('📝 ได้รับข้อเสนอแนะใหม่ (in-memory):', feedbackItem);
        return res.json({ success: true, message: "บันทึกข้อเสนอแนะสำเร็จ (fallback)", data: feedbackItem });
    }
    catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({
            success: false,
            message: "เกิดข้อผิดพลาดในการบันทึกข้อเสนอแนะ"
        });
    }
});
app.get("/api/feedback", async (req, res) => {
    try {
        const coll = await getFeedbackCollection();
        if (coll) {
            const items = await coll.find({}).sort({ _id: -1 }).toArray();
            return res.json({ success: true, data: items, count: items.length });
        }
        // Fallback to in-memory
        return res.json({ success: true, data: feedbackList, count: feedbackList.length });
    }
    catch (error) {
        console.error('Error getting feedback:', error);
        res.status(500).json({
            success: false,
            message: "เกิดข้อผิดพลาดในการดึงข้อมูล"
        });
    }
});
// API สำหรับดึงข้อมูลการใช้งานจาก collection usage_gamemath_html
app.get('/api/usage-gamemath', async (req, res) => {
    console.log('API /api/usage-gamemath called');
    try {
        const client = await getFeedbackCollection();
        if (!client) {
            console.error('MongoDB connection failed');
            return res.status(500).json({ success: false, message: 'MongoDB connection failed' });
        }
        const coll = client.db(process.env.MONGODB_DB).collection('usage_gamemath_html');
        const pipeline = [
            {
                $group: {
                    _id: {
                        year: { $year: { date: "$timestamp", timezone: "Asia/Bangkok" } },
                        month: { $month: { date: "$timestamp", timezone: "Asia/Bangkok" } },
                        day: { $dayOfMonth: { date: "$timestamp", timezone: "Asia/Bangkok" } }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ];
        console.log('Running aggregation pipeline for usage_gamemath_html');
        const data = await coll.aggregate(pipeline).toArray();
        console.log('Aggregation result:', data);
        const results = data.map((item) => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            count: item.count
        }));
        res.json({ success: true, data: results });
    }
    catch (error) {
        console.error('Error fetching usage stats for usage_gamemath_html:', error);
        res.status(500).json({ success: false, message: 'Error fetching usage stats for usage_gamemath_html' });
    }
});
// API สำหรับดึงข้อมูลการใช้งานจาก collection usage_gamepicture_html
app.get('/api/usage-gamepicture', async (req, res) => {
    try {
        const coll = await getFeedbackCollection();
        if (!coll) {
            throw new Error('Collection usage_gamepicture_html not found');
        }
        const pipeline = [
            {
                $group: {
                    _id: {
                        year: { $year: { date: "$timestamp", timezone: "Asia/Bangkok" } },
                        month: { $month: { date: "$timestamp", timezone: "Asia/Bangkok" } },
                        day: { $dayOfMonth: { date: "$timestamp", timezone: "Asia/Bangkok" } }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ];
        const data = await coll.aggregate(pipeline).toArray();
        const results = data.map((item) => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            count: item.count
        }));
        res.json({ success: true, data: results });
    }
    catch (error) {
        console.error('Error fetching usage stats for usage_gamepicture_html:', error);
        res.status(500).json({ success: false, message: 'Error fetching usage stats for usage_gamepicture_html' });
    }
});
// API สำหรับดึงข้อมูลการใช้งานจาก collection usage_gamethai_html
app.get('/api/usage-gamethai', async (req, res) => {
    try {
        const coll = await getFeedbackCollection();
        if (!coll) {
            throw new Error('Collection usage_gamethai_html not found');
        }
        const pipeline = [
            {
                $group: {
                    _id: {
                        year: { $year: { date: "$timestamp", timezone: "Asia/Bangkok" } },
                        month: { $month: { date: "$timestamp", timezone: "Asia/Bangkok" } },
                        day: { $dayOfMonth: { date: "$timestamp", timezone: "Asia/Bangkok" } }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ];
        const data = await coll.aggregate(pipeline).toArray();
        const results = data.map((item) => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            count: item.count
        }));
        res.json({ success: true, data: results });
    }
    catch (error) {
        console.error('Error fetching usage stats for usage_gamethai_html:', error);
        res.status(500).json({ success: false, message: 'Error fetching usage stats for usage_gamethai_html' });
    }
});
// API ชั่วคราวสำหรับดึงข้อมูลจาก collection usage_gamemath_html
app.get('/api/test-collection', async (req, res) => {
    console.log('API /api/test-collection called');
    try {
        const client = await getFeedbackCollection();
        if (!client) {
            console.error('MongoDB connection failed');
            return res.status(500).json({ success: false, message: 'MongoDB connection failed' });
        }
        const coll = client.db(process.env.MONGODB_DB).collection('usage_gamemath_html');
        const data = await coll.find({}).toArray();
        console.log('Data fetched from usage_gamemath_html:', data);
        res.json({ success: true, data });
    }
    catch (error) {
        console.error('Error fetching data from usage_gamemath_html:', error);
        res.status(500).json({ success: false, message: 'Error fetching data from usage_gamemath_html' });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
