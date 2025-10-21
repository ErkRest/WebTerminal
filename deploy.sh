#!/bin/bash

# 生產環境部署腳本

echo "========================================"
echo "     WebSocket 終端 - 生產環境部署"
echo "========================================"

# 檢查環境
if [ ! -f "package.json" ]; then
    echo "錯誤: 請在專案根目錄執行此腳本"
    exit 1
fi

# 安裝依賴
echo "安裝生產依賴..."
npm ci --production

# 建構前端
echo "建構前端應用..."
npm run build

# 創建生產環境配置
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'websocket-terminal',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF

# 創建日誌目錄
mkdir -p logs

# 創建 nginx 配置範例
cat > nginx.conf.example << EOF
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端靜態文件
    location / {
        root /path/to/WebTerminal/dist;
        try_files \$uri \$uri/ /index.html;
    }
    
    # WebSocket 代理
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

echo "建構完成！"
echo ""
echo "部署說明："
echo "1. 使用 PM2 管理進程: pm2 start ecosystem.config.js"
echo "2. 設定 nginx 反向代理 (參考 nginx.conf.example)"
echo "3. 設定防火牆規則"
echo "4. 配置 SSL 證書 (建議使用 Let's Encrypt)"
echo ""
echo "注意：生產環境請務必實現身份驗證和安全控制！"