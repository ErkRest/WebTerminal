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
    let terminal = null // 暫時保持單一終端實例
    let fitAddon = null
    let resizeObserver = null

    // 初始化終端
    const initTerminal = () => {
      if (!terminalElement.value) return

      // 創建終端實例
      terminal = new Terminal({
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
      fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)

      // 添加鏈接識別插件
      const webLinksAddon = new WebLinksAddon()
      terminal.loadAddon(webLinksAddon)

      // 打開終端
      terminal.open(terminalElement.value)

      // 初始調整大小
      nextTick(() => {
        fitAddon.fit()
        emitResize()
      })

      // 監聽終端數據輸入
      terminal.onData((data) => {
        if (props.socket && props.isConnected) {
          props.socket.emit('terminal-input', data)
        }
      })

      // 監聽終端尺寸變化
      terminal.onResize(({ cols, rows }) => {
        emit('resize', { cols, rows })
      })

      // 設置窗口大小變化監聽器
      setupResizeObserver()

      console.log('終端初始化完成')
    }

    // 設置尺寸變化監聽器
    const setupResizeObserver = () => {
      if (!window.ResizeObserver || !terminalElement.value) return

      resizeObserver = new ResizeObserver(() => {
        if (fitAddon && terminal) {
          try {
            fitAddon.fit()
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
      if (terminal) {
        emit('resize', {
          cols: terminal.cols,
          rows: terminal.rows
        })
      }
    }

    // 清空終端
    const clearTerminal = (terminalId = null) => {
      if (terminal) {
        terminal.clear()
      }
    }

    // 獲取終端尺寸
    const getTerminalSize = () => {
      if (terminal) {
        return {
          cols: terminal.cols,
          rows: terminal.rows
        }
      }
      return { cols: 80, rows: 24 }
    }

    // 寫入終端
    const writeToTerminal = (data) => {
      if (terminal) {
        terminal.write(data)
      }
    }

    // 監聽 socket 變化
    watch(() => props.socket, (newSocket, oldSocket) => {
      // 移除舊的監聽器
      if (oldSocket) {
        oldSocket.off('terminal-output')
      }

      // 添加新的監聽器
      if (newSocket) {
        newSocket.on('terminal-output', (data) => {
          writeToTerminal(data)
        })
      }
    }, { immediate: true })

    // 監聽連接狀態變化
    watch(() => props.isConnected, (connected) => {
      if (terminal) {
        if (connected) {
          terminal.options.disableStdin = false
          terminal.focus()
          // 當連接成功時，自動創建終端會話
          if (props.socket) {
            const terminalSize = getTerminalSize()
            props.socket.emit('create-terminal', terminalSize)
          }
        } else {
          terminal.options.disableStdin = true
        }
      }
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

      if (terminal) {
        terminal.dispose()
        terminal = null
      }

      if (props.socket) {
        props.socket.off('terminal-output')
      }
    })

    // 切換終端（暫時簡化實現）
    const switchTerminal = (terminalId) => {
      console.log('切換到終端:', terminalId)
      // 暫時只是記錄，實際的多終端功能需要更複雜的實現
    }

    // 暴露方法給父組件
    return {
      terminalElement,
      clearTerminal,
      getTerminalSize,
      writeToTerminal,
      switchTerminal
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