const Koa = require('koa');
const serve = require('koa-static');
const WebSocket = require('ws');
const { spawn, exec } = require('child_process');
const pty = require('node-pty');
const stripAnsiModule = require('strip-ansi');
const stripAnsi = stripAnsiModule.default || stripAnsiModule;
const path = require('path');
const fs = require('fs');
const os = require('os');
const iconv = require('iconv-lite');

const app = new Koa();
const server = require('http').createServer(app.callback());
const wss = new WebSocket.Server({ server });

// 靜態文件服務
app.use(serve(path.join(__dirname, 'dist')));

// WebSocket 連接管理
const clients = new Map(); // 改為 Map 來存儲客戶端狀態
const processes = new Map(); // 存儲活躍的進程
const pausedProcesses = new Map(); // 存儲暫停中的進程
const terminalPTYs = new Map(); // 存儲持久化的 PTY 終端

wss.on('connection', (ws) => {
  console.log('新的 WebSocket 連接已建立');
  
  // 為每個 WebSocket 連接分配唯一 ID 和初始狀態
  ws.id = Math.random().toString(36).substr(2, 9);
  
  // 初始化客戶端狀態
  const defaultWorkingDir = process.platform === 'win32' ? 'C:\\' : os.homedir();
  clients.set(ws.id, {
    ws: ws,
    workingDirectory: defaultWorkingDir, // 使用安全的默認工作目錄
    terminals: new Map() // 支援多終端，每個終端有自己的持久 PTY
  });
  
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
    
    // 清理該客戶端的進程
    for (const [processId, process] of processes) {
      if (process.clientId === ws.id) {
        try {
          if (process.isPTY) {
            // PTY 進程
            process.process.kill();
          } else {
            // 普通進程
            process.process.kill('SIGTERM');
          }
        } catch (error) {
          console.error(`終止進程 ${processId} 失敗:`, error);
        }
        processes.delete(processId);
      }
    }
    
    // 清理該客戶端的持久 PTY 終端
    const clientState = clients.get(ws.id);
    if (clientState) {
      for (const [terminalId, terminalState] of clientState.terminals) {
        if (terminalState.ptyProcess) {
          try {
            terminalState.ptyProcess.kill();
            console.log(`已關閉持久 PTY 終端: ${terminalId}`);
          } catch (error) {
            console.error(`關閉持久 PTY 終端 ${terminalId} 失敗:`, error);
          }
        }
      }
    }
    
    // 從客戶端列表中移除
    clients.delete(ws.id);
  });
});

function handleCommand(ws, message) {
  const { type, command, processId, terminalId, response } = message;
  
  switch (type) {
    case 'execute':
      executeCommand(ws, message);
      break;
      
    case 'create_terminal':
      createPersistentTerminal(ws, message);
      break;
      
    case 'close_terminal':
      closePersistentTerminal(ws, message);
      break;
      
    case 'kill':
      killProcess(ws, processId);
      break;
      
    case 'list':
      listProcesses(ws);
      break;
      
    case 'pause_response':
      handlePauseResponse(ws, message);
      break;
      
    case 'get_system_info':
      getSystemInfo(ws);
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `未知的命令類型: ${type}`,
        timestamp: new Date().toISOString()
      }));
  }
}

// 創建持久化終端
function createPersistentTerminal(ws, message) {
  const { terminalId } = message;
  const clientState = clients.get(ws.id);
  
  if (!clientState) {
    ws.send(JSON.stringify({
      type: 'error',
      message: '客戶端狀態不存在',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  const currentTerminalId = terminalId || 'default';
  
  // 檢查是否已經存在該終端
  if (clientState.terminals.has(currentTerminalId) && 
      clientState.terminals.get(currentTerminalId).ptyProcess) {
    ws.send(JSON.stringify({
      type: 'terminal_ready',
      terminalId: currentTerminalId,
      message: '終端已經存在並準備就緒',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  const isWindows = process.platform === 'win32';
  const defaultWorkingDir = clientState.workingDirectory;
  
  console.log(`創建持久化終端: ${currentTerminalId}, 工作目錄: ${defaultWorkingDir}`);
  
  try {
    // 創建持久的 PTY 進程
    const ptyProcess = pty.spawn(isWindows ? 'cmd.exe' : '/bin/bash', [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: defaultWorkingDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    });

    // 初始化或更新終端狀態
    const terminalState = {
      workingDirectory: defaultWorkingDir,
      ptyProcess: ptyProcess,
      commandHistory: [],
      isReady: true
    };
    
    clientState.terminals.set(currentTerminalId, terminalState);

    // 處理 PTY 輸出
    ptyProcess.onData((data) => {
      ws.send(JSON.stringify({
        type: 'stdout',
        data: data,
        terminalId: currentTerminalId,
        timestamp: new Date().toISOString()
      }));
    });

    // 處理 PTY 結束（意外退出）
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`持久終端 ${currentTerminalId} 意外退出，退出碼: ${exitCode}`);
      
      // 清理終端狀態
      if (clientState.terminals.has(currentTerminalId)) {
        const terminalState = clientState.terminals.get(currentTerminalId);
        terminalState.ptyProcess = null;
        terminalState.isReady = false;
      }
      
      ws.send(JSON.stringify({
        type: 'terminal_closed',
        terminalId: currentTerminalId,
        message: `終端意外關閉，退出碼: ${exitCode}${signal ? `, 信號: ${signal}` : ''}`,
        exitCode: exitCode,
        timestamp: new Date().toISOString()
      }));
    });

    // 發送終端就緒通知
    ws.send(JSON.stringify({
      type: 'terminal_ready',
      terminalId: currentTerminalId,
      message: '持久化終端已創建並準備就緒',
      workingDirectory: defaultWorkingDir,
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `創建持久化終端失敗: ${error.message}`,
      terminalId: currentTerminalId,
      timestamp: new Date().toISOString()
    }));
  }
}

// 關閉持久化終端
function closePersistentTerminal(ws, message) {
  const { terminalId } = message;
  const clientState = clients.get(ws.id);
  
  if (!clientState) return;
  
  const currentTerminalId = terminalId || 'default';
  const terminalState = clientState.terminals.get(currentTerminalId);
  
  if (!terminalState || !terminalState.ptyProcess) {
    ws.send(JSON.stringify({
      type: 'error',
      message: '終端不存在或已關閉',
      terminalId: currentTerminalId,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  try {
    terminalState.ptyProcess.kill();
    terminalState.ptyProcess = null;
    terminalState.isReady = false;
    
    ws.send(JSON.stringify({
      type: 'terminal_closed',
      terminalId: currentTerminalId,
      message: '終端已關閉',
      timestamp: new Date().toISOString()
    }));
    
    console.log(`已關閉持久化終端: ${currentTerminalId}`);
    
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `關閉終端失敗: ${error.message}`,
      terminalId: currentTerminalId,
      timestamp: new Date().toISOString()
    }));
  }
}

// 檢測是否需要 TTY 的命令
function needsTTY(command) {
  const parts = command.trim().split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);
  
  // 特殊情況：批次模式的命令通常不需要 TTY
  if (cmd === 'top' && args.includes('-b')) {
    return false;
  }
  
  if (cmd === 'less' || cmd === 'more') {
    // 如果有文件參數，可以用 cat 替代
    return args.length === 0;
  }
  
  const ttyCommands = [
    'top', 'htop', 'vi', 'vim', 'nano', 'emacs', 
    'man', 'git log', 'git diff', 'ssh', 'mysql', 'psql', 'mongo',
    'python', 'python3', 'node', 'irb', 'ruby', 'scala', 'sbt'
  ];
  
  return ttyCommands.includes(cmd) || 
         command.includes('--interactive') || 
         command.includes('-i');
}

// 優化特定命令以便在網頁環境中更好地顯示
function optimizeCommandForWeb(command) {
  const cmd = command.trim().split(' ')[0];
  const args = command.trim().split(' ').slice(1);
  
  switch (cmd) {
    case 'top':
      // 將 top 轉換為批次模式，只顯示一次
      if (!args.includes('-b')) {
        return `${cmd} -b -n1 ${args.join(' ')}`.trim();
      }
      break;
    case 'htop':
      // htop 沒有批次模式，改用 top
      return `top -b -n1 ${args.join(' ')}`.trim();
    case 'less':
    case 'more':
      // 改用 cat 來避免分頁
      if (args.length > 0) {
        return `cat ${args.join(' ')}`;
      }
      break;
  }
  
  return command;
}

// 使用 PTY 執行需要 TTY 的命令
function executeCommandWithPTY(ws, message) {
  const { command, terminalId, options = {} } = message;
  const processId = Math.random().toString(36).substr(2, 9);
  const clientState = clients.get(ws.id);
  const currentTerminalId = terminalId || 'default';
  
  if (!clientState.terminals.has(currentTerminalId)) {
    clientState.terminals.set(currentTerminalId, {
      workingDirectory: clientState.workingDirectory
    });
  }
  
  const terminalState = clientState.terminals.get(currentTerminalId);
  const currentWorkingDir = terminalState.workingDirectory;
  const isWindows = process.platform === 'win32';
  
  // 檢查是否需要清理 ANSI 序列（根據前端設定決定）
  const shouldStripAnsi = options.optimizeInteractiveCommands !== false; // 如果優化交互式命令，則清理 ANSI
  
  ws.send(JSON.stringify({
    type: 'info',
    message: `執行命令 (PTY): ${command}`,
    processId: processId,
    timestamp: new Date().toISOString()
  }));
  
  console.log(`使用 PTY 執行命令: ${command}, 工作目錄: ${currentWorkingDir}`);
  
  try {
    // 設置環境變數，特別針對交互式命令
    const env = { ...process.env };
    
    // 針對特定命令優化環境變數
    const cmdName = command.trim().split(' ')[0];
    if (cmdName === 'top') {
      env.TERM = 'dumb'; // 使用簡單終端模式
      env.COLUMNS = '80';
      env.LINES = '24';
    } else if (['less', 'more', 'man'].includes(cmdName)) {
      env.PAGER = 'cat'; // 禁用分頁
      env.MANPAGER = 'cat';
    }
    
    // 使用 node-pty 創建偽終端
    const ptyProcess = pty.spawn(isWindows ? 'cmd.exe' : 'bash', 
      isWindows ? ['/c', command] : ['-c', command], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: currentWorkingDir,
      env: env
    });

    // 存儲進程信息
    processes.set(processId, {
      process: ptyProcess,
      clientId: ws.id,
      terminalId: currentTerminalId,
      command: command,
      startTime: new Date(),
      isPTY: true,
      shouldStripAnsi: shouldStripAnsi
    });

    // 處理 PTY 輸出
    ptyProcess.onData((data) => {
      let processedData = data;
      
      // 如果需要，清理 ANSI 轉義序列
      if (shouldStripAnsi) {
        processedData = stripAnsi(processedData);
        // 清理多餘的換行符
        processedData = processedData.replace(/\n\s*\n/g, '\n');
      }
      
      ws.send(JSON.stringify({
        type: 'stdout',
        data: processedData,
        processId: processId,
        timestamp: new Date().toISOString()
      }));
    });

    // 處理 PTY 結束
    ptyProcess.onExit(({ exitCode, signal }) => {
      processes.delete(processId);
      ws.send(JSON.stringify({
        type: 'close',
        message: `PTY 進程結束，退出碼: ${exitCode}${signal ? `, 信號: ${signal}` : ''}`,
        processId: processId,
        exitCode: exitCode,
        timestamp: new Date().toISOString()
      }));
    });

  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `PTY 執行命令失敗: ${error.message}`,
      processId: processId,
      timestamp: new Date().toISOString()
    }));
  }
}

function executeCommand(ws, message) {
  const { command, terminalId } = message;
  
  if (!command || command.trim() === '') {
    ws.send(JSON.stringify({
      type: 'error',
      message: '命令不能為空',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  const clientState = clients.get(ws.id);
  
  if (!clientState) {
    ws.send(JSON.stringify({
      type: 'error',
      message: '客戶端狀態不存在',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  const currentTerminalId = terminalId || 'default';
  
  // 確保終端存在，如果不存在則創建
  if (!clientState.terminals.has(currentTerminalId)) {
    createPersistentTerminal(ws, { terminalId: currentTerminalId });
    // 等待終端創建完成再執行命令
    setTimeout(() => executeCommandInPersistentTerminal(ws, message), 500);
    return;
  }
  
  const terminalState = clientState.terminals.get(currentTerminalId);
  
  // 檢查 PTY 是否就緒
  if (!terminalState.ptyProcess || !terminalState.isReady) {
    // 重新創建終端
    createPersistentTerminal(ws, { terminalId: currentTerminalId });
    // 等待終端創建完成再執行命令
    setTimeout(() => executeCommandInPersistentTerminal(ws, message), 500);
    return;
  }
  
  executeCommandInPersistentTerminal(ws, message);
}

// 在持久終端中執行命令
function executeCommandInPersistentTerminal(ws, message) {
  const { command, terminalId } = message;
  const clientState = clients.get(ws.id);
  const currentTerminalId = terminalId || 'default';
  const terminalState = clientState.terminals.get(currentTerminalId);
  
  if (!terminalState || !terminalState.ptyProcess || !terminalState.isReady) {
    ws.send(JSON.stringify({
      type: 'error',
      message: '終端未就緒，請稍後再試',
      terminalId: currentTerminalId,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  const processId = Math.random().toString(36).substr(2, 9);
  
  // 記錄命令歷史
  terminalState.commandHistory.push({
    command: command,
    timestamp: new Date(),
    processId: processId
  });
  
  ws.send(JSON.stringify({
    type: 'info',
    message: `執行命令: ${command}`,
    processId: processId,
    terminalId: currentTerminalId,
    timestamp: new Date().toISOString()
  }));
  
  console.log(`在持久終端 ${currentTerminalId} 中執行命令: ${command}`);
  
  try {
    // 將命令發送到持久的 PTY 進程
    terminalState.ptyProcess.write(`${command}\r`);
    
    // 記錄進程信息（用於追蹤和管理）
    processes.set(processId, {
      process: terminalState.ptyProcess,
      clientId: ws.id,
      terminalId: currentTerminalId,
      command: command,
      startTime: new Date(),
      isPersistent: true,
      isPTY: true
    });
    
    // 設置超時清理（可選，防止進程記錄累積太多）
    setTimeout(() => {
      if (processes.has(processId)) {
        processes.delete(processId);
      }
    }, 30000); // 30秒後自動清理記錄
    
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `執行命令失敗: ${error.message}`,
      processId: processId,
      terminalId: currentTerminalId,
      timestamp: new Date().toISOString()
    }));
  }
}

// 執行常規命令（不需要 PTY）
function executeRegularCommand(ws, message, processId, currentWorkingDir) {
  const { command, terminalId } = message;
  const currentTerminalId = terminalId || 'default';
  const isWindows = process.platform === 'win32';
  
  ws.send(JSON.stringify({
    type: 'info',
    message: `執行命令: ${command}`,
    processId: processId,
    timestamp: new Date().toISOString()
  }));
  
  // 調試信息
  console.log(`執行命令: ${command}, 工作目錄: ${currentWorkingDir}`);

  try {
    const shell = isWindows ? 'cmd' : 'bash';
    let shellArgs;
    
    // 驗證工作目錄是否存在
    if (!fs.existsSync(currentWorkingDir)) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `工作目錄不存在: ${currentWorkingDir}`,
        processId: processId,
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // 構建命令
    if (isWindows) {
      // Windows: 簡化命令構造，直接執行
      shellArgs = ['/c', `chcp 65001 >nul 2>&1 && ${command}`];
    } else {
      // Linux/Mac: 直接執行命令
      shellArgs = ['-c', command];
    }
    
    const spawnOptions = {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      cwd: currentWorkingDir // 設置子進程的工作目錄
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
      terminalId: currentTerminalId,
      command: command,
      startTime: new Date()
    });

    // 處理標準輸出
    childProcess.stdout.on('data', (data) => {
      const output = decodeOutput(data, isWindows);
      
      // 檢測是否包含暫停提示
      if (detectPausePrompt(output)) {
        handlePauseDetected(ws, processId, output);
        return;
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
      const output = decodeOutput(data, isWindows);
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

// 處理 cd 命令
function handleCdCommand(ws, command, terminalId, processId) {
  const clientState = clients.get(ws.id);
  if (!clientState) return;
  
  const terminalState = clientState.terminals.get(terminalId);
  if (!terminalState) return;
  
  // 解析目標目錄
  let targetDir = command.substring(3).trim(); // 移除 'cd '
  
  if (targetDir === '') {
    // cd 沒有參數，回到用戶主目錄
    targetDir = os.homedir();
  } else if (targetDir === '..') {
    // cd .. 回到上級目錄
    targetDir = path.dirname(terminalState.workingDirectory);
  } else if (targetDir === '.') {
    // cd . 保持當前目錄
    targetDir = terminalState.workingDirectory;
  } else if (!path.isAbsolute(targetDir)) {
    // 相對路徑，基於當前工作目錄
    targetDir = path.resolve(terminalState.workingDirectory, targetDir);
  }
  
  // 檢查目標目錄是否存在
  try {
    const stats = fs.statSync(targetDir);
    if (stats.isDirectory()) {
      // 更新終端的工作目錄
      terminalState.workingDirectory = targetDir;
      
      ws.send(JSON.stringify({
        type: 'info',
        message: `目錄已切換到: ${targetDir}`,
        processId: processId,
        timestamp: new Date().toISOString()
      }));
      
      // 發送工作目錄更新通知
      ws.send(JSON.stringify({
        type: 'working_directory_updated',
        terminalId: terminalId,
        workingDirectory: targetDir,
        timestamp: new Date().toISOString()
      }));
      
      ws.send(JSON.stringify({
        type: 'close',
        message: `進程結束，退出碼: 0`,
        processId: processId,
        exitCode: 0,
        timestamp: new Date().toISOString()
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'stderr',
        data: `'${targetDir}' 不是一個目錄`,
        processId: processId,
        timestamp: new Date().toISOString()
      }));
      
      ws.send(JSON.stringify({
        type: 'close',
        message: `進程結束，退出碼: 1`,
        processId: processId,
        exitCode: 1,
        timestamp: new Date().toISOString()
      }));
    }
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'stderr',
      data: `系統找不到指定的路徑。`,
      processId: processId,
      timestamp: new Date().toISOString()
    }));
    
    ws.send(JSON.stringify({
      type: 'close',
      message: `進程結束，退出碼: 1`,
      processId: processId,
      exitCode: 1,
      timestamp: new Date().toISOString()
    }));
  }
}

// 解碼輸出內容
function decodeOutput(data, isWindows) {
  if (isWindows) {
    // 嘗試從 Big5/GBK 轉換為 UTF-8
    try {
      return iconv.decode(data, 'cp950'); // cp950 是 Big5 的代碼頁
    } catch (error) {
      try {
        return iconv.decode(data, 'gbk');
      } catch (error2) {
        return data.toString('utf8');
      }
    }
  } else {
    return data.toString('utf8');
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
    if (processInfo.isPTY) {
      // PTY 進程使用 kill 方法
      processInfo.process.kill();
    } else {
      // 普通進程使用 SIGTERM 信號
      processInfo.process.kill('SIGTERM');
    }
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

// 暫停相關函數
function detectPausePrompt(output) {
  // 檢測各種暫停提示語句
  const pausePatterns = [
    /要繼續迭次嗎[？?]/i,
    /continue\s*\?/i,
    /按任意鍵繼續/i,
    /press\s+any\s+key/i,
    /continue\s*\([yn]\)/i,
    /繼續\s*\([yn]\)/i,
    /more\s*--/i,
    /--More--/i
  ];
  
  return pausePatterns.some(pattern => pattern.test(output));
}

function handlePauseDetected(ws, processId, output) {
  console.log(`檢測到暫停提示: ${processId}`);
  
  const processInfo = processes.get(processId);
  if (!processInfo) return;
  
  // 將進程標記為暫停狀態
  pausedProcesses.set(processId, {
    ...processInfo,
    pauseTime: new Date()
  });
  
  // 發送暫停通知給前端
  ws.send(JSON.stringify({
    type: 'pause_detected',
    message: '程序已暫停，等待用戶確認',
    processId: processId,
    promptText: output.trim(),
    timestamp: new Date().toISOString()
  }));
}

function handlePauseResponse(ws, message) {
  const { processId, response } = message;
  
  console.log(`收到暫停回應: ${processId}, 回應: ${response}`);
  
  const processInfo = pausedProcesses.get(processId);
  if (!processInfo) {
    ws.send(JSON.stringify({
      type: 'error',
      message: '找不到暫停中的進程',
      processId: processId,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  try {
    // 根據回應向進程發送相應的輸入
    let input = '';
    switch (response.toLowerCase()) {
      case 'yes':
      case 'y':
      case '是':
      case '繼續':
        input = 'y\n';
        break;
      case 'no':
      case 'n':
      case '否':
      case '停止':
        input = 'n\n';
        break;
      case 'space':
      case ' ':
        input = ' ';
        break;
      case 'enter':
        input = '\n';
        break;
      default:
        input = response + '\n';
    }
    
    // 向進程發送輸入
    processInfo.process.stdin.write(input);
    
    // 從暫停列表中移除
    pausedProcesses.delete(processId);
    
    ws.send(JSON.stringify({
      type: 'pause_resumed',
      message: `已回應：${response}，程序繼續執行`,
      processId: processId,
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `發送回應失敗: ${error.message}`,
      processId: processId,
      timestamp: new Date().toISOString()
    }));
  }
}

// 獲取系統信息
function getSystemInfo(ws) {
  const os = require('os');
  
  const systemInfo = {
    username: os.userInfo().username,
    hostname: os.hostname(),
    platform: os.platform(),
    homedir: os.homedir(),
    tmpdir: os.tmpdir()
  };
  
  ws.send(JSON.stringify({
    type: 'system_info',
    data: systemInfo,
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
      if (processInfo.isPTY) {
        // PTY 進程
        processInfo.process.kill();
      } else {
        // 普通進程
        processInfo.process.kill('SIGTERM');
      }
    } catch (error) {
      console.error(`終止進程 ${processId} 失敗:`, error);
    }
  }
  
  server.close(() => {
    console.log('服務器已關閉');
    process.exit(0);
  });
});