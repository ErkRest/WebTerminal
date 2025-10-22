<template>
  <div id="app">
    <!-- 身份驗證對話框 -->
    <div v-if="showAuthDialog" class="auth-overlay">
      <div class="auth-dialog">
        <h3>身份驗證</h3>
        <p>請輸入伺服器提供的密鑰以連接到終端服務</p>
        <div class="auth-input-group">
          <input 
            v-model="authKey" 
            type="text" 
            placeholder="請輸入密鑰 (格式: XXXX-XXXX-XXXX-XXXX)"
            class="auth-input"
            @keyup.enter="authenticate"
            ref="authInput"
          />
          <button @click="authenticate" :disabled="!authKey.trim()" class="auth-btn">
            驗證
          </button>
        </div>
        <div v-if="authError" class="auth-error">
          {{ authError }}
        </div>
      </div>
    </div>

    <!-- 頂部工具欄 -->
    <div class="top-toolbar">
      <!-- 左側：連接狀態和控制 -->
      <div class="left-controls">
        <!-- 連接狀態按鈕 -->
        <button 
          @click="isConnected ? disconnectTerminal() : connectTerminal()" 
          class="connection-status-btn"
          :class="{ 'connected': isConnected, 'disconnected': !isConnected, 'connecting': connectionStatus === 'connecting' }"
          :title="isConnected ? '點擊斷開連接' : '點擊連接終端'"
        >
          <span :class="['status-indicator', connectionStatus]"></span>
          <span class="status-text">{{ connectionText }}</span>
        </button>
      </div>

      <!-- 中間：系統狀態資訊 -->
      <div class="server-info" v-if="isConnected">
        <!-- <span class="info-item" title="當前工作目錄">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H5C3.89543 7 3 7.89543 3 9V7Z" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M3 7L10 7C10 5.89543 10.8954 5 12 5H19C20.1046 5 21 5.89543 21 7" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
          {{ currentWorkingDir }}
        </span> -->
        <span class="info-item" title="活躍終端數">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M6 8l4 4-4 4M12 16h6" stroke="currentColor" stroke-width="2"/>
          </svg>
          {{ tabs.length }} 個終端
        </span>
        <span class="info-item" title="系統平台">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M12 2C13.5 4 16 7 16 12C16 17 13.5 20 12 22C10.5 20 8 17 8 12C8 7 10.5 4 12 2Z" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
          {{ systemInfo.platform }}
        </span>
        <span class="info-item" title="主機名稱" v-if="systemInfo.hostname && systemInfo.hostname !== 'Unknown'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="currentColor" stroke-width="2" fill="none"/>
            <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="2"/>
            <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2"/>
          </svg>
          {{ systemInfo.hostname }}
        </span>
        <span class="info-item" title="Node.js 版本" v-if="systemInfo.nodeVersion && systemInfo.nodeVersion !== 'Unknown'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
          {{ systemInfo.nodeVersion }}
        </span>
        <span class="info-item" title="CPU 資訊" v-if="systemInfo.cpuUsage && systemInfo.cpuUsage.cores">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
            <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>
            <line x1="9" y1="1" x2="9" y2="4" stroke="currentColor" stroke-width="2"/>
            <line x1="15" y1="1" x2="15" y2="4" stroke="currentColor" stroke-width="2"/>
            <line x1="9" y1="20" x2="9" y2="23" stroke="currentColor" stroke-width="2"/>
            <line x1="15" y1="20" x2="15" y2="23" stroke="currentColor" stroke-width="2"/>
            <line x1="20" y1="9" x2="23" y2="9" stroke="currentColor" stroke-width="2"/>
            <line x1="20" y1="14" x2="23" y2="14" stroke="currentColor" stroke-width="2"/>
            <line x1="1" y1="9" x2="4" y2="9" stroke="currentColor" stroke-width="2"/>
            <line x1="1" y1="14" x2="4" y2="14" stroke="currentColor" stroke-width="2"/>
          </svg>
          {{ systemInfo.cpuUsage.cores }} 核心
        </span>
        <span class="info-item" title="記憶體使用量" v-if="systemInfo.memoryUsage">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="18" height="2" rx="1" fill="currentColor"/>
            <rect x="3" y="8" width="18" height="2" rx="1" fill="currentColor"/>
            <rect x="3" y="12" width="18" height="2" rx="1" fill="currentColor"/>
            <rect x="3" y="16" width="18" height="2" rx="1" fill="currentColor"/>
          </svg>
          {{ formatMemoryUsage(systemInfo.memoryUsage) }}
        </span>
        <span class="info-item" title="連接數 / 活躍終端">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" stroke-width="2" fill="none"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M12 11h4" stroke="currentColor" stroke-width="2"/>
            <path d="M12 16h4" stroke="currentColor" stroke-width="2"/>
          </svg>
          {{ systemInfo.totalConnections }} / {{ systemInfo.activeTerminals }}
        </span>
        <!-- <span class="info-item" title="服務器運行時間">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
            <polyline points="12,6 12,12 16,14" stroke="currentColor" stroke-width="2"/>
          </svg>
          {{ formatUptime(serverStats.serverUptime) }}
        </span> -->
      </div>

      <!-- 右側：設定按鈕 -->
      <div class="right-controls">
        <button 
          @click="toggleSettings" 
          class="settings-btn"
          title="設定"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="5" r="2" fill="currentColor"/>
            <circle cx="12" cy="12" r="2" fill="currentColor"/>
            <circle cx="12" cy="19" r="2" fill="currentColor"/>
          </svg>
        </button>
      </div>
    
    </div>

    <!-- 分頁條 -->
    <div class="tabs-bar" v-if="isConnected">
      <!-- 新增終端按鈕 -->
      <button 
        @click="createNewTab" 
        :disabled="!isConnected"
        class="new-tab-btn"
        title="新建終端"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      
      <div class="tabs-container">
        <div 
          v-for="tab in tabs" 
          :key="tab.id"
          class="tab"
          :class="{ 'active': tab.isActive }"
          @click="switchToTab(tab.id)"
        >
          <span class="tab-name">{{ tab.name }}</span>
          <button 
            class="tab-close"
            @click.stop="closeTab(tab.id)"
            :title="`關閉 ${tab.name}`"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <!-- 主要終端區域 -->
    <WebTerminal 
      ref="terminalRef"
      :socket="socket"
      :is-connected="isConnected"
      :active-tab-id="activeTabId"
      @resize="handleTerminalResize"
    />
    
    <!-- 服務器統計信息浮動窗口 -->
    <div v-if="serverStats.visible" class="stats-overlay" @click="serverStats.visible = false">
      <div class="server-stats" @click.stop>
        <div class="stats-header">
          <h3>服務器統計信息</h3>
          <button @click="serverStats.visible = false" class="close-btn">&times;</button>
        </div>
        
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">總連接數:</span>
            <span class="stat-value">{{ serverStats.totalConnections }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">服務器運行時間:</span>
            <span class="stat-value">{{ formatUptime(serverStats.serverUptime) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Node.js 版本:</span>
            <span class="stat-value">{{ serverStats.nodeVersion }}</span>
          </div>
        </div>
        
        <h4>已連接的客戶端</h4>
        <div class="clients-list">
          <div 
            v-for="client in serverStats.connectedClients" 
            :key="client.socketId"
            class="client-item"
          >
            <div class="client-info">
              <span class="client-ip">{{ client.clientIP }}</span>
              <span class="client-id">ID: {{ client.socketId.substring(0, 8) }}...</span>
              <span class="client-pid">PID: {{ client.pid }}</span>
            </div>
            <div class="client-agent">{{ client.userAgent }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 設定面板 -->
    <div v-if="showSettings" class="settings-overlay" @click="closeSettings">
      <div class="settings-panel" @click.stop>
        <div class="settings-header">
          <h3>系統設定</h3>
          <button @click="closeSettings" class="close-btn">✕</button>
        </div>
        
        <div class="settings-content">
          <!-- 介面設定 -->
          <div class="settings-section">
            <h4>介面設定</h4>
            
            <div class="setting-item">
              <label class="setting-label">
                <span class="setting-text">主題</span>
                <select v-model="uiSettings.theme" class="setting-select">
                  <option value="dark">深色主題</option>
                  <option value="light">淺色主題</option>
                  <option value="auto">自動</option>
                </select>
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <span class="setting-text">字體大小</span>
                <select v-model="uiSettings.fontSize" class="setting-select">
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
                <input
                  type="checkbox"
                  v-model="uiSettings.showTimestamps"
                  class="setting-checkbox"
                />
                <span class="setting-text">顯示時間戳</span>
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="uiSettings.autoScroll"
                  class="setting-checkbox"
                />
                <span class="setting-text">自動滾動</span>
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <span class="setting-text">最大輸出行數</span>
                <input 
                  type="number" 
                  v-model="uiSettings.maxOutputLines"
                  class="setting-input"
                  min="100"
                  max="5000"
                  step="100"
                />
              </label>
            </div>
          </div>

          <!-- 連線設定 -->
          <div class="settings-section">
            <h4>連線設定</h4>
            
            <div class="setting-item">
              <label class="setting-label">
                <span class="setting-text">服務器地址</span>
                <input 
                  type="text" 
                  v-model="connectionSettings.serverUrl"
                  class="setting-input"
                  placeholder="ws://localhost:3000"
                />
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <span class="setting-text">重連間隔 (秒)</span>
                <input 
                  type="number" 
                  v-model="connectionSettings.reconnectInterval"
                  class="setting-input"
                  min="1"
                  max="60"
                />
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <span class="setting-text">最大重連次數</span>
                <input 
                  type="number" 
                  v-model="connectionSettings.maxReconnectAttempts"
                  class="setting-input"
                  min="0"
                  max="100"
                />
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="connectionSettings.autoConnect"
                  class="setting-checkbox"
                />
                <span class="setting-text">啟動時自動連接</span>
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="connectionSettings.autoReconnect"
                  class="setting-checkbox"
                />
                <span class="setting-text">自動重新連接</span>
              </label>
            </div>
          </div>

          <!-- 終端設定 -->
          <div class="settings-section">
            <h4>終端設定</h4>
            
            <div class="setting-item">
              <label class="setting-label">
                <span class="setting-text">命令歷史記錄數量</span>
                <input 
                  type="number" 
                  v-model="terminalSettings.historySize"
                  class="setting-input"
                  min="10"
                  max="500"
                />
              </label>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <input
                  type="checkbox"
                  v-model="terminalSettings.persistentSessions"
                  class="setting-checkbox"
                />
                <span class="setting-text">持久化終端會話</span>
              </label>
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
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { io } from 'socket.io-client'
import WebTerminal from './components/WebTerminal.vue'

export default {
  name: 'App',
  components: {
    WebTerminal
  },
  setup() {
    const socket = ref(null)
    const isConnected = ref(false)
    const connectionStatus = ref('disconnected')
    const terminalRef = ref(null)
    
    // 身份驗證相關狀態
    const showAuthDialog = ref(false)
    const authKey = ref('')
    const authError = ref('')
    const isAuthenticated = ref(false)
    const authInput = ref(null)
    
    // 終端分頁管理
    const tabs = ref([])
    const activeTabId = ref(null)
    let tabIdCounter = 0
    
    const terminalInfo = reactive({
      pid: null,
      shell: null,
      platform: null,
      arch: null,
      clientIP: null,
      socketId: null
    })

    const serverStats = reactive({
      totalConnections: 0,
      connectedClients: [],
      serverUptime: 0,
      platform: null,
      arch: null,
      nodeVersion: null,
      visible: false
    })

    // 系統資訊
    const systemInfo = reactive({
      platform: 'Unknown',
      arch: 'Unknown',
      memoryUsage: null,
      cpuUsage: null,
      nodeVersion: 'Unknown',
      hostname: 'Unknown',
      activeTerminals: 0,
      totalConnections: 0
    })

    // 當前工作目錄（從活躍終端獲取）
    const currentWorkingDir = computed(() => {
      const activeTab = tabs.value.find(tab => tab.id === activeTabId.value)
      if (activeTab && activeTab.workingDirectory) {
        // 縮短路徑顯示
        const path = activeTab.workingDirectory
        if (path.length > 40) {
          const parts = path.split(/[/\\]/)
          if (parts.length > 3) {
            return `${parts[0]}${path.includes('\\') ? '\\' : '/'}...${path.includes('\\') ? '\\' : '/'}${parts[parts.length-1]}`
          }
        }
        return path
      }
      // 使用系統資訊中的平台資訊，或者根據路徑分隔符判斷
      const isWindows = systemInfo.platform === 'win32' || 
                       (systemInfo.platform === 'Unknown' && navigator.platform.includes('Win'))
      return isWindows ? 'C:\\' : '~'
    })

    // 設定面板狀態
    const showSettings = ref(false)
    
    // 系統狀態更新時間
    const lastStatsUpdate = ref(null)
    
    // 介面設定
    const uiSettings = reactive({
      theme: 'dark',
      fontSize: 14,
      showTimestamps: true,
      autoScroll: true,
      maxOutputLines: 1000
    })
    
    // 連線設定
    const connectionSettings = reactive({
      serverUrl: 'ws://localhost:3000',
      reconnectInterval: 3,
      maxReconnectAttempts: 10,
      autoConnect: true,
      autoReconnect: true
    })
    
    // 終端設定
    const terminalSettings = reactive({
      historySize: 100,
      persistentSessions: true
    })

    const connectionText = computed(() => {
      switch (connectionStatus.value) {
        case 'connected': return '已連接'
        case 'connecting': return '連接中...'
        case 'disconnected': return '未連接'
        case 'error': return '連接錯誤'
        default: return '未知狀態'
      }
    })

    // 連接到 WebSocket 服務器
    const connectToServer = () => {
      if (socket.value) return

      connectionStatus.value = 'connecting'
      
      // 使用設定中的服務器地址，如果是開發模式則使用代理
      const serverUrl = import.meta.env.DEV ? '/' : connectionSettings.serverUrl
      socket.value = io(serverUrl, {
        transports: ['websocket', 'polling']
      })

      // 連接成功
      socket.value.on('connect', () => {
        console.log('WebSocket 連接成功')
        connectionStatus.value = 'connected'
        isConnected.value = true
        
        // 顯示身份驗證對話框
        showAuthDialog.value = true
        
        // 聚焦到輸入框
        setTimeout(() => {
          if (authInput.value) {
            authInput.value.focus()
          }
        }, 100)
      })

      // 身份驗證成功
      socket.value.on('auth-success', (data) => {
        console.log('身份驗證成功:', data.message)
        isAuthenticated.value = true
        showAuthDialog.value = false
        authError.value = ''
        
        // 確保認證狀態完全同步後再創建終端
        setTimeout(() => {
          // 自動獲取服務器統計信息
          if (socket.value) {
            socket.value.emit('get-server-stats')
          }
          
          // 如果設定為自動創建終端，則創建第一個分頁
          if (tabs.value.length === 0) {
            createNewTab()
          }
        }, 200) // 給足夠的時間讓認證狀態同步
      })

      // 身份驗證失敗
      socket.value.on('auth-failed', (data) => {
        console.error('身份驗證失敗:', data.message)
        authError.value = data.message
        isAuthenticated.value = false
        authKey.value = ''
        
        // 重新聚焦到輸入框
        setTimeout(() => {
          if (authInput.value) {
            authInput.value.focus()
          }
        }, 100)
      })

      // 需要身份驗證
      socket.value.on('auth-required', (data) => {
        console.warn('需要身份驗證:', data.message)
        showAuthDialog.value = true
        isAuthenticated.value = false
        
        // 聚焦到輸入框
        setTimeout(() => {
          if (authInput.value) {
            authInput.value.focus()
          }
        }, 100)
      })

      // 連接錯誤
      socket.value.on('connect_error', (error) => {
        console.error('WebSocket 連接錯誤:', error)
        connectionStatus.value = 'error'
        isConnected.value = false
      })

      // 斷開連接
      socket.value.on('disconnect', () => {
        console.log('WebSocket 連接斷開')
        connectionStatus.value = 'disconnected'
        isConnected.value = false
      })

      // 終端創建成功
      socket.value.on('terminal-created', (data) => {
        console.log('終端創建成功:', data)
        
        // 更新對應分頁的信息
        if (data.terminalId) {
          const tab = tabs.value.find(tab => tab.id === data.terminalId)
          if (tab) {
            tab.pid = data.pid
            
            // 如果這是當前應該活動的分頁，確保正確切換
            if (tab.isActive) {
              // 通知 WebTerminal 組件切換到這個終端
              if (terminalRef.value) {
                terminalRef.value.switchTerminal(data.terminalId)
              }
            }
          }
          
          // 獲取終端詳細信息
          socket.value.emit('get-terminal-info', { terminalId: data.terminalId })
        }
      })

      // 終端信息
      socket.value.on('terminal-info', (data) => {
        console.log('終端信息:', data)
        Object.assign(terminalInfo, data)
      })

      // 終端錯誤
      socket.value.on('terminal-error', (data) => {
        console.error('終端錯誤:', data.message)
        alert(`終端錯誤: ${data.message}`)
      })

      // 終端退出
      socket.value.on('terminal-exit', (data) => {
        console.log('終端退出:', data)
        
        if (data.terminalId) {
          // 更新對應分頁的信息
          const tab = tabs.value.find(tab => tab.id === data.terminalId)
          if (tab) {
            tab.pid = null
          }
          
          // 可選：自動關閉已退出的分頁
          // closeTab(data.terminalId)
        }
      })

      // 服務器統計信息
      socket.value.on('server-stats', (data) => {
        console.log('服務器統計信息:', data)
        Object.assign(serverStats, data)
        
        // 記錄更新時間
        lastStatsUpdate.value = Date.now()
        
        // 更新系統資訊
        if (data.memoryUsage) {
          systemInfo.memoryUsage = data.memoryUsage
        }
        if (data.cpuInfo) {
          systemInfo.cpuUsage = data.cpuInfo
        }
        if (data.platform) {
          systemInfo.platform = data.platform
        }
        if (data.arch) {
          systemInfo.arch = data.arch
        }
        if (data.nodeVersion) {
          systemInfo.nodeVersion = data.nodeVersion
        }
        if (data.hostname) {
          systemInfo.hostname = data.hostname
        }
        if (typeof data.activeTerminals === 'number') {
          systemInfo.activeTerminals = data.activeTerminals
        }
        if (typeof data.totalConnections === 'number') {
          systemInfo.totalConnections = data.totalConnections
        }
      })
    }

    // 身份驗證方法
    const authenticate = () => {
      if (!authKey.value.trim()) return
      
      authError.value = ''
      
      if (socket.value) {
        socket.value.emit('authenticate', { key: authKey.value.trim() })
      }
    }

    // 連接終端
    const connectTerminal = () => {
      if (!socket.value || !isConnected.value) {
        connectToServer()
        return
      }

      // 如果沒有驗證，顯示驗證對話框
      if (!isAuthenticated.value) {
        showAuthDialog.value = true
        // 聚焦到輸入框
        setTimeout(() => {
          if (authInput.value) {
            authInput.value.focus()
          }
        }, 100)
        return
      }

      // 如果沒有分頁，創建第一個分頁
      if (tabs.value.length === 0) {
        createNewTab()
      }
    }

    // 斷開終端連接
    const disconnectTerminal = () => {
      if (socket.value) {
        socket.value.disconnect()
        socket.value = null
        isConnected.value = false
        connectionStatus.value = 'disconnected'
        isAuthenticated.value = false
        showAuthDialog.value = false
        authKey.value = ''
        authError.value = ''
        terminalInfo.pid = null
      }
    }

    // 設定管理方法
    const toggleSettings = () => {
      showSettings.value = !showSettings.value
    }

    const closeSettings = () => {
      showSettings.value = false
    }

    const saveSettings = () => {
      try {
        // 儲存到 localStorage
        localStorage.setItem('uiSettings', JSON.stringify(uiSettings))
        localStorage.setItem('connectionSettings', JSON.stringify(connectionSettings))
        localStorage.setItem('terminalSettings', JSON.stringify(terminalSettings))
        
        // 應用設定
        applySettings()
        
        // 顯示成功訊息（如果需要的話）
        console.log('設定已儲存')
        
        closeSettings()
      } catch (error) {
        console.error('儲存設定失敗:', error)
        alert('儲存設定失敗，請稍後再試')
      }
    }

    const resetSettings = () => {
      if (confirm('確定要重設所有設定為預設值嗎？')) {
        // 重設為預設值
        Object.assign(uiSettings, {
          theme: 'dark',
          fontSize: 14,
          showTimestamps: true,
          autoScroll: true,
          maxOutputLines: 1000
        })
        
        Object.assign(connectionSettings, {
          serverUrl: 'ws://localhost:3000',
          reconnectInterval: 3,
          maxReconnectAttempts: 10,
          autoConnect: true,
          autoReconnect: true
        })
        
        Object.assign(terminalSettings, {
          historySize: 100,
          persistentSessions: true
        })
        
        // 清除 localStorage
        localStorage.removeItem('uiSettings')
        localStorage.removeItem('connectionSettings')
        localStorage.removeItem('terminalSettings')
        
        applySettings()
        console.log('設定已重設為預設值')
      }
    }

    const loadSettings = () => {
      try {
        // 從 localStorage 載入設定
        const savedUiSettings = localStorage.getItem('uiSettings')
        if (savedUiSettings) {
          Object.assign(uiSettings, JSON.parse(savedUiSettings))
        }
        
        const savedConnectionSettings = localStorage.getItem('connectionSettings')
        if (savedConnectionSettings) {
          Object.assign(connectionSettings, JSON.parse(savedConnectionSettings))
        }
        
        const savedTerminalSettings = localStorage.getItem('terminalSettings')
        if (savedTerminalSettings) {
          Object.assign(terminalSettings, JSON.parse(savedTerminalSettings))
        }
        
        applySettings()
      } catch (error) {
        console.error('載入設定失敗:', error)
      }
    }

    const applySettings = () => {
      // 應用主題設定
      if (uiSettings.theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light')
      } else if (uiSettings.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark')
      } else {
        // 自動模式
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
      }
      
      // 應用字體大小
      document.documentElement.style.setProperty('--terminal-font-size', `${uiSettings.fontSize}px`)
    }

    // 清空終端
    const clearTerminal = () => {
      if (terminalRef.value && activeTabId.value) {
        terminalRef.value.clearTerminal(activeTabId.value)
      }
    }

    // 獲取服務器統計信息
    const getServerStats = () => {
      if (socket.value && isConnected.value) {
        socket.value.emit('get-server-stats')
      }
    }

    // 格式化運行時間
    const formatUptime = (seconds) => {
      if (!seconds) return '0s'
      
      const days = Math.floor(seconds / 86400)
      const hours = Math.floor((seconds % 86400) / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = Math.floor(seconds % 60)
      
      const parts = []
      if (days > 0) parts.push(`${days}天`)
      if (hours > 0) parts.push(`${hours}時`)
      if (minutes > 0) parts.push(`${minutes}分`)
      if (secs > 0) parts.push(`${secs}秒`)
      
      return parts.join(' ') || '0秒'
    }

    // 格式化記憶體使用量
    const formatMemoryUsage = (memoryInfo) => {
      if (!memoryInfo) return 'N/A'
      
      const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
      }
      
      // 適應 Node.js process.memoryUsage() 格式
      if (memoryInfo.heapUsed && memoryInfo.heapTotal) {
        const usedPercent = ((memoryInfo.heapUsed / memoryInfo.heapTotal) * 100).toFixed(1)
        return `${formatBytes(memoryInfo.heapUsed)} / ${formatBytes(memoryInfo.heapTotal)} (${usedPercent}%)`
      }
      
      // 備用格式，適應其他記憶體資訊結構
      if (memoryInfo.used && memoryInfo.total) {
        const usedPercent = ((memoryInfo.used / memoryInfo.total) * 100).toFixed(1)
        return `${formatBytes(memoryInfo.used)} / ${formatBytes(memoryInfo.total)} (${usedPercent}%)`
      }
      
      return 'N/A'
    }

    // 格式化詳細記憶體資訊
    const formatDetailedMemory = (memoryInfo, type) => {
      if (!memoryInfo) return 'N/A'
      
      const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
      }
      
      switch (type) {
        case 'heap':
          return memoryInfo.heapUsed && memoryInfo.heapTotal 
            ? `${formatBytes(memoryInfo.heapUsed)} / ${formatBytes(memoryInfo.heapTotal)}`
            : 'N/A'
        case 'rss':
          return memoryInfo.rss ? formatBytes(memoryInfo.rss) : 'N/A'
        case 'external':
          return memoryInfo.external ? formatBytes(memoryInfo.external) : 'N/A'
        default:
          return 'N/A'
      }
    }

    // 格式化 CPU 負載平均
    const formatLoadAverage = (loadAvg) => {
      if (!Array.isArray(loadAvg) || loadAvg.length === 0) return 'N/A'
      return loadAvg.map(load => load.toFixed(2)).join(', ')
    }

    // 格式化時間
    const formatTime = (timestamp) => {
      if (!timestamp) return 'N/A'
      return new Date(timestamp).toLocaleTimeString()
    }

    // 處理終端尺寸變更
    const handleTerminalResize = ({ cols, rows, terminalId }) => {
      if (socket.value && isConnected.value && terminalId) {
        socket.value.emit('terminal-resize', { 
          cols, 
          rows,
          terminalId 
        })
      }
    }

    // 創建新的終端分頁
    const createNewTab = () => {
      if (!socket.value || !isConnected.value || !isAuthenticated.value) {
        console.warn('無法創建終端：連接或認證狀態不正確', {
          hasSocket: !!socket.value,
          isConnected: isConnected.value,
          isAuthenticated: isAuthenticated.value
        })
        if (!socket.value || !isConnected.value) {
          connectToServer()
        }
        return
      }

      const tabId = `tab-${++tabIdCounter}`
      const newTab = {
        id: tabId,
        name: `終端 ${tabIdCounter}`,
        pid: null,
        isActive: false
      }
      
      tabs.value.push(newTab)
      
      // 創建終端會話，等待伺服器確認後再切換
      const terminalSize = terminalRef.value?.getTerminalSize() || { cols: 80, rows: 24 }
      console.log(`發送創建終端請求: ${tabId}`, terminalSize)
      socket.value.emit('create-terminal', { 
        ...terminalSize, 
        terminalId: tabId 
      })
      
      // 標記為當前要切換到的分頁，但不立即切換
      // 等到 terminal-created 事件確認後再實際切換
      switchToTab(tabId)
    }

    // 切換到指定分頁
    const switchToTab = (tabId) => {
      // 更新分頁活動狀態
      tabs.value.forEach(tab => {
        tab.isActive = tab.id === tabId
      })
      
      const oldActiveTabId = activeTabId.value
      activeTabId.value = tabId
      
      console.log(`切換分頁: ${oldActiveTabId} -> ${tabId}`)
    }

    // 關閉分頁
    const closeTab = (tabId) => {
      const tabIndex = tabs.value.findIndex(tab => tab.id === tabId)
      if (tabIndex === -1) return

      console.log(`關閉分頁: ${tabId}`)

      // 通知服務器關閉終端
      if (socket.value) {
        socket.value.emit('close-terminal', { terminalId: tabId })
      }

      // 通知終端組件銷毀終端
      if (terminalRef.value) {
        terminalRef.value.destroyTerminal(tabId)
      }

      // 如果關閉的是當前活動分頁，需要切換到其他分頁
      if (tabId === activeTabId.value) {
        if (tabs.value.length > 1) {
          // 切換到前一個或後一個分頁
          const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : tabIndex + 1
          if (newActiveIndex < tabs.value.length) {
            switchToTab(tabs.value[newActiveIndex].id)
          }
        } else {
          activeTabId.value = null
        }
      }

      // 移除分頁
      tabs.value.splice(tabIndex, 1)
    }

    // 重命名分頁
    const renameTab = (tabId, newName) => {
      const tab = tabs.value.find(tab => tab.id === tabId)
      if (tab) {
        tab.name = newName
      }
    }

    // 系統狀態刷新定時器
    let statsTimer = null
    
    // 開始系統狀態自動刷新
    const startStatsRefresh = () => {
      if (statsTimer) {
        clearInterval(statsTimer)
      }
      
      // 每 10 秒更新一次系統狀態
      statsTimer = setInterval(() => {
        if (socket.value && isConnected.value && isAuthenticated.value) {
          socket.value.emit('get-server-stats')
        }
      }, 10000) // 10 秒
    }
    
    // 停止系統狀態自動刷新
    const stopStatsRefresh = () => {
      if (statsTimer) {
        clearInterval(statsTimer)
        statsTimer = null
      }
    }

    // 組件掛載時自動連接
    onMounted(() => {
      loadSettings()
      if (connectionSettings.autoConnect) {
        connectToServer()
      }
    })

    // 監聽連接狀態，連接成功後創建第一個分頁
    watch(isConnected, (connected) => {
      if (connected && tabs.value.length === 0) {
        createNewTab()
      }
    })
    
    // 監聽認證狀態，認證成功後開始狀態刷新
    watch(isAuthenticated, (authenticated) => {
      if (authenticated) {
        startStatsRefresh()
        // 立即獲取一次狀態
        if (socket.value) {
          socket.value.emit('get-server-stats')
        }
      } else {
        stopStatsRefresh()
      }
    })

    // 組件卸載時斷開連接
    onUnmounted(() => {
      stopStatsRefresh()
      disconnectTerminal()
    })

    return {
      socket,
      isConnected,
      connectionStatus,
      connectionText,
      terminalRef,
      terminalInfo,
      serverStats,
      systemInfo,
      currentWorkingDir,
      tabs,
      activeTabId,
      showSettings,
      uiSettings,
      connectionSettings,
      terminalSettings,
      // 身份驗證相關
      showAuthDialog,
      authKey,
      authError,
      isAuthenticated,
      authInput,
      authenticate,
      connectTerminal,
      disconnectTerminal,
      clearTerminal,
      getServerStats,
      formatUptime,
      formatMemoryUsage,
      handleTerminalResize,
      createNewTab,
      switchToTab,
      closeTab,
      renameTab,
      toggleSettings,
      closeSettings,
      saveSettings,
      resetSettings,
      // 系統狀態更新時間
      lastStatsUpdate,
      formatDetailedMemory,
      formatLoadAverage,
      formatTime
    }
  }
}
</script>

<style>
/* 覆蓋全局樣式 */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}

/* 身份驗證對話框樣式 */
.auth-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.auth-dialog {
  background: #1e1e1e;
  border: 1px solid #3e3e3e;
  border-radius: 8px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.auth-dialog h3 {
  margin: 0 0 12px 0;
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
}

.auth-dialog p {
  margin: 0 0 20px 0;
  color: #cccccc;
  font-size: 14px;
  line-height: 1.5;
}

.auth-input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.auth-input {
  flex: 1;
  background: #2d2d2d;
  border: 1px solid #4e4e4e;
  border-radius: 4px;
  padding: 10px 12px;
  color: #ffffff;
  font-size: 14px;
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
}

.auth-input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
}

.auth-input::placeholder {
  color: #888888;
}

.auth-btn {
  background: #007acc;
  border: none;
  border-radius: 4px;
  padding: 10px 16px;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.auth-btn:hover:not(:disabled) {
  background: #005a9e;
}

.auth-btn:disabled {
  background: #4e4e4e;
  cursor: not-allowed;
  opacity: 0.6;
}

.auth-error {
  color: #f48771;
  font-size: 12px;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(244, 135, 113, 0.1);
  border: 1px solid rgba(244, 135, 113, 0.3);
  border-radius: 4px;
}

/* 全局滾動條樣式 */
* {
  scrollbar-width: thin;
  scrollbar-color: #4a4a4a #1e1e1e;
}

*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

*::-webkit-scrollbar-track {
  background: #1e1e1e;
  border-radius: 3px;
}

*::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 3px;
}

*::-webkit-scrollbar-thumb:hover {
  background: #5a5a5a;
}

*::-webkit-scrollbar-corner {
  background: #1e1e1e;
}

#app {
  height: 100vh;
  height: 100dvh; /* 使用動態視窗高度，適用於移動設備 */
  display: flex;
  flex-direction: column;
  background-color: #1e1e1e;
  box-sizing: border-box;
  max-width: none !important;
  margin: 0 !important;
  width: 100%;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>

<style scoped>

/* 頂部工具欄 */
.top-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background-color: #2d2d2d;
  border-bottom: 1px solid #3e3e3e;
  flex-shrink: 0;
  height: 36px;
  gap: 12px;
}

/* 左側控制區域 */
.left-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* 服務器資訊欄 */
.server-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  color: #a0aec0;
  font-size: 11px;
  font-family: 'Courier New', monospace;
  min-width: 0; /* 允許彈性收縮 */
  justify-content: flex-end; /* 向右對齊 */
}

.info-item {
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}

.info-item svg {
  flex-shrink: 0;
  opacity: 0.8;
}

/* 連接狀態按鈕 */
.connection-status-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  background: transparent;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  white-space: nowrap;
}

.status-text {
  font-size: 12px;
  color: #d4d4d4;
  font-weight: 500;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.status-indicator.connected {
  background-color: #4caf50;
  box-shadow: 0 0 4px rgba(76, 175, 80, 0.4);
}

.status-indicator.connecting {
  background-color: #ffa726;
  animation: pulse 1.5s ease-in-out infinite;
}

.status-indicator.disconnected {
  background-color: #f44336;
}

.status-indicator.error {
  background-color: #e91e63;
  animation: blink 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* 按鈕樣式 */
.btn {
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  color: #cccccc;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn:not(:disabled):hover {
  background-color: #3e3e3e;
  color: #ffffff;
}

.btn:not(:disabled):active {
  background-color: #4e4e4e;
}

.btn-icon {
  width: 28px;
  height: 28px;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 連接狀態按鈕 hover 效果 */
.connection-status-btn:hover {
  background-color: #3e3e3e;
}

/* 分頁條樣式 */
.tabs-bar {
  display: flex;
  align-items: center;
  background-color: #2d2d2d;
  flex-shrink: 0;
  overflow: hidden;
}

.tabs-container {
  display: flex;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tabs-container::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background-color: #2d2d2d;
  border-right: 1px solid #3e3e3e;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
  min-width: 120px;
  max-width: 200px;
}

.tab:hover {
  background-color: #383838;
}

.tab.active {
  background-color: #1e1e1e;
}

.tab-name {
  color: #d4d4d4;
  font-size: 12px;
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab.active .tab-name {
  color: #ffffff;
}

.tab-close {
  background: none;
  border: none;
  color: #888;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  transition: all 0.2s;
}

.tab-close:hover {
  background-color: #555;
  color: #fff;
}

/* 新增終端按鈕 */
.new-tab-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin: 4px;
  border-radius: 2px;
}

.new-tab-btn:hover {
  background-color: #3e3e3e;
  color: #fff;
}

.new-tab-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}



/* 統計信息浮動窗口 */
.stats-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.server-stats {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 20px;
  margin: 20px;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.stats-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f0f0f0;
  color: #333;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.stat-label {
  font-weight: 500;
  color: #666;
  font-size: 13px;
}

.stat-value {
  font-weight: 600;
  color: #333;
  font-size: 13px;
}

.server-stats h4 {
  margin: 16px 0 12px 0;
  color: #333;
  font-size: 16px;
}

.clients-list {
  max-height: 200px;
  overflow-y: auto;
}

.client-item {
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 8px;
  border: 1px solid #e9ecef;
}

.client-info {
  display: flex;
  gap: 12px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
}

.client-ip {
  color: #007bff;
}

.client-id, .client-pid {
  color: #666;
}

.client-agent {
  font-size: 11px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 響應式設計 */
@media (max-width: 768px) {
  html, body {
    overflow: hidden !important;
    position: fixed;
    width: 100%;
    height: 100%;
  }
  
  #app {
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }
  
  .top-toolbar {
    padding: 4px 8px;
    height: 32px;
    flex-shrink: 0;
  }
  
  .server-info {
    display: none; /* 手機模式下隱藏服務器信息 */
  }
  
  .tabs-bar {
    overflow-x: auto;
  }
  
  .tab {
    min-width: 80px;
    max-width: 120px;
    padding: 6px 8px;
  }
  
  .tab-name {
    font-size: 11px;
  }
  
  .new-tab-btn {
    width: 28px;
    height: 28px;
    padding: 6px;
  }
  
  .left-controls {
    gap: 4px;
  }
  
  .btn-icon {
    width: 24px;
    height: 24px;
    padding: 4px;
  }
  
  .connection-status-btn {
    height: 24px;
    padding: 0 6px;
  }
  
  .status-text {
    font-size: 11px;
  }
  
  .status-indicator {
    width: 10px;
    height: 10px;
  }
  
  .server-stats {
    margin: 10px;
    max-height: 90vh;
    max-height: 90dvh;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

/* 右側控制區域 */
.right-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* 設定按鈕 */
.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background-color: transparent;
  border: none;
  border-radius: 6px;
  color: #888;
  cursor: pointer;
  transition: all 0.15s ease;
  opacity: 0.8;
}

.settings-btn:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: #b8b8b8;
  opacity: 1;
}

.settings-btn:active {
  background-color: rgba(255, 255, 255, 0.1);
  transform: scale(0.95);
}

/* 設定面板遮罩 */
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 設定面板 */
.settings-panel {
  background-color: #2d2d2d;
  border: 1px solid #3e3e3e;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease-out;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

@keyframes slideIn {
  from {
    transform: translateY(-50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 設定面板標題 */
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #3e3e3e;
  background-color: #363636;
  border-radius: 8px 8px 0 0;
}

.settings-header h3 {
  margin: 0;
  color: #e1e1e1;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: none;
  color: #999;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background-color: #ff4757;
  color: white;
}

/* 設定內容 */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.settings-section {
  padding: 20px;
  border-bottom: 1px solid #3e3e3e;
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section h4 {
  margin: 0 0 16px 0;
  color: #4a9eff;
  font-size: 16px;
  font-weight: 600;
}

/* 設定項目 */
.setting-item {
  margin-bottom: 16px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}

.setting-text {
  color: #e1e1e1;
  font-size: 14px;
  font-weight: 500;
}

.setting-input,
.setting-select {
  background-color: #1a1a1a;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 8px 12px;
  color: #e1e1e1;
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.setting-input:focus,
.setting-select:focus {
  outline: none;
  border-color: #4a9eff;
  box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
}

.setting-checkbox {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  accent-color: #4a9eff;
}

.setting-label:has(.setting-checkbox) {
  flex-direction: row;
  align-items: center;
}

/* 設定面板底部 */
.settings-footer {
  display: flex;
  justify-content: space-between;
  padding: 16px 20px;
  border-top: 1px solid #3e3e3e;
  background-color: #363636;
  border-radius: 0 0 8px 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

.btn-primary {
  background-color: #4a9eff;
  color: white;
}

.btn-primary:hover {
  background-color: #3182ce;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .settings-panel {
    width: 95%;
    max-height: 90vh;
  }
  
  .settings-header,
  .settings-footer {
    padding: 12px 16px;
  }
  
  .settings-section {
    padding: 16px;
  }
  
  .settings-footer {
    flex-direction: column;
    gap: 8px;
  }
  
  .btn {
    width: 100%;
  }
}



.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #3e3e3e;
  background-color: #363636;
  border-radius: 8px 8px 0 0;
}

.panel-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
}

.panel-content {
  padding: 20px;
  max-height: 500px;
  overflow-y: auto;
}

.info-section {
  margin-bottom: 24px;
}

.info-section:last-child {
  margin-bottom: 0;
}

.info-section h4 {
  margin: 0 0 12px 0;
  color: #569cd6;
  font-size: 14px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #2d2d2d;
  border-radius: 4px;
}

.info-label {
  color: #cccccc;
  font-size: 13px;
  font-weight: 500;
}

.info-value {
  color: #ffffff;
  font-size: 13px;
  font-family: 'Courier New', monospace;
  text-align: right;
  max-width: 60%;
  word-break: break-all;
}

.panel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid #3e3e3e;
  background-color: #2d2d2d;
  border-radius: 0 0 8px 8px;
}

.update-time {
  font-size: 12px;
  color: #cccccc;
}



@media (max-width: 768px) {
  .system-info-panel {
    width: 95vw;
    margin: 0 auto;
  }
  
  .info-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .info-value {
    max-width: 100%;
    text-align: left;
  }
  
  .panel-footer {
    flex-direction: column;
    gap: 8px;
  }
}
</style>