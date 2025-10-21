<template>
  <div id="app">
    <!-- 頂部工具欄 -->
    <div class="top-toolbar">
      <!-- 服務器資訊欄 -->
      <div class="server-info" v-if="isConnected">
        <span class="info-item">總連接: {{ serverStats.totalConnections }}</span>
        <span class="info-item">運行時間: {{ formatUptime(serverStats.serverUptime) }}</span>
        <span class="info-item">{{ serverStats.nodeVersion }}</span>
      </div>

      <!-- 控制按鈕 -->
      <div class="control-buttons">
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
      
      // 使用相對路徑，通過 Vite 代理連接到服務器
      socket.value = io('/', {
        transports: ['websocket', 'polling']
      })

      // 連接成功
      socket.value.on('connect', () => {
        console.log('WebSocket 連接成功')
        connectionStatus.value = 'connected'
        isConnected.value = true
        // 自動獲取服務器統計信息
        setTimeout(() => {
          if (socket.value) {
            socket.value.emit('get-server-stats')
          }
        }, 1000)
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
        Object.assign(terminalInfo, data)
        
        // 更新對應分頁的信息
        if (data.terminalId) {
          const tab = tabs.value.find(tab => tab.id === data.terminalId)
          if (tab) {
            tab.pid = data.pid
          }
        }
        
        // 獲取終端詳細信息
        socket.value.emit('get-terminal-info', { terminalId: data.terminalId })
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
        console.log('終端退出，代碼:', data.exitCode)
        terminalInfo.pid = null
      })

      // 服務器統計信息
      socket.value.on('server-stats', (data) => {
        console.log('服務器統計信息:', data)
        Object.assign(serverStats, data)
        // 不再自動顯示浮動窗口
      })
    }

    // 連接終端
    const connectTerminal = () => {
      if (!socket.value || !isConnected.value) {
        connectToServer()
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
        terminalInfo.pid = null
      }
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

    // 處理終端尺寸變更
    const handleTerminalResize = ({ cols, rows }) => {
      if (socket.value && isConnected.value && activeTabId.value) {
        socket.value.emit('terminal-resize', { 
          cols, 
          rows,
          terminalId: activeTabId.value 
        })
      }
    }

    // 創建新的終端分頁
    const createNewTab = () => {
      if (!socket.value || !isConnected.value) {
        connectToServer()
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
      switchToTab(tabId)
      
      // 創建終端會話
      const terminalSize = terminalRef.value?.getTerminalSize() || { cols: 80, rows: 24 }
      socket.value.emit('create-terminal', { ...terminalSize, terminalId: tabId })
    }

    // 切換到指定分頁
    const switchToTab = (tabId) => {
      // 更新分頁活動狀態
      tabs.value.forEach(tab => {
        tab.isActive = tab.id === tabId
      })
      activeTabId.value = tabId
      
      // 通知終端組件切換
      if (terminalRef.value) {
        terminalRef.value.switchTerminal(tabId)
      }
    }

    // 關閉分頁
    const closeTab = (tabId) => {
      const tabIndex = tabs.value.findIndex(tab => tab.id === tabId)
      if (tabIndex === -1) return

      // 如果關閉的是當前活動分頁，需要切換到其他分頁
      if (tabId === activeTabId.value) {
        if (tabs.value.length > 1) {
          // 切換到前一個或後一個分頁
          const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 1
          switchToTab(tabs.value[newActiveIndex].id)
        } else {
          activeTabId.value = null
        }
      }

      // 通知服務器關閉終端
      if (socket.value) {
        socket.value.emit('close-terminal', { terminalId: tabId })
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

    // 組件掛載時自動連接
    onMounted(() => {
      connectToServer()
    })

    // 監聽連接狀態，連接成功後創建第一個分頁
    watch(isConnected, (connected) => {
      if (connected && tabs.value.length === 0) {
        createNewTab()
      }
    })

    // 組件卸載時斷開連接
    onUnmounted(() => {
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
      tabs,
      activeTabId,
      connectTerminal,
      disconnectTerminal,
      clearTerminal,
      getServerStats,
      formatUptime,
      handleTerminalResize,
      createNewTab,
      switchToTab,
      closeTab,
      renameTab
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
  background-color: #1e1e1e !important;
  -webkit-overflow-scrolling: touch;
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
}

.info-item {
  white-space: nowrap;
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

/* 控制按鈕 */
.control-buttons {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
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

/* 統一 control-buttons 內所有按鈕的 hover 效果 */
.control-buttons .btn:hover,
.control-buttons .connection-status-btn:hover {
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
  
  .control-buttons {
    gap: 2px;
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
</style>