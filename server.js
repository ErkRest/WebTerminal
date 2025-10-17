const Koa = require('koa');
const serve = require('koa-static');
const WebSocket = require('ws');
const { spawn, exec } = require('child_process');
const path = require('path');
const iconv = require('iconv-lite');

const app = new Koa();
const server = require('http').createServer(app.callback());
const wss = new WebSocket.Server({ server });

// 靜態文件服務
app.use(serve(path.join(__dirname, 'dist')));

// WebSocket 連接管理
const clients = new Set();
const processes = new Map(); // 存儲活躍的進程

wss.on('connection', (ws) => {
  console.log('新的 WebSocket 連接已建立');
  clients.add(ws);
  
  // 發送歡迎消息
  ws.send(JSON.stringify({
    type: 'info',
    message: '已連接到服務器，可以開始執行命令',
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleCommand(ws, message);
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '無效的 JSON 格式',
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket 連接已關閉');
    clients.delete(ws);
    
    // 清理該客戶端的進程
    for (const [processId, process] of processes) {
      if (process.clientId === ws.id) {
        process.kill();
        processes.delete(processId);
      }
    }
  });

  // 為每個 WebSocket 連接分配唯一 ID
  ws.id = Math.random().toString(36).substr(2, 9);
});

function handleCommand(ws, message) {
  const { type, command, processId } = message;
  
  switch (type) {
    case 'execute':
      executeCommand(ws, command);
      break;
      
    case 'kill':
      killProcess(ws, processId);
      break;
      
    case 'list':
      listProcesses(ws);
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `未知的命令類型: ${type}`,
        timestamp: new Date().toISOString()
      }));
  }
}

function executeCommand(ws, command) {
  if (!command || command.trim() === '') {
    ws.send(JSON.stringify({
      type: 'error',
      message: '命令不能為空',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  const processId = Math.random().toString(36).substr(2, 9);
  
  // 判斷操作系統並使用相應的 shell
  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'cmd' : 'bash';
  
  // 在 Windows 上，先設置 UTF-8 編碼，然後執行用戶命令
  let shellArgs;
  if (isWindows) {
    shellArgs = ['/c', `chcp 65001 >nul 2>&1 && ${command}`];
  } else {
    shellArgs = ['-c', command];
  }
  
  ws.send(JSON.stringify({
    type: 'info',
    message: `執行命令: ${command}`,
    processId: processId,
    timestamp: new Date().toISOString()
  }));

  try {
    // Windows 系統需要設置正確的編碼
    const spawnOptions = {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false
    };
    
    // Windows 系統設置編碼為 UTF-8
    if (isWindows) {
      spawnOptions.env = { ...process.env, CHCP: '65001' };
    }
    
    const childProcess = spawn(shell, shellArgs, spawnOptions);

    // 存儲進程信息
    processes.set(processId, {
      process: childProcess,
      clientId: ws.id,
      command: command,
      startTime: new Date()
    });

    // 處理標準輸出
    childProcess.stdout.on('data', (data) => {
      // Windows 系統需要處理編碼轉換
      let output;
      if (isWindows) {
        // 嘗試從 Big5/GBK 轉換為 UTF-8
        try {
          output = iconv.decode(data, 'cp950'); // cp950 是 Big5 的代碼頁
        } catch (error) {
          try {
            output = iconv.decode(data, 'gbk');
          } catch (error2) {
            output = data.toString('utf8');
          }
        }
      } else {
        output = data.toString('utf8');
      }
      
      ws.send(JSON.stringify({
        type: 'stdout',
        data: output,
        processId: processId,
        timestamp: new Date().toISOString()
      }));
    });

    // 處理標準錯誤
    childProcess.stderr.on('data', (data) => {
      // Windows 系統需要處理編碼轉換
      let output;
      if (isWindows) {
        try {
          output = iconv.decode(data, 'cp950'); // cp950 是 Big5 的代碼頁
        } catch (error) {
          try {
            output = iconv.decode(data, 'gbk');
          } catch (error2) {
            output = data.toString('utf8');
          }
        }
      } else {
        output = data.toString('utf8');
      }
      
      ws.send(JSON.stringify({
        type: 'stderr',
        data: output,
        processId: processId,
        timestamp: new Date().toISOString()
      }));
    });

    // 處理進程結束
    childProcess.on('close', (code) => {
      processes.delete(processId);
      ws.send(JSON.stringify({
        type: 'close',
        message: `進程結束，退出碼: ${code}`,
        processId: processId,
        exitCode: code,
        timestamp: new Date().toISOString()
      }));
    });

    // 處理進程錯誤
    childProcess.on('error', (error) => {
      processes.delete(processId);
      ws.send(JSON.stringify({
        type: 'error',
        message: `進程錯誤: ${error.message}`,
        processId: processId,
        timestamp: new Date().toISOString()
      }));
    });

  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `執行命令失敗: ${error.message}`,
      timestamp: new Date().toISOString()
    }));
  }
}

function killProcess(ws, processId) {
  const processInfo = processes.get(processId);
  
  if (!processInfo) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `找不到進程 ID: ${processId}`,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  if (processInfo.clientId !== ws.id) {
    ws.send(JSON.stringify({
      type: 'error',
      message: '你無權終止此進程',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  try {
    processInfo.process.kill('SIGTERM');
    processes.delete(processId);
    
    ws.send(JSON.stringify({
      type: 'info',
      message: `已終止進程: ${processId}`,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `終止進程失敗: ${error.message}`,
      timestamp: new Date().toISOString()
    }));
  }
}

function listProcesses(ws) {
  const userProcesses = Array.from(processes.entries())
    .filter(([_, processInfo]) => processInfo.clientId === ws.id)
    .map(([id, processInfo]) => ({
      id,
      command: processInfo.command,
      startTime: processInfo.startTime,
      pid: processInfo.process.pid
    }));

  ws.send(JSON.stringify({
    type: 'process_list',
    processes: userProcesses,
    timestamp: new Date().toISOString()
  }));
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`服務器運行在 http://localhost:${PORT}`);
  console.log(`WebSocket 服務器運行在 ws://localhost:${PORT}`);
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('正在關閉服務器...');
  
  // 終止所有子進程
  for (const [processId, processInfo] of processes) {
    try {
      processInfo.process.kill();
    } catch (error) {
      console.error(`終止進程 ${processId} 失敗:`, error);
    }
  }
  
  server.close(() => {
    console.log('服務器已關閉');
    process.exit(0);
  });
});