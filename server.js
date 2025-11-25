import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs';

// Basic early logging and global error handlers to surface startup failures
console.log('Starting server.js');
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && (err.stack || err.message || err));
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason && (reason.stack || reason));
});

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env (simple parser) so local MONGODB_URI/MONGODB_DB are available
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const m = line.match(/^([^=]+)=(.*)$/);
      if (!m) return;
      let key = m[1].trim();
      let val = m[2].trim();
      if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    });
    console.log('Loaded .env');
  }
} catch (e) {
  console.warn('Could not load .env file:', e && e.message);
}

// Add detailed logging for MongoDB connection
let mongoClient = null;
// แก้ไขฟังก์ชัน getFeedbackCollection ให้ส่งคืน MongoClient
async function getMongoClient() {
  const uri = process.env.MONGODB_URI || null;
  if (!uri) {
    console.error('MongoDB URI is not defined in environment variables');
    return null;
  }
  try {
    if (!mongoClient) {
      const { MongoClient } = await import('mongodb');
      console.log('Initializing MongoDB client');
      mongoClient = new MongoClient(uri);
      await mongoClient.connect();
      console.log('Connected to MongoDB successfully');
    }
    return mongoClient;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    return null;
  }
}

// Middleware
app.use(express.static(__dirname));
app.use(express.json()); // เพิ่ม middleware สำหรับ parse JSON

// Middleware to set Content Security Policy (CSP)
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' http://localhost:3000; script-src 'self'");
  next();
});

// In-memory storage สำหรับข้อเสนอแนะ
let feedbackList = [];

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index-analytics.html"));
});

app.get("/gamematch", (req, res) => {
  res.sendFile(path.join(__dirname, "gamematch.html"));
});

app.get("/matchsetting", (req, res) => {
  res.sendFile(path.join(__dirname, "teachermatch.html"));
});

app.get("/catagoly", (req, res) => {
  res.sendFile(path.join(__dirname, "catagoly.html"));
});

app.get("/gamepicture", (req, res) => {
  res.sendFile(path.join(__dirname, "gamepicture.html"));
});

app.get("/teacherpicture", (req, res) => {
  res.sendFile(path.join(__dirname, "teacherpicture.html"));
});

// Proxy endpoint สำหรับ /api/active-clients เพื่อหลีกเลี่ยงปัญหา CORS
// จะเรียก API ภายนอกและส่งต่อผลลัพธ์ให้ client
app.get('/api/active-clients', async (req, res) => {
  try {
    // ใช้ global fetch ถ้ามี (Node 18+), ถ้าไม่มีก็ dynamic import 'node-fetch'
    let fetchFn = null;
    if (typeof fetch !== 'undefined') {
      fetchFn = fetch;
    } else {
      const mod = await import('node-fetch');
      fetchFn = mod.default;
    }

    const externalUrl = 'https://huaroa-production.up.railway.app/api/active-clients';
    const externalRes = await fetchFn(externalUrl);
    const data = await externalRes.json();

    // ตั้ง CORS header ให้ client สามารถดึงข้อมูลได้จากเบราว์เซอร์
    res.set('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
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
    } else {
      const mod = await import('node-fetch');
      fetchFn = mod.default;
    }

    const externalUrl = 'https://huaroa-production.up.railway.app/status/active-clients';
    const externalRes = await fetchFn(externalUrl);
    const data = await externalRes.json();

    // ตั้ง CORS header ให้ client สามารถดึงข้อมูลได้จากเบราว์เซอร์
    res.set('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    console.error('Error proxying status/active-clients:', err);
    res.status(502).json({ success: false, message: 'Proxy error fetching status/active-clients' });
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
  } catch (error) {
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
  } catch (error) {
    console.error('Error getting feedback:', error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูล"
    });
  }
});

// API สำหรับดึงข้อมูลการใช้งานจาก collection usage_gamemath_html
// API สำหรับ usage_gamemath_html (เพิ่ม log เพื่อตรวจสอบ targetDate และแก้ไข startOfDay)
app.get('/api/usage-gamemath', async (req, res) => {
  console.log('API /api/usage-gamemath called');
  try {
    const client = await getMongoClient();
    if (!client) {
      console.error('MongoDB connection failed');
      return res.status(500).json({ success: false, message: 'MongoDB connection failed' });
    }

    console.log('MongoDB connection successful');

    const db = client.db(process.env.MONGODB_DB || 'Huroa2');
    const coll = db.collection('usage_gamemath_html');

    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    console.log(`Target date received: ${targetDate.toISOString()}`);

    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    console.log(`Filtering data between ${startOfDay.toISOString()} and ${endOfDay.toISOString()} using timestamp`);

    // ตรวจสอบข้อมูลทั้งหมดในฐานข้อมูล
    const allData = await coll.find({}).toArray();
    console.log('All data in the collection:', allData);

    // ตรวจสอบข้อมูลที่อยู่ในช่วงเวลาที่ฟิลเตอร์
    const rawData = await coll.find({
      timestamp: { $gte: startOfDay, $lte: endOfDay }
    }).toArray();

    console.log('Raw data fetched from database:', rawData);

    if (rawData.length === 0) {
      console.log('No raw data found in the database for the specified date range');
      return res.json({ success: true, date: startOfDay.toISOString().split('T')[0], message: 'No data found', count: 0 });
    }

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 }
        }
      }
    ];

    console.log('Pipeline:', JSON.stringify(pipeline, null, 2));

    const data = await coll.aggregate(pipeline).toArray();

    if (data.length === 0 || data[0].count === 0) {
      console.log(`No data found for ${startOfDay.toISOString()} - ${endOfDay.toISOString()}`);
      return res.json({ success: true, date: startOfDay.toISOString().split('T')[0], message: 'No data found', count: 0 });
    }

    const count = data[0].count;
    console.log(`Data count for ${startOfDay.toISOString()} - ${endOfDay.toISOString()}:`, count);
    res.json({ success: true, date: startOfDay.toISOString().split('T')[0], count });
  } catch (error) {
    console.error('Error fetching data for usage_gamemath_html:', error);
    res.status(500).json({ success: false, message: 'Error fetching data for usage_gamemath_html' });
  }
});

// API สำหรับ usage_gamepicture_html
app.get('/api/usage-gamepicture', async (req, res) => {
  console.log('API /api/usage-gamepicture called');
  try {
    const client = await getMongoClient();
    if (!client) {
      console.error('MongoDB connection failed');
      return res.status(500).json({ success: false, message: 'MongoDB connection failed' });
    }

    const db = client.db(process.env.MONGODB_DB || 'Huroa2');
    const coll = db.collection('usage_gamepicture_html');

    const { date } = req.query;
    let startOfDay, endOfDay;

    if (date) {
      const targetDate = new Date(date);
      startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
    } else {
      const today = new Date();
      startOfDay = new Date(today);
      startOfDay.setUTCHours(0, 0, 0, 0);

      endOfDay = new Date(today);
      endOfDay.setUTCHours(23, 59, 59, 999);
    }

    console.log(`Filtering data between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 }
        }
      }
    ];

    const data = await coll.aggregate(pipeline).toArray();
    const count = data.length > 0 ? data[0].count : 0;

    console.log('Filtered and grouped data for usage_gamepicture_html:', data);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error fetching and processing data for usage_gamepicture_html:', error);
    res.status(500).json({ success: false, message: 'Error fetching and processing data for usage_gamepicture_html' });
  }
});

// API สำหรับ usage_gamethai_html
app.get('/api/usage-gamethai', async (req, res) => {
  console.log('API /api/usage-gamethai called');
  try {
    const client = await getMongoClient();
    if (!client) {
      console.error('MongoDB connection failed');
      return res.status(500).json({ success: false, message: 'MongoDB connection failed' });
    }

    const db = client.db(process.env.MONGODB_DB || 'Huroa2');
    const coll = db.collection('usage_gamethai_html');

    const { date } = req.query;
    let startOfDay, endOfDay;

    if (date) {
      const targetDate = new Date(date);
      startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
    } else {
      const today = new Date();
      startOfDay = new Date(today);
      startOfDay.setUTCHours(0, 0, 0, 0);

      endOfDay = new Date(today);
      endOfDay.setUTCHours(23, 59, 59, 999);
    }

    console.log(`Filtering data between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 }
        }
      }
    ];

    const data = await coll.aggregate(pipeline).toArray();
    const count = data.length > 0 ? data[0].count : 0;

    console.log('Filtered and grouped data for usage_gamethai_html:', data);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error fetching and processing data for usage_gamethai_html:', error);
    res.status(500).json({ success: false, message: 'Error fetching and processing data for usage_gamethai_html' });
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
  } catch (error) {
    console.error('Error fetching data from usage_gamemath_html:', error);
    res.status(500).json({ success: false, message: 'Error fetching data from usage_gamemath_html' });
  }
});

// API ใหม่สำหรับดึงข้อมูลจาก MongoDB
app.get('/api/get-data', async (req, res) => {
  console.log('API /api/get-data called');
  try {
    const client = await getMongoClient();
    if (!client) {
      console.error('MongoDB connection failed');
      return res.status(500).json({ success: false, message: 'MongoDB connection failed' });
    }

    const db = client.db(process.env.MONGODB_DB || 'Huroa2');
    const coll = db.collection('usage_gamemath_html');
    const data = await coll.find({}).toArray();

    console.log('Data fetched from usage_gamemath_html:', data);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching data from usage_gamemath_html:', error);
    res.status(500).json({ success: false, message: 'Error fetching data from usage_gamemath_html' });
  }
});

// API สำหรับ gamematch
app.get('/api/gamematch', async (req, res) => {
  console.log('API /api/gamematch called');
  try {
    const client = await getMongoClient();
    if (!client) {
      console.error('MongoDB connection failed');
      return res.status(500).json({ success: false, message: 'MongoDB connection failed' });
    }

    const db = client.db(process.env.MONGODB_DB || 'Huroa2');
    const coll = db.collection('usage_gamematch_html');

    const { date } = req.query;
    let startOfDay, endOfDay;

    if (date) {
      const targetDate = new Date(date);
      startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
    } else {
      const today = new Date();
      startOfDay = new Date(today);
      startOfDay.setUTCHours(0, 0, 0, 0);

      endOfDay = new Date(today);
      endOfDay.setUTCHours(23, 59, 59, 999);
    }

    console.log(`Filtering data between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startOfDay, $lte: endOfDay }
        }
      },
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
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ];

    const data = await coll.aggregate(pipeline).toArray();
    const results = data.map((item) => ({
      date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
      count: item.count
    }));

    console.log('Filtered and grouped data for usage_gamematch_html:', results);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching and processing data for usage_gamematch_html:', error);
    res.status(500).json({ success: false, message: 'Error fetching and processing data for usage_gamematch_html' });
  }
});

const PORT = process.env.PORT || 4000; // Changed default port to 4000
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
