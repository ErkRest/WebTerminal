<template>
  <div class="container">
    <!-- 頂部狀態欄 -->
    <div class="header">
      <h1>WebSocket Terminal Controller</h1>
      <div class="header-controls">
        <div class="connection-status">
          <div :class="['status-dot', { connected: isConnected }]"></div>
          <span>{{ connectionStatus }}</span>
        </div>
        <div class="header-buttons">
          <button 
            @click="clearOutput" 
            class="header-btn"
            title="清除終端 (Ctrl+L)"
          >
            🗑️
          </button>
          <button 
            @click="toggleSettings" 
            class="header-btn"
            title="設定"
          >
            ⚙️
          </button>
        </div>
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

        <!-- 整合終端顯示區域 -->
        <div class="integrated-terminal" ref="terminalContainer" :style="{ fontSize: settings.fontSize + 'px' }">
          <textarea
            ref="terminalTextarea"
            v-model="terminalDisplay"
            @keydown="handleTerminalKeydown"
            @click="handleTerminalClick"
            @mousedown="handleMouseDown"
            @mouseup="handleMouseUp"
            @select="handleTextSelect"
            :disabled="!isConnected"
            class="terminal-textarea"
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
          ></textarea>
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
    const showSettings = ref(false) // 控制設定面板顯示
    const pausedProcess = ref(null) // 當前暫停的進程信息
    const customResponse = ref('') // 自定義回應內容
    const systemInfo = ref(null) // 系統信息
    
    // 設定管理
    const settings = reactive({
      showSystemMessages: false,   // 顯示系統消息
      showTimestamp: true,         // 顯示時間戳記
      autoScroll: true,            // 自動滾動
      fontSize: 14,                // 字體大小
      maxOutputLines: 1000,        // 最大輸出行數
      maxHistorySize: 50,          // 命令歷史記錄數量
      optimizeInteractiveCommands: true  // 優化交互式命令（如 top, htop）
    })
    
    // 終端顯示內容
    const terminalDisplay = ref('')
    const currentCommand = ref('')
    const commandHistoryIndex = ref(-1)
    
    // DOM 引用
    const terminalTextarea = ref(null)
    const terminalContainer = ref(null)
    
    // WebSocket 連接
    let ws = null
    
    // 計算屬性：當前活躍終端
    const currentTerminal = computed(() => {
      return terminals.find(t => t.id === activeTerminalId.value) || {}
    })
    
    // 判斷是否應該隱藏系統訊息
    const shouldHideSystemMessage = (message) => {
      const hidePatterns = [
        '正在建立持久化終端連線',
        '已連接到服務器',
        '持久化終端已就緒',
        '正在創建新的持久化終端',
        '與服務器的連接已斷開',
        '嘗試重新連接',
        '執行命令:',           // 隱藏執行命令的系統提示
        '進程結束，退出碼:',    // 隱藏進程結束提示
        '程序已暫停',          // 隱藏暫停提示
        '等待用戶輸入'         // 隱藏等待輸入提示
      ]
      
      return hidePatterns.some(pattern => message.includes(pattern))
    }

    // 更新終端顯示內容
    const updateTerminalDisplay = () => {
      if (!currentTerminal.value || !currentTerminal.value.outputLines) return
      
      let content = ''
      const lines = currentTerminal.value.outputLines
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // 過濾系統訊息
        if (line.type === 'info' && shouldHideSystemMessage(line.message)) {
          continue
        }
        
        if (!settings.showSystemMessages && line.type !== 'stdout' && line.type !== 'stderr') {
          continue
        }
        
        let lineContent = line.message
        // 移除所有 ANSI 轉義序列以簡化顯示
        lineContent = stripAnsiEscapes(lineContent)
        
        // 檢查是否是最後一行且看起來像提示符（包含 $ 或 > 結尾）
        const isLastLine = i === lines.length - 1
        const looksLikePrompt = lineContent.trim().endsWith('$') || lineContent.trim().endsWith('>')
        
        content += lineContent
        
        // 如果不是最後一行，或者最後一行不像提示符，則添加換行
        if (!isLastLine || !looksLikePrompt) {
          content += '\n'
        }
      }
      
      // 添加當前輸入的命令（緊接在提示符後面）
      if (currentCommand.value) {
        content += currentCommand.value
      }
      
      terminalDisplay.value = content
      
      // 確保游標始終在底部並保持滾動
      nextTick(() => {
        ensureCursorAtBottom()
      })
    }
    
    // 確保游標和視窗始終在底部的函數
    const ensureCursorAtBottom = () => {
      if (!terminalTextarea.value) return
      
      const textarea = terminalTextarea.value
      const textLength = textarea.value.length
      
      // 將光標定位到最後
      textarea.setSelectionRange(textLength, textLength)
      
      // 強制滾動到底部
      if (settings.autoScroll) {
        textarea.scrollTop = textarea.scrollHeight
        
        // 再次確保滾動到底部（有時需要雙重確保）
        setTimeout(() => {
          textarea.scrollTop = textarea.scrollHeight
        }, 10)
      }
      
      // 確保 textarea 獲得焦點以顯示游標
      if (document.activeElement !== textarea) {
        textarea.focus()
      }
    }
    
    // 處理終端鍵盤輸入
    const handleTerminalKeydown = (event) => {
      const textarea = terminalTextarea.value
      if (!textarea || !isConnected.value) return
      
      // 計算可編輯區域的開始位置
      const content = textarea.value
      const lines = content.split('\n')
      const lastLineIndex = lines.length - 1
      const lastLine = lines[lastLineIndex] || ''
      
      // 找到最後一個真實的提示符位置（如 "resta@pi:~ $ "）
      const promptMatch = lastLine.match(/.*[$#%>]\s*/)
      const editableStartPos = promptMatch ? 
        content.lastIndexOf(lastLine) + promptMatch[0].length : 
        content.length
      
      // 特別處理 Backspace 鍵：防止刪除提示符或之前的內容
      if (event.key === 'Backspace') {
        const selectionStart = textarea.selectionStart
        const selectionEnd = textarea.selectionEnd
        
        // 如果是選擇範圍刪除，檢查選擇範圍是否包含受保護區域
        if (selectionStart !== selectionEnd) {
          if (selectionStart < editableStartPos) {
            event.preventDefault()
            return
          }
        } else {
          // 單純的 Backspace，檢查光標位置
          if (selectionStart <= editableStartPos) {
            event.preventDefault()
            return
          }
        }
      }
      
      // 特別處理 Delete 鍵：防止刪除提示符或之前的內容
      if (event.key === 'Delete') {
        const selectionStart = textarea.selectionStart
        const selectionEnd = textarea.selectionEnd
        
        // 如果是選擇範圍刪除，檢查選擇範圍是否包含受保護區域
        if (selectionStart !== selectionEnd) {
          if (selectionStart < editableStartPos) {
            event.preventDefault()
            return
          }
        } else {
          // 單純的 Delete，檢查光標位置
          if (selectionStart < editableStartPos) {
            event.preventDefault()
            return
          }
        }
      }
      
      // 處理其他編輯操作：防止在受保護區域輸入或編輯
      const isOtherEditingKey = event.key.length === 1 || 
                               (event.ctrlKey && (event.key === 'v' || event.key === 'x'))
      
      if (isOtherEditingKey && textarea.selectionStart < editableStartPos) {
        event.preventDefault()
        textarea.setSelectionRange(editableStartPos, editableStartPos)
        return
      }
      
      // 處理 Ctrl+A (全選)：只選擇可編輯區域
      if (event.ctrlKey && event.key === 'a') {
        event.preventDefault()
        textarea.setSelectionRange(editableStartPos, content.length)
        return
      }
      
      // 提取當前命令（從可編輯位置開始到行尾）
      currentCommand.value = lastLine.substring(promptMatch ? promptMatch[0].length : 0)
      
      if (event.key === 'Enter') {
        event.preventDefault()
        
        if (currentCommand.value.trim()) {
          executeCommand()
        } else {
          // 空命令，直接添加新行
          addOutputLine('info', '', currentTerminal.value.id)
          updateTerminalDisplay()
        }
        
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        navigateHistory(-1)
        
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        navigateHistory(1)
        
      } else if (event.ctrlKey && event.key === 'l') {
        event.preventDefault()
        event.stopPropagation() // 阻止事件冒泡到全域處理器
        clearOutput()
        
      } else if (event.ctrlKey && event.key === 'c') {
        event.preventDefault()
        event.stopPropagation() // 阻止事件冒泡
        // 模擬 Ctrl+C，發送中斷信號
        addOutputLine('info', '^C', currentTerminal.value.id)
        currentCommand.value = ''
        updateTerminalDisplay()
        
      } else if (event.ctrlKey && event.key === 't') {
        // Ctrl+T 在終端中應該創建新標籤頁，阻止瀏覽器默認行為
        event.preventDefault()
        event.stopPropagation()
        createNewTerminal()
        
      } else if (event.ctrlKey && event.key === 'w') {
        // Ctrl+W 在終端中應該關閉當前標籤頁，阻止瀏覽器關閉標籤頁
        event.preventDefault()
        event.stopPropagation()
        if (terminals.length > 1) {
          closeTerminal(activeTerminalId.value)
        }
        
      } else if (event.ctrlKey && event.key === ',') {
        // Ctrl+, 開啟設定面板
        event.preventDefault()
        event.stopPropagation()
        toggleSettings()
        
      } else if (event.ctrlKey && event.key === 'Tab') {
        // Ctrl+Tab 切換終端標籤頁，阻止瀏覽器標籤頁切換
        event.preventDefault()
        event.stopPropagation()
        const currentIndex = terminals.findIndex(t => t.id === activeTerminalId.value)
        const nextIndex = (currentIndex + 1) % terminals.length
        switchTerminal(terminals[nextIndex].id)
        
      } else if (event.ctrlKey && event.shiftKey && event.key === 'Tab') {
        // Ctrl+Shift+Tab 切換到上一個終端標籤頁
        event.preventDefault()
        event.stopPropagation()
        const currentIndex = terminals.findIndex(t => t.id === activeTerminalId.value)
        const prevIndex = currentIndex === 0 ? terminals.length - 1 : currentIndex - 1
        switchTerminal(terminals[prevIndex].id)
        
      } else if (event.ctrlKey && event.key === 'd') {
        // Ctrl+D 模擬 EOF
        event.preventDefault()
        event.stopPropagation()
        if (currentCommand.value.trim() === '') {
          addOutputLine('info', 'exit', currentTerminal.value.id)
          updateTerminalDisplay()
        }
        
      } else if (event.ctrlKey && event.key === 'u') {
        // Ctrl+U 清除當前行（從光標到行首）
        event.preventDefault()
        event.stopPropagation()
        const textarea = terminalTextarea.value
        const lines = content.split('\n')
        const lastLine = lines[lines.length - 1] || ''
        const promptMatch = lastLine.match(/.*[$#%>]\s*/)
        const promptLength = promptMatch ? promptMatch[0].length : 0
        
        // 重建最後一行，只保留提示符
        lines[lines.length - 1] = lastLine.substring(0, promptLength)
        textarea.value = lines.join('\n')
        textarea.setSelectionRange(textarea.value.length, textarea.value.length)
        currentCommand.value = ''
        
      } else if (event.ctrlKey && event.key === 'k') {
        // Ctrl+K 清除從光標到行尾的內容
        event.preventDefault()
        event.stopPropagation()
        const textarea = terminalTextarea.value
        const cursorPos = textarea.selectionStart
        const lines = content.split('\n')
        const lastLine = lines[lines.length - 1] || ''
        const lineStart = content.lastIndexOf(lastLine)
        
        if (cursorPos >= lineStart) {
          const newContent = content.substring(0, cursorPos)
          textarea.value = newContent
          textarea.setSelectionRange(cursorPos, cursorPos)
          
          // 更新 currentCommand
          const promptMatch = lastLine.match(/.*[$#%>]\s*/)
          const promptLength = promptMatch ? promptMatch[0].length : 0
          const relativePos = cursorPos - lineStart
          if (relativePos >= promptLength) {
            currentCommand.value = lastLine.substring(promptLength, relativePos)
          }
        }
        
      } else if (event.key === 'Home') {
        // Home 鍵：移動到可編輯區域的開始
        event.preventDefault()
        textarea.setSelectionRange(editableStartPos, editableStartPos)
        
      } else if (event.key === 'End') {
        // End 鍵：移動到行尾
        event.preventDefault()
        textarea.setSelectionRange(content.length, content.length)
        
      } else if (event.ctrlKey && event.key === 'Home') {
        // Ctrl+Home：移動到可編輯區域的開始
        event.preventDefault()
        textarea.setSelectionRange(editableStartPos, editableStartPos)
        
      } else if (event.ctrlKey && event.key === 'End') {
        // Ctrl+End：移動到文檔末尾
        event.preventDefault()
        textarea.setSelectionRange(content.length, content.length)
        
      }
    }
    
    // 命令歷史導航
    const navigateHistory = (direction) => {
      const terminal = currentTerminal.value
      if (!terminal || !terminal.commandHistory || terminal.commandHistory.length === 0) return
      
      if (direction === -1) { // 上一個命令
        if (commandHistoryIndex.value === -1) {
          commandHistoryIndex.value = terminal.commandHistory.length - 1
        } else if (commandHistoryIndex.value > 0) {
          commandHistoryIndex.value--
        }
      } else { // 下一個命令
        if (commandHistoryIndex.value < terminal.commandHistory.length - 1) {
          commandHistoryIndex.value++
        } else {
          commandHistoryIndex.value = -1
          currentCommand.value = ''
          updateTerminalDisplay()
          return
        }
      }
      
      if (commandHistoryIndex.value >= 0) {
        currentCommand.value = terminal.commandHistory[commandHistoryIndex.value]
        updateTerminalDisplay()
      }
    }
    
    // 處理點擊事件
    const handleTerminalClick = (event) => {
      if (!terminalTextarea.value) return
      
      const textarea = terminalTextarea.value
      const content = textarea.value
      const lines = content.split('\n')
      const lastLine = lines[lines.length - 1] || ''
      
      // 找到最後一個真實的提示符位置
      const promptMatch = lastLine.match(/.*[$#%>]\s*/)
      const editableStartPos = promptMatch ? 
        content.lastIndexOf(lastLine) + promptMatch[0].length : 
        content.length
      
      // 使用 nextTick 來確保在 DOM 更新後檢查
      nextTick(() => {
        // 檢查用戶是否正在進行選取操作
        const hasSelection = textarea.selectionStart !== textarea.selectionEnd
        const isCurrentlySelecting = isMouseSelecting.value
        const timeSinceMouseDown = Date.now() - selectionStartTime.value
        
        // 如果用戶正在選取文字或剛完成選取操作，不要干擾
        if (hasSelection || isCurrentlySelecting || timeSinceMouseDown < 100) {
          return
        }
        
        // 如果單純點擊在提示符之前的區域，才將光標移到可編輯區域
        if (textarea.selectionStart < editableStartPos) {
          textarea.setSelectionRange(editableStartPos, editableStartPos)
        }
      })
    }
    
    // 滑鼠選取相關的狀態
    const isMouseSelecting = ref(false)
    const selectionStartTime = ref(0)
    
    // 處理滑鼠按下事件
    const handleMouseDown = (event) => {
      isMouseSelecting.value = true
      selectionStartTime.value = Date.now()
    }
    
    // 處理滑鼠釋放事件
    const handleMouseUp = (event) => {
      // 給一個小延遲來確保選取操作完成
      setTimeout(() => {
        isMouseSelecting.value = false
      }, 10)
    }
    
    // 處理文字選取事件
    const handleTextSelect = (event) => {
      // 這個事件會在選取改變時觸發
      // 不需要特別處理，只是為了標記有選取操作發生
    }
    
    // 將光標定位到末尾（用於其他地方調用）
    const focusToEnd = () => {
      ensureCursorAtBottom()
    }
    
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
        workingDirectory: '',  // 默認工作目錄
        isReady: false  // 持久化終端是否就緒
      }
      
      terminals.push(terminal)
      return terminal
    }
    
    // 創建新終端標籤頁
    const createNewTerminal = () => {
      const newTerminal = createTerminal()
      switchTerminal(newTerminal.id)
      
      // 如果已連接，為新終端創建持久化連線
      if (isConnected.value && ws) {
        // 請求服務器創建持久化終端
        ws.send(JSON.stringify({
          type: 'create_terminal',
          terminalId: newTerminal.id
        }))
      }
      
      // 更新終端顯示並聚焦
      nextTick(() => {
        updateTerminalDisplay()
        if (terminalTextarea.value) {
          terminalTextarea.value.focus()
          focusToEnd()
        }
      })
    }
    
    // 切換終端
    const switchTerminal = (terminalId) => {
      activeTerminalId.value = terminalId
      
      // 更新終端顯示並聚焦
      nextTick(() => {
        updateTerminalDisplay()
        if (terminalTextarea.value) {
          terminalTextarea.value.focus()
          focusToEnd()
        }
      })
    }
    
    // 關閉終端
    const closeTerminal = (terminalId) => {
      if (terminals.length <= 1) return // 至少保留一個終端
      
      const terminalIndex = terminals.findIndex(t => t.id === terminalId)
      if (terminalIndex === -1) return
      
      // 通知服務器關閉持久化終端
      if (isConnected.value && ws) {
        ws.send(JSON.stringify({
          type: 'close_terminal',
          terminalId: terminalId
        }))
      }
      
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
      if (!currentTerminal.value) return ''
      
      // 獲取當前目錄
      const currentDir = currentTerminal.value.workingDirectory || ''
      
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
      
      // 初始化終端顯示
      nextTick(() => {
        updateTerminalDisplay()
      })
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
        
        // 為所有終端創建持久化連線
        terminals.forEach(terminal => {
          ws.send(JSON.stringify({
            type: 'create_terminal',
            terminalId: terminal.id
          }))
        })
      }
      
      ws.onclose = () => {
        isConnected.value = false
        connectionStatus.value = '連接已斷開'
        
        // 自動重連（移除訊息顯示）
        setTimeout(() => {
          if (!isConnected.value) {
            connect()
          }
        }, 3000)
      }
      
      ws.onerror = (error) => {
        // 移除錯誤訊息顯示，讓終端更乾淨
        console.error('WebSocket 連接錯誤:', error)
      }
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleServerMessage(message)
        } catch (error) {
          // 移除無效訊息的顯示，記錄到控制台即可
          console.error('收到無效的服務器消息:', error)
        }
      }
    }
    
    // 處理服務器消息
    const handleServerMessage = (message) => {
      const { type, data, processes: serverProcesses, terminalId } = message
      
      switch (type) {
        case 'info':
        case 'error':
        case 'stdout':
        case 'stderr':
        case 'close':
          // 將訊息添加到指定終端或當前活躍終端
          const targetTerminalId = terminalId || message.terminalId || activeTerminalId.value
          addOutputLine(type, message.message || data || '無消息內容', targetTerminalId, message.processId)
          break
          
        case 'terminal_ready':
          handleTerminalReady(message)
          break
          
        case 'terminal_closed':
          handleTerminalClosed(message)
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
      
      // 檢查是否為重複的命令回顯
      if (type === 'stdout' && message.trim()) {
        const recentLines = terminal.outputLines.slice(-3) // 檢查最近3行
        const duplicateFound = recentLines.some(line => 
          line.type === 'stdout' && 
          line.message.trim() === message.trim() &&
          (new Date() - line.timestamp) < 1000 // 1秒內的重複
        )
        
        if (duplicateFound) {
          return // 跳過重複的命令回顯
        }
      }
      
      // 處理多行輸出：如果是 stdout 或 stderr，並且包含換行符，則分別處理每一行
      if ((type === 'stdout' || type === 'stderr') && typeof message === 'string' && message.includes('\n')) {
        const lines = message.split('\n')
        const baseTimestamp = new Date()
        
        // 調試：檢查是否有長行被截斷
        if (type === 'stdout') {
          const longLines = lines.filter(line => line.length > 100)
          if (longLines.length > 0) {
            console.log('檢測到長行:', longLines.map(line => `長度: ${line.length}, 內容: ${line.substring(0, 50)}...`))
          }
        }
        
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
      
      // 限制輸出行數，避免記憶體過度使用
      if (terminal.outputLines.length > settings.maxOutputLines) {
        terminal.outputLines.splice(0, terminal.outputLines.length - settings.maxOutputLines)
      }
      
      // 如果是當前活躍終端，更新終端顯示並確保游標在底部
      if (targetTerminalId === activeTerminalId.value) {
        updateTerminalDisplay()
        // 延遲確保游標在底部，給 DOM 更新時間
        nextTick(() => {
          ensureCursorAtBottom()
        })
      }
    }
    
    // 處理終端就緒事件
    const handleTerminalReady = (message) => {
      const { terminalId, workingDirectory } = message
      const terminal = terminals.find(t => t.id === terminalId)
      
      if (terminal) {
        terminal.isReady = true
        if (workingDirectory) {
          terminal.workingDirectory = workingDirectory
        }
        // 移除就緒訊息，讓終端更乾淨
      }
    }
    
    // 處理終端關閉事件
    const handleTerminalClosed = (message) => {
      const { terminalId } = message
      const terminal = terminals.find(t => t.id === terminalId)
      
      if (terminal) {
        terminal.isReady = false
        // 移除關閉訊息，讓終端更乾淨
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
        showSystemMessages: false,
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
      
      const command = currentCommand.value.trim()
      
      if (!command || !isConnected.value) return
      
      // 檢查終端是否就緒
      if (!terminal.isReady) {
        addOutputLine('error', '⚠️ 終端未就緒，請稍候再試', terminal.id)
        return
      }
      
      // 添加到當前終端的命令歷史
      if (terminal.commandHistory[terminal.commandHistory.length - 1] !== command) {
        terminal.commandHistory.push(command)
        if (terminal.commandHistory.length > settings.maxHistorySize) {
          terminal.commandHistory.shift()
        }
      }
      commandHistoryIndex.value = -1
      
      // 發送命令到服務器
      ws.send(JSON.stringify({
        type: 'execute',
        command: command,
        terminalId: terminal.id,
        options: {
          optimizeInteractiveCommands: settings.optimizeInteractiveCommands
        }
      }))
      
      // 清空當前命令
      currentCommand.value = ''
      
      // 更新顯示並確保游標在底部
      updateTerminalDisplay()
      nextTick(() => {
        ensureCursorAtBottom()
      })
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
    
    // 移除 ANSI 轉義序列的專用函數
    const stripAnsiEscapes = (text) => {
      return text
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // 標準 ANSI 序列 (CSI)
        .replace(/\x1b\[[?!><][0-9;]*[a-zA-Z]/g, '') // 私有模式序列（如 [?2004h）
        .replace(/\x1b\][^\x07]*\x07/g, '') // OSC 序列以 BEL 結尾
        .replace(/\x1b\][^\x1b]*\x1b\\/g, '') // OSC 序列以 ST 結尾
        .replace(/\x1b[PX^_][^\x1b]*\x1b\\/g, '') // DCS, SOS, PM, APC 序列
        .replace(/\x1b[c-z]/g, '') // 單字符轉義序列
        .replace(/\x1b[NO]/g, '') // SS2, SS3 序列
        .replace(/\r/g, '') // 移除回車符
    }

    // 格式化輸出內容
    const formatOutput = (message) => {
      // 首先移除 ANSI 轉義序列
      const cleanMessage = stripAnsiEscapes(message)

      // 基本的 HTML 轉義並保持換行
      return cleanMessage
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/ {2,}/g, (match) => '&nbsp;'.repeat(match.length))
    }
    
    // 鍵盤快捷鍵
    const handleKeydown = (event) => {
      // 檢查當前 focus 的元素
      const activeElement = document.activeElement
      const isTextareaFocused = activeElement && activeElement.tagName === 'TEXTAREA'
      const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')
      
      // 如果在輸入框或選擇框中，只處理特定的快捷鍵
      if (isInputFocused) {
        // 在輸入框中，只允許 Escape 鍵來關閉設定面板
        if (event.key === 'Escape' && showSettings.value) {
          event.preventDefault()
          event.stopPropagation()
          toggleSettings()
        }
        return
      }
      
      // 處理 textarea 中的快捷鍵（需要更積極地阻止瀏覽器默認行為）
      if (isTextareaFocused) {
        // Ctrl+L: 清除當前終端輸出
        if (event.ctrlKey && event.key === 'l') {
          event.preventDefault()
          event.stopPropagation()
          clearOutput()
          return
        }
        
        // Ctrl+T: 創建新終端標籤頁
        if (event.ctrlKey && event.key === 't') {
          event.preventDefault()
          event.stopPropagation()
          createNewTerminal()
          return
        }
        
        // Ctrl+,: 開啟設定面板
        if (event.ctrlKey && event.key === ',') {
          event.preventDefault()
          event.stopPropagation()
          toggleSettings()
          return
        }
        
        // Ctrl+W: 關閉當前終端標籤頁（但不是瀏覽器標籤頁）
        if (event.ctrlKey && event.key === 'w') {
          event.preventDefault()
          event.stopPropagation()
          closeTerminal(activeTerminalId.value)
          return
        }
        
        // Ctrl+Tab: 切換到下一個終端標籤頁
        if (event.ctrlKey && event.key === 'Tab' && !event.shiftKey) {
          event.preventDefault()
          event.stopPropagation()
          const currentIndex = terminals.findIndex(t => t.id === activeTerminalId.value)
          const nextIndex = (currentIndex + 1) % terminals.length
          switchTerminal(terminals[nextIndex].id)
          return
        }
        
        // Ctrl+Shift+Tab: 切換到上一個終端標籤頁
        if (event.ctrlKey && event.shiftKey && event.key === 'Tab') {
          event.preventDefault()
          event.stopPropagation()
          const currentIndex = terminals.findIndex(t => t.id === activeTerminalId.value)
          const prevIndex = currentIndex === 0 ? terminals.length - 1 : currentIndex - 1
          switchTerminal(terminals[prevIndex].id)
          return
        }
        
        // 其他情況下，讓 textarea 自己處理按鍵
        return
      }
      
      // 非輸入元素的快捷鍵處理
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
      
      // Escape: 關閉設定面板
      if (event.key === 'Escape' && showSettings.value) {
        event.preventDefault()
        toggleSettings()
      }
    }
    
    // 計算合適的終端大小
    const calculateTerminalSize = () => {
      if (!terminalTextarea.value) return { cols: 140, rows: 30 }
      
      const textarea = terminalTextarea.value
      const styles = window.getComputedStyle(textarea)
      const fontSize = parseFloat(styles.fontSize)
      const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.4
      
      // 計算字符寬度 (大約是字體大小的 0.6 倍)
      const charWidth = fontSize * 0.6
      
      // 獲取可用空間
      const availableWidth = textarea.clientWidth - 30 // 減去 padding
      const availableHeight = textarea.clientHeight - 30 // 減去 padding
      
      // 計算列數和行數
      const cols = Math.floor(availableWidth / charWidth)
      const rows = Math.floor(availableHeight / lineHeight)
      
      return {
        cols: Math.max(80, Math.min(cols, 200)), // 限制在 80-200 之間
        rows: Math.max(24, Math.min(rows, 50))   // 限制在 24-50 之間
      }
    }
    
    // 調整終端大小
    const resizeTerminal = (terminalId = null) => {
      if (!ws || !isConnected.value) return
      
      const size = calculateTerminalSize()
      const targetTerminalId = terminalId || activeTerminalId.value
      
      ws.send(JSON.stringify({
        type: 'resize',
        terminalId: targetTerminalId,
        cols: size.cols,
        rows: size.rows
      }))
    }
    
    // 處理視窗大小改變
    const handleWindowResize = () => {
      // 延遲調整，避免頻繁調用
      clearTimeout(resizeTimeout.value)
      resizeTimeout.value = setTimeout(() => {
        resizeTerminal()
      }, 300)
    }
    
    const resizeTimeout = ref(null)
    
    // 生命週期
    onMounted(() => {
      // 載入設定
      loadSettings()
      
      // 初始化終端
      initializeTerminals()
      
      // 連接 WebSocket
      connect()
      
      // 使用 capture 模式來確保我們的處理器在其他處理器之前執行
      document.addEventListener('keydown', handleKeydown, { capture: true })
      
      // 監聽視窗大小改變
      window.addEventListener('resize', handleWindowResize)
      
      // 初始調整終端大小
      nextTick(() => {
        setTimeout(() => {
          resizeTerminal()
        }, 1000) // 等待 WebSocket 連接穩定
      })
    })
    
    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeydown, { capture: true })
      window.removeEventListener('resize', handleWindowResize)
      if (resizeTimeout.value) {
        clearTimeout(resizeTimeout.value)
      }
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
      showSettings,
      settings,
      pausedProcess,
      customResponse,
      systemInfo,
      
      // 終端顯示
      terminalDisplay,
      terminalTextarea,
      terminalContainer,
      
      // 方法
      executeCommand,
      clearOutput,
      handleTerminalKeydown,
      handleTerminalClick,
      handleMouseDown,
      handleMouseUp,
      handleTextSelect,
      focusToEnd,
      ensureCursorAtBottom,
      updateTerminalDisplay,
      formatTime,
      getPromptText,
      resizeTerminal,
      calculateTerminalSize,
      
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