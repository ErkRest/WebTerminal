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

  // 初始化該socket的終端容器
  terminals[socket.id] = {};

  // 創建新終端會話
  socket.on('create-terminal', (data) => {
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

  // 處理終端輸入
  socket.on('terminal-input', (data) => {
    const { input, terminalId } = typeof data === 'string' ? { input: data, terminalId: null } : data;
    
    if (terminalId) {
      // 新的多終端方式
      const terminal = terminals[socket.id] && terminals[socket.id][terminalId];
      if (terminal && terminal.ptyProcess) {
        terminal.ptyProcess.write(input);
      }
    } else {
      // 向後兼容單終端方式（可選）
      const socketTerminals = terminals[socket.id];
      if (socketTerminals) {
        const firstTerminal = Object.values(socketTerminals)[0];
        if (firstTerminal && firstTerminal.ptyProcess) {
          firstTerminal.ptyProcess.write(input);
        }
      }
    }
  });

  // 調整終端大小
  socket.on('terminal-resize', (data) => {
    const { cols, rows, terminalId } = data;
    
    if (terminalId) {
      const terminal = terminals[socket.id] && terminals[socket.id][terminalId];
      if (terminal && terminal.ptyProcess) {
        try {
          terminal.ptyProcess.resize(cols, rows);
          console.log(`調整終端 ${socket.id}/${terminalId} 大小: ${cols}x${rows}`);
        } catch (error) {
          console.error('調整終端大小失敗:', error);
        }
      }
    }
  });

  // 關閉特定終端
  socket.on('close-terminal', (data) => {
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

  // 獲取終端信息
  socket.on('get-terminal-info', (data) => {
    const { terminalId } = data || {};
    const clientIP = socket.handshake.headers['x-forwarded-for'] || 
                     socket.handshake.headers['x-real-ip'] || 
                     socket.conn.remoteAddress || 
                     socket.handshake.address;
    
    if (terminalId && terminals[socket.id] && terminals[socket.id][terminalId]) {
      const terminal = terminals[socket.id][terminalId];
      socket.emit('terminal-info', {
        pid: terminal.ptyProcess.pid,
        shell: shell,
        platform: os.platform(),
        arch: os.arch(),
        clientIP: clientIP,
        socketId: socket.id,
        terminalId: terminalId,
        connectedAt: new Date().toISOString()
      });
    }
  });

  // 獲取服務器統計信息
  socket.on('get-server-stats', () => {
    let totalTerminals = 0;
    const connectedClients = [];
    
    Object.keys(terminals).forEach(socketId => {
      const socketTerminals = terminals[socketId];
      if (socketTerminals) {
        const terminalIds = Object.keys(socketTerminals);
        totalTerminals += terminalIds.length;
        
        if (terminalIds.length > 0) {
          const firstTerminal = socketTerminals[terminalIds[0]];
          const clientSocket = firstTerminal.socket;
          const clientIP = clientSocket.handshake.headers['x-forwarded-for'] || 
                           clientSocket.handshake.headers['x-real-ip'] || 
                           clientSocket.conn.remoteAddress || 
                           clientSocket.handshake.address;
          
          connectedClients.push({
            socketId: socketId,
            clientIP: clientIP,
            terminalCount: terminalIds.length,
            terminals: terminalIds.map(terminalId => ({
              terminalId,
              pid: socketTerminals[terminalId].ptyProcess.pid
            })),
            userAgent: clientSocket.handshake.headers['user-agent'] || 'Unknown'
          });
        }
      }
    });

    // 獲取系統記憶體資訊
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    socket.emit('server-stats', {
      totalConnections: Object.keys(terminals).length,
      totalTerminals: totalTerminals,
      connectedClients: connectedClients,
      serverUptime: process.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      systemMemory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usagePercent: ((usedMemory / totalMemory) * 100).toFixed(1)
      },
      processMemory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      cpuInfo: {
        model: os.cpus()[0]?.model || 'Unknown',
        cores: os.cpus().length,
        loadAvg: os.loadavg()
      }
    });
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