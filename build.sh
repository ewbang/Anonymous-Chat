#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
    echo -e "${GREEN}匿名聊天室构建脚本${NC}"
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  -h, --help                显示帮助信息"
    echo "  -i, --ip IP地址           指定服务器IP地址（必需）"
    echo "  -p, --port 端口           指定服务器端口（默认：3000）"
    echo "  -d, --dev                 开发模式（不设置生产环境变量）"
    echo "  -c, --clean               清理旧的容器和镜像"
    echo
    echo "示例:"
    echo "  $0 -i 192.168.1.100      使用指定IP构建并运行"
    echo "  $0 -i 192.168.1.100 -p 8080 使用指定IP和端口构建并运行"
    echo "  $0 -i 192.168.1.100 -d   开发模式运行"
}

# 默认值
IP=""
PORT=3000
DEV_MODE=false
CLEAN=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -i|--ip)
            IP="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -d|--dev)
            DEV_MODE=true
            shift
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        *)
            echo -e "${RED}错误：未知选项 $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 检查必需参数
if [ -z "$IP" ]; then
    echo -e "${RED}错误：未指定IP地址${NC}"
    echo "使用 -i 或 --ip 参数指定IP地址"
    exit 1
fi

# 清理旧的容器和镜像
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}正在清理旧的容器和镜像...${NC}"
    docker stop anonymous-chat 2>/dev/null || true
    docker rm anonymous-chat 2>/dev/null || true
    docker rmi anonymous-chat 2>/dev/null || true
fi

# 构建镜像
echo -e "${GREEN}正在构建Docker镜像...${NC}"
if ! docker build -t anonymous-chat .; then
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi

# 准备环境变量
ENV_VARS="-e VITE_SERVER_URL=http://${IP}:${PORT}"
if [ "$DEV_MODE" = false ]; then
    ENV_VARS="$ENV_VARS -e NODE_ENV=production"
fi

# 运行容器
echo -e "${GREEN}正在启动容器...${NC}"
echo -e "使用配置："
echo -e "  IP地址: ${YELLOW}${IP}${NC}"
echo -e "  端口: ${YELLOW}${PORT}${NC}"
echo -e "  模式: ${YELLOW}$([ "$DEV_MODE" = true ] && echo "开发" || echo "生产")${NC}"

if ! docker run -d \
    --name anonymous-chat \
    -p ${PORT}:3000 \
    -p 5173:5173 \
    ${ENV_VARS} \
    anonymous-chat; then
    echo -e "${RED}容器启动失败！${NC}"
    exit 1
fi

# 检查容器状态
echo -e "${GREEN}等待容器启动...${NC}"
sleep 5
if docker ps | grep -q anonymous-chat; then
    echo -e "${GREEN}容器已成功启动！${NC}"
    echo -e "访问地址: ${YELLOW}http://${IP}:5173${NC}"
else
    echo -e "${RED}容器启动失败，请检查日志${NC}"
    docker logs anonymous-chat
    exit 1
fi