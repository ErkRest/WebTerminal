#!/bin/bash

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}    WebSocket 遠端終端系統啟動腳本${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}錯誤: 未找到 Node.js，請先安裝 Node.js${NC}"
    exit 1
fi

# 檢查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}錯誤: 未找到 npm，請先安裝 npm${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js 和 npm 已安裝${NC}"

# 檢查依賴
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}正在安裝依賴...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}錯誤: 依賴安裝失敗${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ 依賴已安裝${NC}"

# 啟動應用
echo ""
echo -e "${YELLOW}正在啟動 WebSocket 終端服務...${NC}"
echo -e "${BLUE}前端: http://localhost:8080${NC}"
echo -e "${BLUE}後端: http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止服務${NC}"
echo ""

# 使用 npm run dev 啟動
npm run dev