const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const pty = require('node-pty');
const cors = require('cors');
const os = require('os');

const app = express();
const server = http.createServer(app);

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

// 存儲所有終端會話
const terminals = {};

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

  // 創建新終端會話
  socket.on('create-terminal', (data) => {
    const { rows = 24, cols = 80 } = data || {};
    
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
      terminals[socket.id] = {
        ptyProcess,
        socket
      };

      console.log(`為 ${socket.id} 創建終端，PID: ${ptyProcess.pid}`);

      // 監聽終端輸出並發送到客戶端
      ptyProcess.onData((data) => {
        socket.emit('terminal-output', data);
      });

      // 監聽終端進程退出
      ptyProcess.onExit((exitCode) => {
        console.log(`終端 ${socket.id} 退出，代碼: ${exitCode}`);
        delete terminals[socket.id];
        socket.emit('terminal-exit', { exitCode });
      });

      // 發送終端創建成功消息
      socket.emit('terminal-created', {
        pid: ptyProcess.pid,
        cols,
        rows
      });

    } catch (error) {
      console.error('創建終端失敗:', error);
      socket.emit('terminal-error', { message: error.message });
    }
  });

  // 處理終端輸入
  socket.on('terminal-input', (data) => {
    const terminal = terminals[socket.id];
    if (terminal && terminal.ptyProcess) {
      terminal.ptyProcess.write(data);
    }
  });

  // 調整終端大小
  socket.on('terminal-resize', (data) => {
    const { cols, rows } = data;
    const terminal = terminals[socket.id];
    if (terminal && terminal.ptyProcess) {
      try {
        terminal.ptyProcess.resize(cols, rows);
        console.log(`調整終端 ${socket.id} 大小: ${cols}x${rows}`);
      } catch (error) {
        console.error('調整終端大小失敗:', error);
      }
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
    
    const terminal = terminals[socket.id];
    if (terminal) {
      try {
        terminal.ptyProcess.kill();
        console.log(`終止終端進程: ${terminal.ptyProcess.pid}`);
      } catch (error) {
        console.error('終止終端進程失敗:', error);
      }
      delete terminals[socket.id];
    }
    console.log('---');
  });

  // 獲取終端信息
  socket.on('get-terminal-info', () => {
    const terminal = terminals[socket.id];
    const clientIP = socket.handshake.headers['x-forwarded-for'] || 
                     socket.handshake.headers['x-real-ip'] || 
                     socket.conn.remoteAddress || 
                     socket.handshake.address;
    
    if (terminal) {
      socket.emit('terminal-info', {
        pid: terminal.ptyProcess.pid,
        shell: shell,
        platform: os.platform(),
        arch: os.arch(),
        clientIP: clientIP,
        socketId: socket.id,
        connectedAt: new Date().toISOString()
      });
    }
  });

  // 獲取服務器統計信息
  socket.on('get-server-stats', () => {
    const connectedClients = Object.keys(terminals).map(socketId => {
      const terminal = terminals[socketId];
      const clientSocket = terminal.socket;
      const clientIP = clientSocket.handshake.headers['x-forwarded-for'] || 
                       clientSocket.handshake.headers['x-real-ip'] || 
                       clientSocket.conn.remoteAddress || 
                       clientSocket.handshake.address;
      
      return {
        socketId: socketId,
        clientIP: clientIP,
        pid: terminal.ptyProcess.pid,
        userAgent: clientSocket.handshake.headers['user-agent'] || 'Unknown'
      };
    });

    socket.emit('server-stats', {
      totalConnections: Object.keys(terminals).length,
      connectedClients: connectedClients,
      serverUptime: process.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version
    });
  });
});

// 處理進程退出
process.on('SIGINT', () => {
  console.log('正在關閉服務器...');
  
  // 關閉所有終端會話
  Object.keys(terminals).forEach(socketId => {
    const terminal = terminals[socketId];
    try {
      terminal.ptyProcess.kill();
    } catch (error) {
      console.error(`關閉終端 ${socketId} 失敗:`, error);
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