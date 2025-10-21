# WebSocket 遠端終端

基於 Vue.js + Node.js + xterm.js 的 WebSocket 遠端終端管理系統，支援即時 ANSI 字碼處理。

## 系統架構

```
[ Client (Vue.js + xterm.js) ]
          ⬇️ WebSocket
[ Server (Node.js + socket.io) ]
          ⬇️ PTY (node-pty)
[ Shell (bash/zsh/其他) ]
```

## 功能特點

- ✅ **即時終端互動**: 基於 WebSocket 的即時雙向通信
- ✅ **ANSI 字碼支援**: 完整支援顏色、格式化等 ANSI 轉義序列
- ✅ **跨平台相容**: 支援 Linux、macOS、Windows
- ✅ **響應式設計**: 適配各種螢幕尺寸
- ✅ **終端尺寸自適應**: 自動調整終端大小
- ✅ **多終端會話**: 支援多個客戶端同時連接
- ✅ **連接狀態監控**: 即時顯示連接狀態
- ✅ **錯誤處理**: 完善的錯誤處理機制

## 技術棧

### 前端
- **Vue.js 3**: 響應式前端框架
- **xterm.js**: 功能完整的終端模擬器
- **Socket.IO Client**: WebSocket 客戶端
- **Vite**: 快速建構工具

### 後端
- **Node.js**: JavaScript 運行環境
- **Socket.IO**: WebSocket 服務器
- **node-pty**: 偽終端 (PTY) 支援
- **Express**: Web 框架

## 快速開始

### 環境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- 現代瀏覽器 (支援 WebSocket)

### 安裝與運行

1. **克隆專案**
   ```bash
   git clone <repository-url>
   cd WebTerminal
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **啟動開發服務器**
   ```bash
   npm run dev
   ```
   
   或使用啟動腳本：
   ```bash
   ./start.sh
   ```

4. **訪問應用**
   - 前端: http://localhost:8080
   - 後端 API: http://localhost:3000

### 可用指令

- `npm run dev`: 同時啟動前端和後端開發服務器
- `npm run server`: 僅啟動後端服務器
- `npm run client`: 僅啟動前端開發服務器
- `npm run build`: 建構生產版本
- `npm run preview`: 預覽生產版本

## 專案結構

```
WebTerminal/
├── src/                    # 前端源碼
│   ├── components/         # Vue 組件
│   │   └── WebTerminal.vue # 終端組件
│   ├── App.vue            # 主應用組件
│   ├── main.js            # 應用入口
│   └── style.css          # 全局樣式
├── server.js              # 後端服務器
├── index.html             # HTML 模板
├── vite.config.js         # Vite 配置
├── package.json           # 專案配置
├── start.sh               # 啟動腳本
└── README.md              # 說明文件
```

## 使用方法

1. **連接終端**: 點擊「連接終端」按鈕
2. **執行指令**: 在終端中輸入任何 shell 指令
3. **調整大小**: 瀏覽器視窗變化時終端會自動調整
4. **清空終端**: 點擊「清空終端」按鈕
5. **斷開連接**: 點擊「斷開連接」按鈕

## API 文檔

### WebSocket 事件

#### 客戶端發送
- `create-terminal`: 創建新終端會話
- `terminal-input`: 發送終端輸入
- `terminal-resize`: 調整終端尺寸
- `get-terminal-info`: 獲取終端信息

#### 服務器發送
- `terminal-created`: 終端創建成功
- `terminal-output`: 終端輸出數據
- `terminal-error`: 終端錯誤
- `terminal-exit`: 終端進程退出
- `terminal-info`: 終端信息

## 配置選項

### 服務器配置
```javascript
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8080";
```

### 終端配置
```javascript
const terminalOptions = {
  rows: 24,           // 終端行數
  cols: 80,           // 終端列數
  fontSize: 14,       // 字體大小
  fontFamily: 'Consolas, "Courier New", monospace',
  theme: {            // 終端主題
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    // ... 更多主題選項
  }
};
```

## 故障排除

### 常見問題

1. **連接失敗**
   - 檢查後端服務器是否運行在 port 3000
   - 確認防火牆設置
   - 檢查瀏覽器控制台錯誤

2. **終端無響應**
   - 確認 WebSocket 連接狀態
   - 重新連接終端
   - 檢查服務器日誌

3. **字元顯示異常**
   - 確認終端編碼設置
   - 檢查字體支援
   - 重新整理頁面

### 調試模式

開啟瀏覽器開發者工具查看：
- Console: WebSocket 連接日誌
- Network: WebSocket 通信狀態
- Application: 本地存儲狀態

## 安全考慮

⚠️ **重要**: 此應用僅供開發和測試使用。在生產環境中部署時請考慮：

- 實現用戶認證和授權
- 限制可執行的指令
- 設置網路訪問控制
- 使用 HTTPS/WSS 加密連接
- 監控和日誌記錄

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 授權

MIT License

## 更新日誌

### v1.0.0
- 初始版本發布
- 基本終端功能
- WebSocket 連接
- ANSI 字碼支援
- 響應式設計