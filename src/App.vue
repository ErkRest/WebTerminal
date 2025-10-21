<template>
  <div id="app">
    <div class="header">
      <h1>WebSocket 遠端終端</h1>
      <div class="connection-status">
        <span :class="['status-indicator', connectionStatus]"></span>
        {{ connectionText }}
      </div>
    </div>
    
    <div class="terminal-controls">
      <button 
        @click="connectTerminal" 
        :disabled="isConnected"
        class="btn btn-primary"
      >
        連接終端
      </button>
      
      <button 
        @click="disconnectTerminal" 
        :disabled="!isConnected"
        class="btn btn-danger"
      >
        斷開連接
      </button>
      
      <button 
        @click="clearTerminal" 
        :disabled="!isConnected"
        class="btn btn-secondary"
      >
        清空終端
      </button>

      <button 
        @click="getServerStats" 
        :disabled="!isConnected"
        class="btn btn-info"
      >
        服務器統計
      </button>
      
      <div class="terminal-info" v-if="terminalInfo.pid">
        <div class="info-row">
          <span class="info-label">PID:</span> {{ terminalInfo.pid }} |
          <span class="info-label">Shell:</span> {{ terminalInfo.shell }} |
          <span class="info-label">平台:</span> {{ terminalInfo.platform }}
        </div>
        <div class="info-row" v-if="terminalInfo.clientIP">
          <span class="info-label">客戶端 IP:</span> {{ terminalInfo.clientIP }} |
          <span class="info-label">Socket ID:</span> {{ terminalInfo.socketId }}
        </div>
      </div>
    </div>

    <WebTerminal 
      ref="terminalRef"
      :socket="socket"
      :is-connected="isConnected"
      @resize="handleTerminalResize"
    />

    <!-- 服務器統計信息 -->
    <div v-if="serverStats.visible" class="server-stats">
      <h3>服務器統計信息</h3>
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
      
      <button @click="serverStats.visible = false" class="btn btn-secondary">
        關閉統計
      </button>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
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
        // 獲取終端詳細信息
        socket.value.emit('get-terminal-info')
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
        serverStats.visible = true
      })
    }

    // 連接終端
    const connectTerminal = () => {
      if (!socket.value || !isConnected.value) {
        connectToServer()
        return
      }

      // 獲取終端尺寸
      const terminalSize = terminalRef.value?.getTerminalSize() || { cols: 80, rows: 24 }
      
      // 創建終端會話
      socket.value.emit('create-terminal', terminalSize)
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
      if (terminalRef.value) {
        terminalRef.value.clearTerminal()
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
      if (socket.value && isConnected.value) {
        socket.value.emit('terminal-resize', { cols, rows })
      }
    }

    // 組件掛載時自動連接
    onMounted(() => {
      connectToServer()
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
      connectTerminal,
      disconnectTerminal,
      clearTerminal,
      getServerStats,
      formatUptime,
      handleTerminalResize
    }
  }
}
</script>

<style scoped>
#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  box-sizing: border-box;
}

.terminal-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* 允許 flex 項目縮小 */
}

.server-stats {
  margin-top: 20px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.server-stats h3 {
  margin-bottom: 12px;
  color: #333;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
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
}

.stat-value {
  font-weight: 600;
  color: #333;
}
</style>