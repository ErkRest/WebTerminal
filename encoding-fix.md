# 中文編碼問題解決方案

## 問題原因

Windows 系統中文編碼亂碼的根本原因：

1. **Windows CMD 預設編碼**：
   - 繁體中文系統：Big5 (代碼頁 950)
   - 簡體中文系統：GBK (代碼頁 936)
   - 英文系統：CP1252 (代碼頁 1252)

2. **Node.js 預設編碼**：UTF-8

3. **WebSocket 傳輸編碼**：UTF-8

## 解決方案

### 1. 在命令執行前設置 UTF-8 編碼
```cmd
chcp 65001
```

### 2. 使用 iconv-lite 進行編碼轉換
```javascript
const iconv = require('iconv-lite');

// 嘗試多種編碼解碼
let output;
if (isWindows) {
  try {
    output = iconv.decode(data, 'cp950'); // Big5
  } catch (error) {
    try {
      output = iconv.decode(data, 'gbk'); // GBK
    } catch (error2) {
      output = data.toString('utf8'); // 備用方案
    }
  }
}
```

### 3. 修改 spawn 選項
```javascript
const spawnOptions = {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: false,
  env: { ...process.env, CHCP: '65001' } // Windows 設置 UTF-8
};
```

## 測試命令

現在應該可以正確顯示中文了：

### Windows 測試命令：
```cmd
echo 你好世界
dir
ping google.com
systeminfo | findstr "系統"
```

### 編碼相關命令：
```cmd
chcp                    # 查看當前代碼頁
chcp 65001             # 設置為 UTF-8
chcp 950               # 設置為 Big5
```

## 常見代碼頁對照

| 代碼頁 | 編碼 | 說明 |
|--------|------|------|
| 65001 | UTF-8 | Unicode |
| 950 | Big5 | 繁體中文 |
| 936 | GBK | 簡體中文 |
| 1252 | CP1252 | 西歐語言 |
| 437 | OEM | 美國英文 |

這樣就解決了中文顯示亂碼的問題！