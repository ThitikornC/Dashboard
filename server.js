import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(express.static(__dirname));
app.use(express.json()); // เพิ่ม middleware สำหรับ parse JSON

// In-memory storage สำหรับข้อเสนอแนะ
let feedbackList = [];

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "menu.html"));
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

// API สำหรับข้อเสนอแนะ
app.post("/api/feedback", (req, res) => {
  try {
    const { feedback, timestamp } = req.body;
    
    if (!feedback) {
      return res.status(400).json({ 
        success: false, 
        message: "กรุณากรอกข้อเสนอแนะ" 
      });
    }
    
    const feedbackItem = {
      id: Date.now(),
      feedback: feedback,
      timestamp: timestamp || new Date().toISOString(),
      createdAt: new Date().toLocaleString('th-TH', { 
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    };
    
    feedbackList.push(feedbackItem);
    
    console.log('📝 ได้รับข้อเสนอแนะใหม่:', feedbackItem);
    
    res.json({ 
      success: true, 
      message: "บันทึกข้อเสนอแนะสำเร็จ",
      data: feedbackItem
    });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการบันทึกข้อเสนอแนะ" 
    });
  }
});

app.get("/api/feedback", (req, res) => {
  try {
    res.json({ 
      success: true, 
      data: feedbackList,
      count: feedbackList.length
    });
  } catch (error) {
    console.error('Error getting feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการดึงข้อมูล" 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
