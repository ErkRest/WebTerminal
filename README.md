# Vue 3 WebSocket 終端機控制器

這是一個使用 Vue 3 和 WebSocket 技術建立的網頁終端機控制器，可以透過網頁界面遠程執行服務器端的命令列指令。

## 功能特點

- ✅ **即時命令執行**：透過 WebSocket 即時執行 CMD 或 Shell 命令
- ✅ **多終端標籤頁**：支援創建多個終端標籤頁，每個標籤頁獨立運行
- ✅ **工作目錄維護**：`cd` 命令可以正確切換目錄，後續命令在新目錄執行
- ✅ **多進程管理**：可以同時運行多個命令，並管理這些進程
- ✅ **命令歷史**：每個終端標籤頁都有獨立的命令歷史記錄
- ✅ **即時輸出**：即時顯示命令的 stdout 和 stderr 輸出
- ✅ **進程控制**：可以終止正在運行的進程
- ✅ **跨平台支援**：支援 Windows (CMD) 和 Linux/macOS (Bash)
- ✅ **自動重連**：WebSocket 連接中斷後自動重連
- ✅ **美觀界面**：類似 VS Code 的深色主題界面
- ✅ **中文編碼修復**：正確顯示中文字符，解決亂碼問題

## 系統架構

```
前端 (Vue 3) ←→ WebSocket ←→ 後端 (Node.js + Koa) ←→ 系統命令
```

- **前端**：Vue 3 + Vite，提供用戶界面
- **後端**：Node.js + Koa + WebSocket，處理命令執行
- **通訊**：WebSocket 實現雙向即時通訊

## 安裝與運行

### 1. 安裝依賴

```bash
npm install
```

### 2. 啟動開發環境

```bash
# 同時啟動前端和後端
npm run dev

# 或者分別啟動
npm run server  # 啟動後端服務器 (端口 3000)
npm run client  # 啟動前端開發服務器 (端口 8080)
```

### 3. 建構生產版本

```bash
npm run build
```

建構完成後，靜態文件將生成到 `dist` 目錄，可以直接運行 `npm run server` 來啟動生產環境。

## 使用方法

### 基本操作

1. **連接狀態**：頂部綠點表示已連接，紅點表示未連接
2. **執行命令**：在輸入框中輸入命令，按 Enter 或點擊執行按鈕
3. **查看輸出**：命令的輸出會即時顯示在終端區域
4. **管理進程**：右側邊欄顯示活躍進程，可以點擊終止按鈕結束進程

### 快捷鍵

**命令執行：**
- `Enter`：執行命令
- `↑`：上一個命令（命令歷史）
- `↓`：下一個命令（命令歷史）
- `Ctrl + L`：清除當前終端輸出

**標籤頁管理：**
- `Ctrl + T`：新增終端標籤頁
- `Ctrl + W`：關閉當前終端標籤頁
- `Ctrl + Tab`：切換到下一個終端標籤頁
- `Ctrl + Shift + Tab`：切換到上一個終端標籤頁

### 工作目錄管理

每個終端標籤頁都維護自己的工作目錄狀態：

```cmd
# 切換目錄（支援相對和絕對路徑）
cd Documents
cd C:\Windows
cd ..
cd

# 後續命令會在新目錄中執行
dir           # 顯示當前目錄內容
pwd           # 顯示當前工作目錄（Linux/macOS）
```

### 示例命令

**Windows：**
```cmd
# 基本命令
dir                    # 列出目錄內容
echo Hello World       # 輸出文字
ping google.com        # 網路測試

# 目錄操作
cd C:\Users            # 切換目錄
mkdir test             # 建立目錄
dir                    # 查看新目錄

# 系統信息
tasklist              # 查看進程列表
systeminfo            # 系統信息
```

**Linux/macOS：**
```bash
# 基本命令
ls -la                # 列出目錄內容
echo "Hello World"    # 輸出文字
ping -c 4 google.com  # 網路測試

# 目錄操作
cd /home/user         # 切換目錄
mkdir test            # 建立目錄
pwd                   # 顯示當前目錄

# 系統信息
ps aux                # 查看進程列表
top                   # 系統監控
```

## API 說明

### WebSocket 消息格式

#### 客戶端發送

```javascript
// 執行命令
{
  "type": "execute",
  "command": "ls -la"
}

// 終止進程
{
  "type": "kill",
  "processId": "abc123"
}

// 列出進程
{
  "type": "list"
}
```

#### 服務器響應

```javascript
// 一般信息
{
  "type": "info",
  "message": "命令已開始執行",
  "processId": "abc123",
  "timestamp": "2023-10-17T10:30:00.000Z"
}

// 標準輸出
{
  "type": "stdout",
  "data": "命令輸出內容",
  "processId": "abc123",
  "timestamp": "2023-10-17T10:30:01.000Z"
}

// 標準錯誤
{
  "type": "stderr",
  "data": "錯誤信息",
  "processId": "abc123",
  "timestamp": "2023-10-17T10:30:02.000Z"
}

// 進程結束
{
  "type": "close",
  "message": "進程結束，退出碼: 0",
  "processId": "abc123",
  "exitCode": 0,
  "timestamp": "2023-10-17T10:30:03.000Z"
}

// 進程列表
{
  "type": "process_list",
  "processes": [
    {
      "id": "abc123",
      "command": "ping google.com",
      "startTime": "2023-10-17T10:30:00.000Z",
      "pid": 1234
    }
  ],
  "timestamp": "2023-10-17T10:30:04.000Z"
}
```

## 安全性注意事項

⚠️ **重要安全警告**：

這個應用程式允許透過網頁執行任意系統命令，具有極高的安全風險。請僅在以下情況使用：

1. **本地開發環境**：僅在本機測試使用
2. **受信任的網路**：僅在內網或 VPN 等安全環境中使用
3. **已授權的用戶**：僅允許授權人員訪問

### 建議的安全措施

- 不要在公網環境中部署
- 添加身份驗證和授權機制
- 限制可執行的命令範圍
- 使用 HTTPS/WSS 加密連接
- 設置防火牆規則限制訪問

## 技術棧

- **前端**：Vue 3, Vite, JavaScript ES6+
- **後端**：Node.js, Koa, WebSocket (ws)
- **樣式**：原生 CSS（類 VS Code 主題）
- **進程管理**：Node.js child_process

## 專案結構

```
playwright_koa/
├── src/                 # Vue 3 源代碼
│   ├── App.vue         # 主要 Vue 組件
│   └── main.js         # 入口文件
├── dist/               # 建構輸出目錄
├── server.js           # WebSocket 服務器
├── package.json        # 依賴配置
├── vite.config.js      # Vite 配置
├── index.html          # HTML 模板
└── README.md           # 說明文件
```

## 故障排除

### 常見問題

1. **無法連接到服務器**
   - 確認後端服務器正在運行 (端口 3000)
   - 檢查防火牆設置
   - 確認 WebSocket URL 正確

2. **命令執行沒有輸出**
   - 某些命令可能沒有輸出
   - 檢查命令是否正確
   - 查看是否有錯誤信息

3. **進程無法終止**
   - 某些系統進程可能無法終止
   - 嘗試使用 `kill -9` (Linux) 或 `taskkill /f` (Windows)

### 調試方法

1. 開啟瀏覽器開發者工具查看 WebSocket 連接狀態
2. 查看服務器端 console 輸出
3. 檢查網路連接和端口占用情況

## 授權條款

MIT License - 請自由使用，但後果自負。