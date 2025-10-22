const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const pty = require('node-pty');
const cors = require('cors');
const os = require('os');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// 生成隨機密鑰
const generateAuthKey = () => {
  return crypto.randomBytes(16).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
};

// 每次啟動時生成新的身份驗證密鑰
const AUTH_KEY = generateAuthKey();
console.log('='.repeat(60));
console.log('🔐 WebTerminal 身份驗證密鑰');
console.log('='.repeat(60));
console.log(`密鑰: ${AUTH_KEY}`);
console.log('請在前端輸入此密鑰以連接到終端服務');
console.log('='.repeat(60));

// 存儲已驗證的連接
const authenticatedConnections = new Set();

// 配置 CORS
app.use(cors({
  origin: "http://localhost:8080",
  credentials: true
}));

// 設置 Socket.IO 並配置 CORS
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 提供靜態文件
app.use(express.static('dist'));

// 存儲所有終端會話 - 改為支持多終端
const terminals = {}; // 結構: { socketId: { terminalId: { ptyProcess, socket, terminalId } } }

// 獲取默認 shell
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

io.on('connection', (socket) => {
  // 獲取客戶端 IP 地址
  const clientIP = socket.handshake.headers['x-forwarded-for'] || 
                   socket.handshake.headers['x-real-ip'] || 
                   socket.conn.remoteAddress || 
                   socket.handshake.address;
  
  // 獲取用戶代理信息
  const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
  
  console.log(`新連接建立: ${socket.id}`);
  console.log(`客戶端 IP: ${clientIP}`);
  console.log(`用戶代理: ${userAgent}`);
  console.log(`連接時間: ${new Date().toISOString()}`);
  console.log('---');

  // 先要求身份驗證
  socket.on('authenticate', (data) => {
    const { key } = data;
    
    if (key === AUTH_KEY) {
      authenticatedConnections.add(socket.id);
      socket.emit('auth-success', { message: '驗證成功' });
      console.log(`客戶端 ${socket.id} 驗證成功`);
      
      // 初始化該socket的終端容器
      terminals[socket.id] = {};
    } else {
      socket.emit('auth-failed', { message: '密鑰錯誤，請重新輸入' });
      console.log(`客戶端 ${socket.id} 驗證失敗`);
    }
  });
  
  // 驗證中間件 - 檢查所有終端相關操作
  const requireAuth = (eventName, handler) => {
    socket.on(eventName, (...args) => {
      if (!authenticatedConnections.has(socket.id)) {
        socket.emit('auth-required', { message: '請先進行身份驗證' });
        return;
      }
      handler(...args);
    });
  };

  // 創建新終端會話 - 需要驗證
  requireAuth('create-terminal', (data) => {
    const { rows = 24, cols = 80, terminalId } = data || {};
    
    if (!terminalId) {
      console.error('創建終端失敗: 缺少 terminalId');
      socket.emit('terminal-error', { message: '缺少終端ID' });
      return;
    }
    
    try {
      // 創建偽終端
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: cols,
        rows: rows,
        cwd: process.env.HOME || process.cwd(),
        env: process.env,
        encoding: 'utf8'
      });

      // 存儲終端會話
      terminals[socket.id][terminalId] = {
        ptyProcess,
        socket,
        terminalId
      };

      console.log(`為 ${socket.id} 創建終端 ${terminalId}，PID: ${ptyProcess.pid}`);

      // 監聽終端輸出並發送到客戶端
      ptyProcess.onData((data) => {
        socket.emit('terminal-output', { data, terminalId });
      });

      // 監聽終端進程退出
      ptyProcess.onExit((exitCode) => {
        console.log(`終端 ${socket.id}/${terminalId} 退出，代碼: ${exitCode}`);
        
        // 安全地刪除終端記錄
        if (terminals[socket.id] && terminals[socket.id][terminalId]) {
          delete terminals[socket.id][terminalId];
          
          // 如果該客戶端沒有其他終端了，清理整個客戶端記錄
          if (Object.keys(terminals[socket.id]).length === 0) {
            delete terminals[socket.id];
          }
        }
        
        socket.emit('terminal-exit', { exitCode, terminalId });
      });

      // 發送終端創建成功消息
      socket.emit('terminal-created', {
        pid: ptyProcess.pid,
        cols,
        rows,
        terminalId
      });

    } catch (error) {
      console.error('創建終端失敗:', error);
      socket.emit('terminal-error', { message: error.message, terminalId });
    }
  });

  // 處理終端輸入 - 需要驗證
  requireAuth('terminal-input', (data) => {
    const { input, terminalId } = data;
    
    if (terminalId && terminals[socket.id] && terminals[socket.id][terminalId]) {
      const terminal = terminals[socket.id][terminalId];
      try {
        terminal.ptyProcess.write(input);
      } catch (error) {
        console.error('寫入終端失敗:', error);
        socket.emit('terminal-error', { message: '寫入終端失敗', terminalId });
      }
    } else {
      socket.emit('terminal-error', { 
        message: `未找到終端會話: ${terminalId}`, 
        terminalId 
      });
    }
  });

  // 處理終端大小調整 - 需要驗證
  requireAuth('terminal-resize', (data) => {
    const { cols, rows, terminalId } = data;
    
    if (terminalId && terminals[socket.id] && terminals[socket.id][terminalId]) {
      const terminal = terminals[socket.id][terminalId];
      try {
        terminal.ptyProcess.resize(cols, rows);
        console.log(`調整終端 ${socket.id}/${terminalId} 大小為 ${cols}x${rows}`);
      } catch (error) {
        console.error('調整終端大小失敗:', error);
      }
    }
  });

  // 關閉特定終端 - 需要驗證
  requireAuth('close-terminal', (data) => {
    const { terminalId } = data;
    if (terminalId && terminals[socket.id] && terminals[socket.id][terminalId]) {
      const terminal = terminals[socket.id][terminalId];
      try {
        terminal.ptyProcess.kill();
        console.log(`關閉終端 ${socket.id}/${terminalId}，PID: ${terminal.ptyProcess.pid}`);
      } catch (error) {
        console.error('關閉終端失敗:', error);
      }
      delete terminals[socket.id][terminalId];
    }
  });

  // 處理斷開連接
  socket.on('disconnect', () => {
    // 重新獲取客戶端 IP
    const clientIP = socket.handshake.headers['x-forwarded-for'] || 
                     socket.handshake.headers['x-real-ip'] || 
                     socket.conn.remoteAddress || 
                     socket.handshake.address;
    
    console.log(`連接斷開: ${socket.id}`);
    console.log(`客戶端 IP: ${clientIP}`);
    console.log(`斷開時間: ${new Date().toISOString()}`);
    
    // 移除身份驗證記錄
    authenticatedConnections.delete(socket.id);
    
    const socketTerminals = terminals[socket.id];
    if (socketTerminals) {
      // 關閉該socket的所有終端
      Object.keys(socketTerminals).forEach(terminalId => {
        const terminal = socketTerminals[terminalId];
        try {
          terminal.ptyProcess.kill();
          console.log(`終止終端進程 ${terminalId}: ${terminal.ptyProcess.pid}`);
        } catch (error) {
          console.error(`終止終端進程 ${terminalId} 失敗:`, error);
        }
      });
      delete terminals[socket.id];
    }
    console.log('---');
  });

  // 獲取服務器統計信息 - 需要驗證
  requireAuth('get-server-stats', () => {
    const stats = {
      serverUptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      activeTerminals: Object.keys(terminals).length,
      totalConnections: io.engine.clientsCount,
      hostname: os.hostname(),
      cpuInfo: {
        model: os.cpus()[0]?.model || 'Unknown',
        cores: os.cpus().length,
        loadAvg: os.loadavg()
      }
    };
    
    socket.emit('server-stats', stats);
  });
});

// 處理進程退出
process.on('SIGINT', () => {
  console.log('正在關閉服務器...');
  
  // 關閉所有終端會話
  Object.keys(terminals).forEach(socketId => {
    const socketTerminals = terminals[socketId];
    if (socketTerminals) {
      Object.keys(socketTerminals).forEach(terminalId => {
        const terminal = socketTerminals[terminalId];
        try {
          terminal.ptyProcess.kill();
        } catch (error) {
          console.error(`關閉終端 ${socketId}/${terminalId} 失敗:`, error);
        }
      });
    }
  });
  
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket 終端服務器運行在端口 ${PORT}`);
  console.log(`前端開發服務器: http://localhost:8080`);
  console.log(`後端 API 服務器: http://localhost:${PORT}`);
});