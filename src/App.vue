<template>
  <div class="container">
    <!-- 頂部狀態欄 -->
    <div class="header">
      <h1>WebSocket Terminal Controller</h1>
      <div class="connection-status">
        <div :class="['status-dot', { connected: isConnected }]"></div>
        <span>{{ connectionStatus }}</span>
      </div>
    </div>

    <div class="main-content">
      <!-- 主要終端區域 -->
      <div class="terminal-area">
        <!-- 終端標籤頁 -->
        <div class="terminal-tabs">
          <div class="tab-list">
            <div 
              v-for="terminal in terminals" 
              :key="terminal.id"
              :class="['tab-item', { active: activeTerminalId === terminal.id }]"
              @click="switchTerminal(terminal.id)"
            >
              <span class="tab-title">{{ terminal.name }}</span>
              <button 
                v-if="terminals.length > 1"
                @click.stop="closeTerminal(terminal.id)"
                class="tab-close"
                title="關閉標籤頁"
              >
                ×
              </button>
            </div>
            <button 
              @click="createNewTerminal"
              class="tab-add"
              title="新增終端標籤頁"
            >
              +
            </button>
          </div>
        </div>

        <!-- 輸出區域 -->
        <div class="output-area" ref="outputArea" :style="{ fontSize: settings.fontSize + 'px' }">
          <div 
            v-for="(line, index) in filteredOutputLines" 
            :key="index"
            :class="['output-line', line.type]"
          >
            <span v-if="settings.showTimestamp" class="timestamp">{{ getTimestampDisplay(line, index) }}</span>
            <span v-html="formatOutput(line.message)"></span>
          </div>
        </div>

        <!-- 命令輸入區 -->
        <div class="command-input-area">
          <div class="input-group">
            <!-- <span class="command-prompt">{{ getPromptText() }}</span> -->
            <input
              v-model="currentTerminal.commandInput"
              @keyup.enter="executeCommand"
              @keyup.up="previousCommand"
              @keyup.down="nextCommand"
              :disabled="!isConnected"
              class="command-input"
              placeholder="輸入命令並按 Enter 執行，↑↓ 瀏覽歷史"
              ref="commandInputRef"
            />
            <button 
              @click="executeCommand" 
              :disabled="!isConnected || !currentTerminal.commandInput.trim()"
              class="btn"
              style="margin-left: 10px;"
            >
              執行
            </button>
            <button 
              @click="clearOutput" 
              class="btn clear-btn"
            >
              清除
            </button>
            <button 
              @click="toggleSettings" 
              class="btn settings-btn"
              title="設定"
            >
              ⚙️
            </button>
          </div>
        </div>
      </div>

      <!-- 側邊欄 - 進程管理 -->
      <div class="sidebar">
        <div class="sidebar-header">
          <span>活躍進程</span>
          <button @click="refreshProcesses" class="btn sidebar-refresh-btn">
            刷新
          </button>
        </div>
        
        <div class="process-list">
          <div v-if="processes.length === 0" style="color: #888; text-align: center; margin-top: 20px;">
            沒有活躍的進程
          </div>
          
          <div 
            v-for="process in processes" 
            :key="process.id"
            class="process-item"
          >
            <div class="process-id">ID: {{ process.id }}</div>
            <div class="process-command">{{ process.command }}</div>
            <div class="process-info">
              PID: {{ process.pid }}<br>
              開始時間: {{ formatTime(process.startTime) }}
            </div>
            <button 
              @click="killProcess(process.id)"
              class="btn btn-danger"
              style="margin-top: 8px; padding: 4px 8px; font-size: 12px;"
            >
              終止
            </button>
          </div>
        </div>

        <!-- 快捷鍵說明 -->
        <div class="shortcuts">
          <h4>快捷鍵</h4>
          <div class="shortcut">
            <span>執行命令</span>
            <span class="shortcut-key">Enter</span>
          </div>
          <div class="shortcut">
            <span>上一個命令</span>
            <span class="shortcut-key">↑</span>
          </div>
          <div class="shortcut">
            <span>下一個命令</span>
            <span class="shortcut-key">↓</span>
          </div>
          <div class="shortcut">
            <span>清除輸出</span>
            <span class="shortcut-key">Ctrl+L</span>
          </div>
          <div class="shortcut">
            <span>新增標籤頁</span>
            <span class="shortcut-key">Ctrl+T</span>
          </div>
          <div class="shortcut">
            <span>關閉標籤頁</span>
            <span class="shortcut-key">Ctrl+W</span>
          </div>
          <div class="shortcut">
            <span>下一個標籤頁</span>
            <span class="shortcut-key">Ctrl+Tab</span>
          </div>
          <div class="shortcut">
            <span>上一個標籤頁</span>
            <span class="shortcut-key">Ctrl+Shift+Tab</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 暫停確認對話框 -->
    <div v-if="pausedProcess" class="pause-overlay">
      <div class="pause-dialog">
        <div class="pause-header">
          <h3>⏸️ 程序暫停</h3>
        </div>
        
        <div class="pause-content">
          <p class="pause-prompt">{{ pausedProcess.promptText }}</p>
          <p class="pause-instruction">程序正在等待您的回應，請選擇：</p>
          
          <div class="pause-buttons">
            <button @click="respondToPause('yes')" class="btn btn-primary">
              是 (Y)
            </button>
            <button @click="respondToPause('no')" class="btn btn-secondary">
              否 (N)
            </button>
            <button @click="respondToPause('space')" class="btn btn-secondary">
              空格鍵
            </button>
            <button @click="respondToPause('enter')" class="btn btn-secondary">
              Enter
            </button>
          </div>
          
          <div class="pause-custom">
            <input 
              v-model="customResponse"
              @keyup.enter="respondToPause(customResponse)"
              placeholder="或輸入自定義回應..."
              class="custom-input"
            />
            <button @click="respondToPause(customResponse)" class="btn btn-primary">
              發送
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 設定面板 -->
    <div v-if="showSettings" class="settings-overlay" @click="closeSettings">
      <div class="settings-panel" @click.stop>
        <div class="settings-header">
          <h3>終端設定</h3>
          <button @click="closeSettings" class="close-btn">×</button>
        </div>
        
        <div class="settings-content">
          <!-- 顯示設定 -->
          <div class="settings-section">
            <h4>顯示設定</h4>
            <div class="setting-item">
              <label class="setting-label">
                <input 
                  type="checkbox" 
                  v-model="settings.showSystemMessages"
                  class="setting-checkbox"
                />
                <span class="setting-text">顯示系統消息</span>
                <span class="setting-description">顯示「執行命令」、「進程結束」等系統提示</span>
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <input 
                  type="checkbox" 
                  v-model="settings.showTimestamp"
                  class="setting-checkbox"
                />
                <span class="setting-text">顯示時間戳記</span>
                <span class="setting-description">在每行輸出前顯示時間</span>
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <input 
                  type="checkbox" 
                  v-model="settings.autoScroll"
                  class="setting-checkbox"
                />
                <span class="setting-text">自動滾動</span>
                <span class="setting-description">新輸出時自動滾動到底部</span>
              </label>
            </div>
          </div>
          
          <!-- 終端設定 -->
          <div class="settings-section">
            <h4>終端設定</h4>
            <div class="setting-item">
              <label class="setting-label">
                <span class="setting-text">字體大小</span>
                <select v-model="settings.fontSize" class="setting-select">
                  <option value="12">12px</option>
                  <option value="13">13px</option>
                  <option value="14">14px</option>
                  <option value="15">15px</option>
                  <option value="16">16px</option>
                  <option value="18">18px</option>
                </select>
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <span class="setting-text">最大輸出行數</span>
                <input 
                  type="number" 
                  v-model="settings.maxOutputLines"
                  class="setting-input"
                  min="100"
                  max="5000"
                  step="100"
                />
                <span class="setting-description">限制每個終端的最大輸出行數</span>
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <span class="setting-text">命令歷史記錄數量</span>
                <input 
                  type="number" 
                  v-model="settings.maxHistorySize"
                  class="setting-input"
                  min="10"
                  max="200"
                  step="10"
                />
                <span class="setting-description">每個終端保存的命令歷史數量</span>
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <input 
                  type="checkbox" 
                  v-model="settings.optimizeInteractiveCommands"
                  class="setting-checkbox"
                />
                <span class="setting-text">優化交互式命令</span>
                <span class="setting-description">自動將 top, htop 等命令轉換為批次模式，避免 ANSI 轉義序列問題</span>
              </label>
            </div>
          </div>
          
          <!-- 快捷鍵設定 -->
          <div class="settings-section">
            <h4>快捷鍵說明</h4>
            <div class="shortcuts-list">
              <div class="shortcut-item">
                <span class="shortcut-key">Ctrl + T</span>
                <span class="shortcut-desc">新增終端標籤頁</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-key">Ctrl + W</span>
                <span class="shortcut-desc">關閉當前標籤頁</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-key">Ctrl + L</span>
                <span class="shortcut-desc">清除當前終端輸出</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-key">Ctrl + ,</span>
                <span class="shortcut-desc">開啟設定面板</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="settings-footer">
          <button @click="resetSettings" class="btn btn-secondary">重設為預設值</button>
          <button @click="saveSettings" class="btn btn-primary">儲存設定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, nextTick, computed } from 'vue'

export default {
  name: 'TerminalController',
  setup() {
    // 終端管理相關
    let terminalCounter = 0
    const terminals = reactive([])
    const activeTerminalId = ref(null)
    
    // 全域狀態
    const isConnected = ref(false)
    const connectionStatus = ref('未連接')
    const processes = reactive([])
    const showSettings = ref(false) // 控制設定面板顯示
    const pausedProcess = ref(null) // 當前暫停的進程信息
    const customResponse = ref('') // 自定義回應內容
    const systemInfo = ref(null) // 系統信息
    
    // 設定管理
    const settings = reactive({
      showSystemMessages: true,    // 顯示系統消息
      showTimestamp: true,         // 顯示時間戳記
      autoScroll: true,            // 自動滾動
      fontSize: 14,                // 字體大小
      maxOutputLines: 1000,        // 最大輸出行數
      maxHistorySize: 50,          // 命令歷史記錄數量
      optimizeInteractiveCommands: true  // 優化交互式命令（如 top, htop）
    })
    
    // DOM 引用
    const commandInputRef = ref(null)
    const outputArea = ref(null)
    
    // WebSocket 連接
    let ws = null
    
    // 計算屬性：當前活躍終端
    const currentTerminal = computed(() => {
      return terminals.find(t => t.id === activeTerminalId.value) || {}
    })
    
    // 計算屬性：過濾後的輸出行
    const filteredOutputLines = computed(() => {
      const terminal = currentTerminal.value
      if (!terminal || !terminal.outputLines) return []
      
      let filtered = terminal.outputLines
      
      // 根據設定過濾系統消息
      if (!settings.showSystemMessages) {
        filtered = filtered.filter(line => {
          return line.type === 'stdout' || line.type === 'stderr'
        })
      }
      
      return filtered
    })
    
    // 創建新終端
    const createTerminal = (name = null) => {
      terminalCounter++
      const terminal = {
        id: `terminal-${terminalCounter}`,
        name: name || `終端 ${terminalCounter}`,
        commandInput: '',
        outputLines: reactive([]),
        commandHistory: reactive([]),
        historyIndex: -1,
        workingDirectory: 'C:\\'  // 默認工作目錄
      }
      
      terminals.push(terminal)
      return terminal
    }
    
    // 創建新終端標籤頁
    const createNewTerminal = () => {
      const newTerminal = createTerminal()
      switchTerminal(newTerminal.id)
      
      // 如果已連接，為新終端添加歡迎訊息
      if (isConnected.value) {
        addOutputLine('info', '新終端已創建', newTerminal.id)
      }
      
      // 聚焦輸入框
      nextTick(() => {
        if (commandInputRef.value) {
          commandInputRef.value.focus()
        }
      })
    }
    
    // 切換終端
    const switchTerminal = (terminalId) => {
      activeTerminalId.value = terminalId
      
      // 聚焦輸入框
      nextTick(() => {
        if (commandInputRef.value) {
          commandInputRef.value.focus()
        }
        
        // 滾動到輸出底部
        if (outputArea.value) {
          outputArea.value.scrollTop = outputArea.value.scrollHeight
        }
      })
    }
    
    // 關閉終端
    const closeTerminal = (terminalId) => {
      if (terminals.length <= 1) return // 至少保留一個終端
      
      const terminalIndex = terminals.findIndex(t => t.id === terminalId)
      if (terminalIndex === -1) return
      
      terminals.splice(terminalIndex, 1)
      
      // 如果關閉的是當前終端，切換到其他終端
      if (activeTerminalId.value === terminalId) {
        const newActiveIndex = Math.min(terminalIndex, terminals.length - 1)
        switchTerminal(terminals[newActiveIndex].id)
      }
    }
    
    // 更新工作目錄
    const updateWorkingDirectory = (terminalId, workingDirectory) => {
      const terminal = terminals.find(t => t.id === terminalId)
      if (terminal) {
        terminal.workingDirectory = workingDirectory
      }
    }

    // 生成命令提示符
    const getPromptText = () => {
      if (!currentTerminal.value) return 'C:\\>'
      
      // 獲取當前目錄
      const currentDir = currentTerminal.value.workingDirectory || 'C:\\'
      
      // 縮短路徑顯示
      let displayPath = currentDir
      if (currentDir.length > 50) {
        const parts = currentDir.split('\\')
        if (parts.length > 3) {
          displayPath = `${parts[0]}\\...\\${parts[parts.length-2]}\\${parts[parts.length-1]}`
        }
      }
      
      // 只顯示路徑，使用 > 作為提示符
      return `${displayPath}>`
    }

    // 初始化第一個終端
    const initializeTerminals = () => {
      const firstTerminal = createTerminal('主終端')
      activeTerminalId.value = firstTerminal.id
    }
    
    // 連接 WebSocket
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.hostname}:3000`
      
      ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        isConnected.value = true
        connectionStatus.value = '已連接'
        
        // 請求系統信息
        ws.send(JSON.stringify({
          type: 'get_system_info'
        }))
        
        // 為所有終端添加連接訊息
        terminals.forEach(terminal => {
          addOutputLine('info', '已連接到服務器', terminal.id)
        })
      }
      
      ws.onclose = () => {
        isConnected.value = false
        connectionStatus.value = '連接已斷開'
        
        // 為所有終端添加斷開訊息
        terminals.forEach(terminal => {
          addOutputLine('error', '與服務器的連接已斷開', terminal.id)
        })
        
        // 自動重連
        setTimeout(() => {
          if (!isConnected.value) {
            terminals.forEach(terminal => {
              addOutputLine('info', '嘗試重新連接...', terminal.id)
            })
            connect()
          }
        }, 3000)
      }
      
      ws.onerror = (error) => {
        terminals.forEach(terminal => {
          addOutputLine('error', `連接錯誤: ${error.message || '未知錯誤'}`, terminal.id)
        })
      }
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleServerMessage(message)
        } catch (error) {
          terminals.forEach(terminal => {
            addOutputLine('error', '收到無效的服務器消息', terminal.id)
          })
        }
      }
    }
    
    // 處理服務器消息
    const handleServerMessage = (message) => {
      const { type, data, processes: serverProcesses } = message
      
      switch (type) {
        case 'info':
        case 'error':
        case 'stdout':
        case 'stderr':
        case 'close':
          // 將訊息添加到當前活躍終端
          addOutputLine(type, message.message || data || '無消息內容', activeTerminalId.value, message.processId)
          break
          
        case 'process_list':
          processes.splice(0, processes.length, ...serverProcesses)
          break
          
        case 'pause_detected':
          handlePauseDetected(message)
          break
          
        case 'pause_resumed':
          addOutputLine('info', message.message || '程序已繼續執行', activeTerminalId.value, message.processId)
          break
          
        case 'system_info':
          systemInfo.value = message.data
          break
          
        case 'working_directory_updated':
          updateWorkingDirectory(message.terminalId, message.workingDirectory)
          break
          
        default:
          console.log('未處理的消息類型:', type, message)
      }
    }
    
    // 添加輸出行
    const addOutputLine = (type, message, terminalId = null, processId = null) => {
      const targetTerminalId = terminalId || activeTerminalId.value
      const terminal = terminals.find(t => t.id === targetTerminalId)
      
      if (!terminal) return
      
      // 處理多行輸出：如果是 stdout 或 stderr，並且包含換行符，則分別處理每一行
      if ((type === 'stdout' || type === 'stderr') && typeof message === 'string' && message.includes('\n')) {
        const lines = message.split('\n')
        const baseTimestamp = new Date()
        
        lines.forEach((line, index) => {
          // 跳過空行，除非它是唯一的行
          if (line.trim() === '' && lines.length > 1) return
          
          terminal.outputLines.push({
            type,
            message: line,
            processId,
            timestamp: new Date(baseTimestamp.getTime() + index) // 輕微偏移時間戳以保持順序
          })
        })
      } else {
        // 單行輸出的正常處理
        terminal.outputLines.push({
          type,
          message,
          processId,
          timestamp: new Date()
        })
      }
      
      // 如果是當前活躍終端且啟用自動滾動，則滾動到底部
      if (targetTerminalId === activeTerminalId.value && settings.autoScroll) {
        nextTick(() => {
          if (outputArea.value) {
            outputArea.value.scrollTop = outputArea.value.scrollHeight
          }
        })
      }
      
      // 限制輸出行數，避免記憶體過度使用
      if (terminal.outputLines.length > settings.maxOutputLines) {
        terminal.outputLines.splice(0, terminal.outputLines.length - settings.maxOutputLines)
      }
    }
    
    // 設定管理相關方法
    const toggleSettings = () => {
      showSettings.value = !showSettings.value
    }
    
    const closeSettings = () => {
      showSettings.value = false
    }
    
    const saveSettings = () => {
      // 儲存設定到 localStorage
      try {
        localStorage.setItem('terminalSettings', JSON.stringify(settings))
        closeSettings()
        // 可以添加成功提示
      } catch (error) {
        console.error('儲存設定失敗:', error)
      }
    }
    
    const loadSettings = () => {
      // 從 localStorage 載入設定
      try {
        const saved = localStorage.getItem('terminalSettings')
        if (saved) {
          const parsedSettings = JSON.parse(saved)
          Object.assign(settings, parsedSettings)
        }
      } catch (error) {
        console.error('載入設定失敗:', error)
      }
    }
    
    const resetSettings = () => {
      // 重設為預設值
      Object.assign(settings, {
        showSystemMessages: true,
        showTimestamp: true,
        autoScroll: true,
        fontSize: 14,
        maxOutputLines: 1000,
        maxHistorySize: 50,
        optimizeInteractiveCommands: true
      })
    }
    
    // 暫停處理相關方法
    const handlePauseDetected = (message) => {
      pausedProcess.value = {
        processId: message.processId,
        promptText: message.promptText || message.message,
        timestamp: message.timestamp
      }
      
      // 在輸出中顯示暫停提示
      addOutputLine('info', `🔄 ${message.message}`, activeTerminalId.value, message.processId)
    }
    
    const respondToPause = (response) => {
      if (!pausedProcess.value || !ws || !response) return
      
      // 發送回應到服務器
      ws.send(JSON.stringify({
        type: 'pause_response',
        processId: pausedProcess.value.processId,
        response: response
      }))
      
      // 在輸出中顯示用戶回應
      addOutputLine('info', `➤ 回應：${response}`, activeTerminalId.value, pausedProcess.value.processId)
      
      // 清除狀態
      pausedProcess.value = null
      customResponse.value = ''
    }
    
    // 執行命令
    const executeCommand = () => {
      const terminal = currentTerminal.value
      if (!terminal) return
      
      const command = terminal.commandInput.trim()
      
      if (!command || !isConnected.value) return
      
      // 添加到當前終端的命令歷史
      if (terminal.commandHistory[terminal.commandHistory.length - 1] !== command) {
        terminal.commandHistory.push(command)
        if (terminal.commandHistory.length > settings.maxHistorySize) {
          terminal.commandHistory.shift()
        }
      }
      terminal.historyIndex = -1
      
      // 發送命令到服務器
      ws.send(JSON.stringify({
        type: 'execute',
        command: command,
        terminalId: terminal.id,
        options: {
          optimizeInteractiveCommands: settings.optimizeInteractiveCommands
        }
      }))
      
      // 在輸出中顯示執行的命令
      addOutputLine('info', `$ ${command}`, terminal.id)
      
      // 清空輸入框
      terminal.commandInput = ''
    }
    
    // 終止進程
    const killProcess = (processId) => {
      if (!isConnected.value) return
      
      ws.send(JSON.stringify({
        type: 'kill',
        processId: processId
      }))
    }
    
    // 刷新進程列表
    const refreshProcesses = () => {
      if (!isConnected.value) return
      
      ws.send(JSON.stringify({
        type: 'list'
      }))
    }
    
    // 清除當前終端輸出
    const clearOutput = () => {
      const terminal = currentTerminal.value
      if (!terminal) return
      
      terminal.outputLines.splice(0, terminal.outputLines.length)
    }
    
    // 命令歷史導航
    const previousCommand = () => {
      const terminal = currentTerminal.value
      if (!terminal || terminal.commandHistory.length === 0) return
      
      if (terminal.historyIndex === -1) {
        terminal.historyIndex = terminal.commandHistory.length - 1
      } else if (terminal.historyIndex > 0) {
        terminal.historyIndex--
      }
      
      terminal.commandInput = terminal.commandHistory[terminal.historyIndex]
    }
    
    const nextCommand = () => {
      const terminal = currentTerminal.value
      if (!terminal || terminal.commandHistory.length === 0 || terminal.historyIndex === -1) return
      
      if (terminal.historyIndex < terminal.commandHistory.length - 1) {
        terminal.historyIndex++
        terminal.commandInput = terminal.commandHistory[terminal.historyIndex]
      } else {
        terminal.historyIndex = -1
        terminal.commandInput = ''
      }
    }
    
    // 格式化時間
    // 格式化時間戳顯示
    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('zh-TW', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }
    
    // 智慧時間戳顯示：對於連續的同類型消息，只在第一條顯示時間
    const getTimestampDisplay = (line, index) => {
      if (!line.timestamp) return ''
      
      const lines = filteredOutputLines.value
      if (index === 0) {
        return formatTime(line.timestamp)
      }
      
      const prevLine = lines[index - 1]
      const currentTime = new Date(line.timestamp).getTime()
      const prevTime = new Date(prevLine.timestamp).getTime()
      
      // 如果與前一行的時間差小於 1 秒，且是同類型的輸出，則不顯示時間戳
      if (
        Math.abs(currentTime - prevTime) < 1000 && 
        line.type === prevLine.type &&
        (line.type === 'stdout' || line.type === 'stderr') &&
        line.processId === prevLine.processId
      ) {
        return '' // 返回空字符串，但 CSS 會保持空間對齊
      }
      
      return formatTime(line.timestamp)
    }
    
    // 格式化輸出內容
    const formatOutput = (message) => {
      // 基本的 HTML 轉義並保持換行
      return message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/ {2,}/g, (match) => '&nbsp;'.repeat(match.length))
    }
    
    // 鍵盤快捷鍵
    const handleKeydown = (event) => {
      // Ctrl+L: 清除當前終端輸出
      if (event.ctrlKey && event.key === 'l') {
        event.preventDefault()
        clearOutput()
      }
      
      // Ctrl+T: 創建新終端標籤頁
      if (event.ctrlKey && event.key === 't') {
        event.preventDefault()
        createNewTerminal()
      }
      
      // Ctrl+,: 開啟設定面板
      if (event.ctrlKey && event.key === ',') {
        event.preventDefault()
        toggleSettings()
      }
      
      // Ctrl+W: 關閉當前終端標籤頁
      if (event.ctrlKey && event.key === 'w') {
        event.preventDefault()
        closeTerminal(activeTerminalId.value)
      }
      
      // Ctrl+Tab: 切換到下一個終端標籤頁
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault()
        const currentIndex = terminals.findIndex(t => t.id === activeTerminalId.value)
        const nextIndex = (currentIndex + 1) % terminals.length
        switchTerminal(terminals[nextIndex].id)
      }
      
      // Ctrl+Shift+Tab: 切換到上一個終端標籤頁
      if (event.ctrlKey && event.shiftKey && event.key === 'Tab') {
        event.preventDefault()
        const currentIndex = terminals.findIndex(t => t.id === activeTerminalId.value)
        const prevIndex = currentIndex === 0 ? terminals.length - 1 : currentIndex - 1
        switchTerminal(terminals[prevIndex].id)
      }
    }
    
    // 生命週期
    onMounted(() => {
      // 載入設定
      loadSettings()
      
      // 初始化終端
      initializeTerminals()
      
      // 連接 WebSocket
      connect()
      document.addEventListener('keydown', handleKeydown)
      
      // 自動刷新進程列表
      const processRefreshInterval = setInterval(() => {
        if (isConnected.value) {
          refreshProcesses()
        }
      }, 5000)
      
      // 清理定時器
      onUnmounted(() => {
        clearInterval(processRefreshInterval)
      })
    })
    
    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeydown)
      if (ws) {
        ws.close()
      }
    })
    
    return {
      // 終端管理
      terminals,
      activeTerminalId,
      currentTerminal,
      createNewTerminal,
      switchTerminal,
      closeTerminal,
      
      // 全域狀態
      isConnected,
      connectionStatus,
      processes,
      showSettings,
      settings,
      pausedProcess,
      customResponse,
      systemInfo,
      
      // 計算屬性
      filteredOutputLines,
      
      // DOM 引用
      commandInputRef,
      outputArea,
      
      // 方法
      executeCommand,
      killProcess,
      refreshProcesses,
      clearOutput,
      previousCommand,
      nextCommand,
      formatTime,
      getTimestampDisplay,
      formatOutput,
      getPromptText,
      updateWorkingDirectory,
      
      // 設定相關方法
      toggleSettings,
      closeSettings,
      saveSettings,
      resetSettings,
      
      // 暫停處理方法
      respondToPause
    }
  }
}
</script>

<style scoped>
.timestamp {
  display: inline-block;
  width: 70px; /* 固定寬度確保對齊 */
  color: #888;
  font-size: 0.9em;
  margin-right: 8px;
  text-align: left;
  white-space: nowrap;
}

.output-line {
  display: flex;
  align-items: flex-start;
  margin-bottom: 2px;
}

.output-line .timestamp {
  flex-shrink: 0; /* 防止時間戳被壓縮 */
}
</style>