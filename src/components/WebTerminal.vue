<template>
  <div class="terminal-container">
    <div ref="terminalElement" class="terminal"></div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

export default {
  name: 'WebTerminal',
  props: {
    socket: {
      type: Object,
      default: null
    },
    isConnected: {
      type: Boolean,
      default: false
    },
    activeTabId: {
      type: String,
      default: null
    }
  },
  emits: ['resize'],
  setup(props, { emit }) {
    const terminalElement = ref(null)
    const terminals = ref({}) // 存儲多個終端實例: { terminalId: { terminal, fitAddon } }
    let resizeObserver = null
    let currentTerminalId = ref(null)

    // 創建新終端實例
    const createTerminal = (terminalId) => {
      if (terminals.value[terminalId]) {
        console.log(`終端 ${terminalId} 已存在`)
        return terminals.value[terminalId]
      }

      // 創建終端實例
      const terminal = new Terminal({
        rows: 24,
        cols: 80,
        cursorBlink: true,
        cursorStyle: 'block',
        bellStyle: 'sound',
        fontSize: 14,
        fontFamily: 'Consolas, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
          selection: '#264f78',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5'
        },
        allowTransparency: false,
        convertEol: true,
        disableStdin: false,
        scrollback: 1000,
        tabStopWidth: 4
      })

      // 添加自適應插件
      const fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)

      // 添加鏈接識別插件
      const webLinksAddon = new WebLinksAddon()
      terminal.loadAddon(webLinksAddon)

      // 監聽終端數據輸入
      terminal.onData((data) => {
        if (props.socket && props.isConnected) {
          props.socket.emit('terminal-input', { input: data, terminalId })
        }
      })

      // 監聽終端尺寸變化
      terminal.onResize(({ cols, rows }) => {
        if (currentTerminalId.value === terminalId) {
          emit('resize', { cols, rows, terminalId })
        }
      })

      // 存儲終端實例
      terminals.value[terminalId] = {
        terminal,
        fitAddon,
        isVisible: false
      }

      console.log(`創建終端實例: ${terminalId}`)
      return terminals.value[terminalId]
    }

    // 初始化終端顯示
    const initTerminal = () => {
      if (!terminalElement.value) return
      
      // 設置窗口大小變化監聽器
      setupResizeObserver()
      console.log('終端容器初始化完成')
    }

    // 設置尺寸變化監聽器
    const setupResizeObserver = () => {
      if (!window.ResizeObserver || !terminalElement.value) return

      resizeObserver = new ResizeObserver(() => {
        if (currentTerminalId.value && terminals.value[currentTerminalId.value]) {
          const terminalInstance = terminals.value[currentTerminalId.value]
          try {
            terminalInstance.fitAddon.fit()
            emitResize()
          } catch (error) {
            console.error('調整終端尺寸失敗:', error)
          }
        }
      })

      resizeObserver.observe(terminalElement.value)
    }

    // 發送尺寸變更事件
    const emitResize = () => {
      if (currentTerminalId.value && terminals.value[currentTerminalId.value]) {
        const terminal = terminals.value[currentTerminalId.value].terminal
        emit('resize', {
          cols: terminal.cols,
          rows: terminal.rows,
          terminalId: currentTerminalId.value
        })
      }
    }

    // 清空終端
    const clearTerminal = (terminalId = null) => {
      const targetId = terminalId || currentTerminalId.value
      if (targetId && terminals.value[targetId]) {
        terminals.value[targetId].terminal.clear()
      }
    }

    // 獲取終端尺寸
    const getTerminalSize = () => {
      if (currentTerminalId.value && terminals.value[currentTerminalId.value]) {
        const terminal = terminals.value[currentTerminalId.value].terminal
        return {
          cols: terminal.cols,
          rows: terminal.rows
        }
      }
      return { cols: 80, rows: 24 }
    }

    // 寫入終端
    const writeToTerminal = (data, terminalId) => {
      if (terminalId && terminals.value[terminalId]) {
        terminals.value[terminalId].terminal.write(data)
      }
    }

    // 切換終端
    const switchTerminal = (terminalId) => {
      if (!terminalElement.value) return

      // 隱藏當前終端
      if (currentTerminalId.value && terminals.value[currentTerminalId.value]) {
        const currentInstance = terminals.value[currentTerminalId.value]
        if (currentInstance.isVisible && currentInstance.terminal.element) {
          currentInstance.terminal.element.style.display = 'none'
          currentInstance.isVisible = false
        }
      }

      // 創建或獲取目標終端
      let targetInstance = terminals.value[terminalId]
      if (!targetInstance) {
        targetInstance = createTerminal(terminalId)
      }

      // 顯示目標終端
      if (!targetInstance.isVisible) {
        if (!targetInstance.terminal.element) {
          // 首次打開終端
          targetInstance.terminal.open(terminalElement.value)
        } else {
          // 重新顯示終端
          targetInstance.terminal.element.style.display = 'block'
        }
        targetInstance.isVisible = true

        // 調整大小並設置焦點
        nextTick(() => {
          try {
            targetInstance.fitAddon.fit()
            targetInstance.terminal.focus()
            emitResize()
          } catch (error) {
            console.error('切換終端時調整大小失敗:', error)
          }
        })
      }

      currentTerminalId.value = terminalId
      console.log(`切換到終端: ${terminalId}`)
    }

    // 銷毀終端
    const destroyTerminal = (terminalId) => {
      if (terminals.value[terminalId]) {
        const terminalInstance = terminals.value[terminalId]
        terminalInstance.terminal.dispose()
        delete terminals.value[terminalId]
        
        if (currentTerminalId.value === terminalId) {
          currentTerminalId.value = null
        }
        console.log(`銷毀終端: ${terminalId}`)
      }
    }

    // 監聽 socket 變化
    watch(() => props.socket, (newSocket, oldSocket) => {
      // 移除舊的監聽器
      if (oldSocket) {
        oldSocket.off('terminal-output')
        oldSocket.off('terminal-created')
        oldSocket.off('terminal-exit')
      }

      // 添加新的監聽器
      if (newSocket) {
        newSocket.on('terminal-output', (data) => {
          if (typeof data === 'string') {
            // 兼容舊格式
            writeToTerminal(data, currentTerminalId.value)
          } else {
            // 新格式包含 terminalId
            writeToTerminal(data.data, data.terminalId)
          }
        })

        newSocket.on('terminal-created', (data) => {
          console.log('終端創建成功:', data)
          // 終端創建成功後自動切換
          if (data.terminalId) {
            switchTerminal(data.terminalId)
          }
        })

        newSocket.on('terminal-exit', (data) => {
          console.log('終端退出:', data)
          if (data.terminalId) {
            destroyTerminal(data.terminalId)
          }
        })
      }
    }, { immediate: true })

    // 監聽當前活動分頁變化
    watch(() => props.activeTabId, (newTabId) => {
      if (newTabId && newTabId !== currentTerminalId.value) {
        switchTerminal(newTabId)
      }
    })

    // 監聽連接狀態變化
    watch(() => props.isConnected, (connected) => {
      Object.values(terminals.value).forEach(terminalInstance => {
        if (connected) {
          terminalInstance.terminal.options.disableStdin = false
        } else {
          terminalInstance.terminal.options.disableStdin = true
        }
      })
    })

    // 組件掛載
    onMounted(() => {
      nextTick(() => {
        initTerminal()
      })
    })

    // 組件卸載
    onUnmounted(() => {
      // 清理資源
      if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = null
      }

      // 銷毀所有終端實例
      Object.keys(terminals.value).forEach(terminalId => {
        destroyTerminal(terminalId)
      })

      if (props.socket) {
        props.socket.off('terminal-output')
        props.socket.off('terminal-created')
        props.socket.off('terminal-exit')
      }
    })

    // 暴露方法給父組件
    return {
      terminalElement,
      clearTerminal,
      getTerminalSize,
      writeToTerminal,
      switchTerminal,
      createTerminal,
      destroyTerminal,
      currentTerminalId
    }
  }
}
</script>

<style scoped>
.terminal-container {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #1e1e1e;
  overflow: hidden;
  /* 移除邊框和圓角，讓終端看起來更乾淨 */
}

.terminal {
  width: 100%;
  flex: 1;
  padding: 10px;
  min-height: 0; /* 允許 flex 項目縮小 */
}

/* 確保終端獲得焦點時的樣式 */
.terminal :deep(.xterm-viewport) {
  background-color: transparent;
}

.terminal :deep(.xterm-screen) {
  background-color: transparent;
}

/* 確保終端內容完全可見 */
.terminal :deep(.xterm) {
  height: 100% !important;
  padding-bottom: 10px; /* 避免最後一行被擋住 */
}
</style>