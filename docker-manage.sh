#!/bin/bash

# Docker Compose 管理腳本
# 用於 WebSocket 終端系統的 Docker 容器管理

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 顯示標題
show_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}    WebSocket 終端 Docker 管理工具${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

# 顯示幫助信息
show_help() {
    echo -e "${CYAN}使用方法:${NC}"
    echo -e "  ./docker-manage.sh [命令]"
    echo ""
    echo -e "${CYAN}可用命令:${NC}"
    echo -e "  ${GREEN}build${NC}     - 構建 Docker 映像"
    echo -e "  ${GREEN}up${NC}        - 啟動服務 (後台運行)"
    echo -e "  ${GREEN}down${NC}      - 停止並移除服務"
    echo -e "  ${GREEN}restart${NC}   - 重啟服務"
    echo -e "  ${GREEN}logs${NC}      - 查看日誌"
    echo -e "  ${GREEN}status${NC}    - 查看服務狀態"
    echo -e "  ${GREEN}clean${NC}     - 清理所有容器和映像"
    echo -e "  ${GREEN}dev${NC}       - 開發模式啟動 (構建並啟動)"
    echo -e "  ${GREEN}shell${NC}     - 進入服務器容器 shell"
    echo -e "  ${GREEN}help${NC}      - 顯示此幫助信息"
    echo ""
}

# 檢查 Docker 和 Docker Compose
check_requirements() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}錯誤: 未找到 Docker，請先安裝 Docker${NC}"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}錯誤: 未找到 Docker Compose，請先安裝 Docker Compose${NC}"
        exit 1
    fi

    # 檢查 Docker 是否運行
    if ! docker info &> /dev/null; then
        echo -e "${RED}錯誤: Docker 服務未運行，請啟動 Docker${NC}"
        exit 1
    fi
}

# 獲取 Docker Compose 命令
get_compose_cmd() {
    if command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    else
        echo "docker compose"
    fi
}

# 構建映像
build_images() {
    echo -e "${YELLOW}正在構建 Docker 映像...${NC}"
    local compose_cmd=$(get_compose_cmd)
    $compose_cmd build --no-cache
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 映像構建完成${NC}"
    else
        echo -e "${RED}✗ 映像構建失敗${NC}"
        exit 1
    fi
}

# 啟動服務
start_services() {
    echo -e "${YELLOW}正在啟動服務...${NC}"
    local compose_cmd=$(get_compose_cmd)
    $compose_cmd up -d
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 服務啟動成功${NC}"
        echo -e "${BLUE}前端: http://localhost:8080${NC}"
        echo -e "${BLUE}後端: http://localhost:3000${NC}"
        echo ""
        echo -e "${CYAN}使用 './docker-manage.sh logs' 查看日誌${NC}"
        echo -e "${CYAN}使用 './docker-manage.sh status' 查看狀態${NC}"
    else
        echo -e "${RED}✗ 服務啟動失敗${NC}"
        exit 1
    fi
}

# 停止服務
stop_services() {
    echo -e "${YELLOW}正在停止服務...${NC}"
    local compose_cmd=$(get_compose_cmd)
    $compose_cmd down
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 服務已停止${NC}"
    else
        echo -e "${RED}✗ 停止服務失敗${NC}"
        exit 1
    fi
}

# 重啟服務
restart_services() {
    echo -e "${YELLOW}正在重啟服務...${NC}"
    local compose_cmd=$(get_compose_cmd)
    $compose_cmd restart
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 服務已重啟${NC}"
    else
        echo -e "${RED}✗ 重啟服務失敗${NC}"
        exit 1
    fi
}

# 查看日誌
show_logs() {
    echo -e "${YELLOW}顯示服務日誌 (按 Ctrl+C 退出):${NC}"
    local compose_cmd=$(get_compose_cmd)
    $compose_cmd logs -f --tail=100
}

# 查看狀態
show_status() {
    echo -e "${YELLOW}服務狀態:${NC}"
    local compose_cmd=$(get_compose_cmd)
    $compose_cmd ps
    echo ""
    echo -e "${YELLOW}容器資源使用:${NC}"
    docker stats --no-stream webterminal-server webterminal-client 2>/dev/null || echo "容器未運行"
}

# 清理資源
clean_all() {
    echo -e "${YELLOW}正在清理所有資源...${NC}"
    read -p "這將刪除所有容器、映像和數據卷。確定要繼續嗎？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        local compose_cmd=$(get_compose_cmd)
        $compose_cmd down -v --rmi all --remove-orphans
        docker system prune -f
        echo -e "${GREEN}✓ 清理完成${NC}"
    else
        echo -e "${CYAN}操作已取消${NC}"
    fi
}

# 開發模式
dev_mode() {
    echo -e "${YELLOW}啟動開發模式...${NC}"
    local compose_cmd=$(get_compose_cmd)
    $compose_cmd up --build
}

# 進入服務器容器
enter_shell() {
    echo -e "${YELLOW}進入服務器容器 shell...${NC}"
    docker exec -it webterminal-server /bin/sh 2>/dev/null || {
        echo -e "${RED}錯誤: 服務器容器未運行${NC}"
        echo -e "${CYAN}請先使用 './docker-manage.sh up' 啟動服務${NC}"
        exit 1
    }
}

# 主程序
main() {
    show_header
    check_requirements

    case "${1:-help}" in
        "build")
            build_images
            ;;
        "up")
            start_services
            ;;
        "down")
            stop_services
            ;;
        "restart")
            restart_services
            ;;
        "logs")
            show_logs
            ;;
        "status")
            show_status
            ;;
        "clean")
            clean_all
            ;;
        "dev")
            dev_mode
            ;;
        "shell")
            enter_shell
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# 執行主程序
main "$@"