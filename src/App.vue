<template>
  <div class="container">
    <!-- 頂部狀態欄 -->
    <div class="header">
      <h1>WebSocket 終端機控制器</h1>
      <div class="connection-status">
        <div :class="['status-dot', { connected: isConnected }]"></div>
        <span>{{ connectionStatus }}</span>
      </div>
    </div>

    <div class="main-content">
      <!-- 主要終端區域 -->
      <div class="terminal-area">
        <!-- 命令輸入區 -->
        <div class="command-input-area">
          <div class="input-group">
            <input
              v-model="commandInput"
              @keyup.enter="executeCommand"
              @keyup.up="previousCommand"
              @keyup.down="nextCommand"
              :disabled="!isConnected"
              class="command-input"
              placeholder="輸入命令... (Enter 執行，↑↓ 瀏覽歷史)"
              ref="commandInputRef"
            />
            <button 
              @click="executeCommand" 
              :disabled="!isConnected || !commandInput.trim()"
              class="btn"
            >
              執行
            </button>
            <button 
              @click="clearOutput" 
              class="btn clear-btn"
            >
              清除
            </button>
          </div>
        </div>

        <!-- 輸出區域 -->
        <div class="output-area" ref="outputArea">
          <div 
            v-for="(line, index) in outputLines" 
            :key="index"
            :class="['output-line', line.type]"
          >
            <span class="timestamp">{{ formatTime(line.timestamp) }}</span>
            <span v-html="formatOutput(line.message)"></span>
          </div>
        </div>
      </div>

      <!-- 側邊欄 - 進程管理 -->
      <div class="sidebar">
        <div class="sidebar-header">
          活躍進程
          <button @click="refreshProcesses" class="btn" style="float: right; padding: 5px 10px; font-size: 12px;">
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
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'

export default {
  name: 'TerminalController',
  setup() {
    // 響應式數據
    const isConnected = ref(false)
    const connectionStatus = ref('未連接')
    const commandInput = ref('')
    const outputLines = reactive([])
    const processes = reactive([])
    const commandHistory = reactive([])
    const historyIndex = ref(-1)
    
    // DOM 引用
    const commandInputRef = ref(null)
    const outputArea = ref(null)
    
    // WebSocket 連接
    let ws = null
    
    // 連接 WebSocket
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.hostname}:3000`
      
      ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        isConnected.value = true
        connectionStatus.value = '已連接'
        addOutputLine('info', '已連接到服務器')
      }
      
      ws.onclose = () => {
        isConnected.value = false
        connectionStatus.value = '連接已斷開'
        addOutputLine('error', '與服務器的連接已斷開')
        
        // 自動重連
        setTimeout(() => {
          if (!isConnected.value) {
            addOutputLine('info', '嘗試重新連接...')
            connect()
          }
        }, 3000)
      }
      
      ws.onerror = (error) => {
        addOutputLine('error', `連接錯誤: ${error.message || '未知錯誤'}`)
      }
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleServerMessage(message)
        } catch (error) {
          addOutputLine('error', '收到無效的服務器消息')
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
          addOutputLine(type, message.message || data || '無消息內容', message.processId)
          break
          
        case 'process_list':
          processes.splice(0, processes.length, ...serverProcesses)
          break
          
        default:
          console.log('未處理的消息類型:', type, message)
      }
    }
    
    // 添加輸出行
    const addOutputLine = (type, message, processId = null) => {
      outputLines.push({
        type,
        message,
        processId,
        timestamp: new Date()
      })
      
      // 自動滾動到底部
      nextTick(() => {
        if (outputArea.value) {
          outputArea.value.scrollTop = outputArea.value.scrollHeight
        }
      })
      
      // 限制輸出行數，避免記憶體過度使用
      if (outputLines.length > 1000) {
        outputLines.splice(0, outputLines.length - 1000)
      }
    }
    
    // 執行命令
    const executeCommand = () => {
      const command = commandInput.value.trim()
      
      if (!command || !isConnected.value) return
      
      // 添加到命令歷史
      if (commandHistory[commandHistory.length - 1] !== command) {
        commandHistory.push(command)
        if (commandHistory.length > 50) {
          commandHistory.shift()
        }
      }
      historyIndex.value = -1
      
      // 發送命令到服務器
      ws.send(JSON.stringify({
        type: 'execute',
        command: command
      }))
      
      // 在輸出中顯示執行的命令
      addOutputLine('info', `$ ${command}`)
      
      // 清空輸入框
      commandInput.value = ''
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
    
    // 清除輸出
    const clearOutput = () => {
      outputLines.splice(0, outputLines.length)
    }
    
    // 命令歷史導航
    const previousCommand = () => {
      if (commandHistory.length === 0) return
      
      if (historyIndex.value === -1) {
        historyIndex.value = commandHistory.length - 1
      } else if (historyIndex.value > 0) {
        historyIndex.value--
      }
      
      commandInput.value = commandHistory[historyIndex.value]
    }
    
    const nextCommand = () => {
      if (commandHistory.length === 0 || historyIndex.value === -1) return
      
      if (historyIndex.value < commandHistory.length - 1) {
        historyIndex.value++
        commandInput.value = commandHistory[historyIndex.value]
      } else {
        historyIndex.value = -1
        commandInput.value = ''
      }
    }
    
    // 格式化時間
    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('zh-TW', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
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
      if (event.ctrlKey && event.key === 'l') {
        event.preventDefault()
        clearOutput()
      }
    }
    
    // 生命週期
    onMounted(() => {
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
      // 響應式數據
      isConnected,
      connectionStatus,
      commandInput,
      outputLines,
      processes,
      
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
      formatOutput
    }
  }
}
</script>