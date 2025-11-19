// tracking.js - ไฟล์สำหรับติดตามการใช้งานเว็บไซต์

class WebsiteTracker {
  constructor() {
    this.storageKey = 'websiteAnalytics';
    this.sessionKey = 'currentSession';
    this.sessionStartTime = null;
    this.gameStartTime = null;
    this.init();
  }

  init() {
    this.trackPageView();
    this.startSession();
    this.setupEventListeners();
  }

  // บันทึกการเข้าชมหน้า
  trackPageView() {
    const analytics = this.getAnalytics();
    const now = new Date();
    
    // เพิ่มยอดเข้าชมรวม
    analytics.totalVisits = (analytics.totalVisits || 0) + 1;
    analytics.lastVisit = now.toISOString();
    
    // บันทึกการเข้าชมรายวัน
    const today = now.toISOString().split('T')[0];
    if (!analytics.dailyVisits) analytics.dailyVisits = {};
    analytics.dailyVisits[today] = (analytics.dailyVisits[today] || 0) + 1;
    
    // บันทึกหน้าที่เข้าชม
    const page = this.getCurrentPage();
    if (!analytics.pageViews) analytics.pageViews = {};
    analytics.pageViews[page] = (analytics.pageViews[page] || 0) + 1;
    
    this.saveAnalytics(analytics);
  }

  // เริ่ม Session
  startSession() {
    this.sessionStartTime = new Date();
    
    const session = {
      startTime: this.sessionStartTime.toISOString(),
      page: this.getCurrentPage(),
      userAgent: navigator.userAgent,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language
    };
    
    sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
  }

  // เริ่มเล่นเกม
  startGame(gameType) {
    this.gameStartTime = new Date();
    sessionStorage.setItem('gameStartTime', this.gameStartTime.toISOString());
    sessionStorage.setItem('gameType', gameType);
  }

  // จบเกม
  endGame(score, playerName, teamName, teamColor) {
    if (!this.gameStartTime) {
      this.gameStartTime = new Date(sessionStorage.getItem('gameStartTime') || new Date());
    }
    
    const gameType = sessionStorage.getItem('gameType') || 'unknown';
    const endTime = new Date();
    const duration = Math.round((endTime - this.gameStartTime) / 1000); // วินาที
    
    const analytics = this.getAnalytics();
    
    if (!analytics.gamePlays) analytics.gamePlays = [];
    
    const gamePlay = {
      id: Date.now(),
      timestamp: endTime.toISOString(),
      gameType: gameType,
      playerName: playerName || 'ไม่ระบุชื่อ',
      teamName: teamName || 'ไม่ระบุทีม',
      teamColor: teamColor || '#999999',
      score: score || 0,
      duration: duration
    };
    
    analytics.gamePlays.push(gamePlay);
    analytics.totalGames = (analytics.totalGames || 0) + 1;
    
    // คำนวณเวลาใช้งานเฉลี่ย
    const totalDuration = analytics.gamePlays.reduce((sum, play) => sum + (play.duration || 0), 0);
    analytics.avgDuration = Math.round(totalDuration / analytics.gamePlays.length);
    
    // บันทึกสถิติตามประเภทเกม
    if (!analytics.gameStats) analytics.gameStats = {};
    if (!analytics.gameStats[gameType]) {
      analytics.gameStats[gameType] = {
        count: 0,
        totalScore: 0,
        totalDuration: 0
      };
    }
    analytics.gameStats[gameType].count++;
    analytics.gameStats[gameType].totalScore += (score || 0);
    analytics.gameStats[gameType].totalDuration += duration;
    
    this.saveAnalytics(analytics);
    
    // ล้างข้อมูลเกม
    sessionStorage.removeItem('gameStartTime');
    sessionStorage.removeItem('gameType');
    this.gameStartTime = null;
  }

  // จบ Session
  endSession() {
    const session = JSON.parse(sessionStorage.getItem(this.sessionKey) || '{}');
    
    if (session.startTime) {
      const startTime = new Date(session.startTime);
      const endTime = new Date();
      const duration = Math.round((endTime - startTime) / 1000); // วินาที
      
      const analytics = this.getAnalytics();
      if (!analytics.sessions) analytics.sessions = [];
      
      analytics.sessions.push({
        startTime: session.startTime,
        endTime: endTime.toISOString(),
        duration: duration,
        page: session.page,
        userAgent: session.userAgent,
        screenSize: session.screenSize,
        language: session.language
      });
      
      // คำนวณเวลาใช้งานเฉลี่ยต่อ Session
      const totalSessionDuration = analytics.sessions.reduce((sum, s) => sum + s.duration, 0);
      analytics.avgSessionDuration = Math.round(totalSessionDuration / analytics.sessions.length);
      
      this.saveAnalytics(analytics);
    }
  }

  // ตั้งค่า Event Listeners
  setupEventListeners() {
    // บันทึกเมื่อออกจากหน้า
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });
    
    // ตรวจจับการปิดหน้าต่าง
    window.addEventListener('pagehide', () => {
      this.endSession();
    });
    
    // ตรวจจับการซ่อนหน้า (เปลี่ยน Tab)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // บันทึกเวลาที่ซ่อนหน้า
        sessionStorage.setItem('pageHiddenTime', new Date().toISOString());
      } else {
        // คำนวณเวลาที่ซ่อนหน้า
        const hiddenTime = sessionStorage.getItem('pageHiddenTime');
        if (hiddenTime) {
          const hidden = new Date(hiddenTime);
          const now = new Date();
          const inactiveTime = Math.round((now - hidden) / 1000);
          
          const analytics = this.getAnalytics();
          if (!analytics.inactiveTimes) analytics.inactiveTimes = [];
          analytics.inactiveTimes.push(inactiveTime);
          this.saveAnalytics(analytics);
          
          sessionStorage.removeItem('pageHiddenTime');
        }
      }
    });
  }

  // ดึงชื่อหน้าปัจจุบัน
  getCurrentPage() {
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    return page.replace('.html', '');
  }

  // ดึงข้อมูล Analytics
  getAnalytics() {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : {};
  }

  // บันทึกข้อมูล Analytics
  saveAnalytics(data) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  // ล้างข้อมูล Analytics
  clearAnalytics() {
    localStorage.removeItem(this.storageKey);
    sessionStorage.removeItem(this.sessionKey);
  }

  // ดึงสถิติ
  getStats() {
    const analytics = this.getAnalytics();
    
    return {
      totalVisits: analytics.totalVisits || 0,
      totalGames: analytics.totalGames || 0,
      avgDuration: Math.round((analytics.avgDuration || 0) / 60), // นาที
      avgSessionDuration: Math.round((analytics.avgSessionDuration || 0) / 60), // นาที
      uniquePlayers: new Set((analytics.gamePlays || []).map(p => p.playerName)).size,
      gameStats: analytics.gameStats || {},
      recentPlays: (analytics.gamePlays || []).slice(-10).reverse()
    };
  }
}

// สร้าง instance global
window.websiteTracker = new WebsiteTracker();

// ฟังก์ชัน Helper สำหรับใช้ในหน้าเกม
window.trackGameStart = function(gameType) {
  window.websiteTracker.startGame(gameType);
};

window.trackGameEnd = function(score, playerName, teamName, teamColor) {
  window.websiteTracker.endGame(score, playerName, teamName, teamColor);
};
