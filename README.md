# 匿名聊天室

一个基于 Vue.js 和 Socket.IO 的实时匿名聊天应用，支持文本消息和文件分享功能。

在线预览地址：http://43.163.222.25:5173/

## 功能特点

- 实时消息通信
- 匿名用户系统（随机生成用户名和头像）
- 支持发送文本消息
- 支持文件上传和分享（最大 100MB）
- 图片文件在线预览
- 消息复制功能
- 文件下载功能
- 响应式设计
- 优雅的 UI 界面
- 显示用户地理位置和浏览器信息
- 支持清空聊天记录（需要管理员密码）
- 支持 Docker 部署

## 技术栈

- 前端：Vue 3 + Vite
- 后端：Node.js + Express
- 实时通信：Socket.IO
- 文件上传：Multer
- 样式：CSS3
- 构建工具：Vite
- 包管理：Yarn

## 安装步骤

1. 克隆项目
```bash
git clone [项目地址]
cd Anonymous-Chat
```

2. 安装依赖
```bash
# 使用 yarn
yarn install

# 或使用 npm
npm install
```

3. 创建必要的目录
```bash
mkdir -p src/public/profile
mkdir -p src/public/uploads
mkdir -p src/data
```

## 启动项目

### 开发环境

1. 同时启动前端和后端（推荐）
```bash
yarn dev:all
```

2. 或分别启动
```bash
# 启动后端服务器
yarn dev

# 启动前端开发服务器
yarn vite
```

3. 访问应用
打开浏览器访问：`http://localhost:5173`

### Docker 部署

1. 构建镜像
```bash
docker build -t anonymous-chat .
```

2. 运行容器
```bash
# 本地开发
docker run -p 3000:3000 -p 5173:5173 anonymous-chat

# 局域网使用（替换 YOUR_IP 为你的服务器 IP）
docker run -p 3000:3000 -p 5173:5173 -e VITE_SERVER_URL=http://YOUR_IP:3000 anonymous-chat
```

## 项目结构

```
Anonymous-Chat/
├── src/
│   ├── public/           # 前端资源
│   │   ├── components/   # Vue 组件
│   │   ├── css/         # 样式文件
│   │   ├── js/          # JavaScript 文件
│   │   ├── profile/     # 用户头像存储
│   │   └── uploads/     # 上传文件存储
│   ├── data/            # 数据存储
│   ├── scripts/         # 工具脚本
│   ├── random-avatar-generator/  # 随机头像生成器
│   ├── config.js        # 配置文件
│   └── index.js         # 后端服务器
├── Dockerfile           # Docker 配置文件
├── package.json         # 项目依赖配置
├── vite.config.js       # Vite 配置文件
└── README.md           # 项目说明文档
```

## 使用说明

1. 进入聊天室
   - 自动分配随机用户名和头像
   - 用户名在刷新页面后保持不变（使用 localStorage 存储）

2. 发送消息
   - 在输入框输入消息
   - 点击发送按钮或按回车键发送
   - 支持复制消息内容

3. 文件操作
   - 点击回形针图标上传文件
   - 支持所有文件类型
   - 图片文件支持在线预览
   - 点击下载按钮下载文件

4. 用户信息
   - 显示用户地理位置
   - 显示用户浏览器信息
   - 显示消息发送时间

5. 管理功能
   - 支持清空聊天记录（需要管理员密码）
   - 显示在线用户列表

## 配置说明

### 环境变量

- `PORT`: 后端服务器端口（默认：3000）
- `VITE_SERVER_URL`: 前端服务器地址（默认：http://localhost:3000）
- `HOST`: 服务器监听地址（默认：0.0.0.0）

### 文件上传配置

- 最大文件大小：100MB
- 支持的文件类型：所有类型
- 文件存储位置：`src/public/uploads`

### 数据存储

- 聊天记录：`src/data/chat_history.json`
- 用户数据：`src/data/user_data.json`

## 开发说明

- 后端服务器运行在 3000 端口
- 前端开发服务器运行在 5173 端口
- 使用 Vite 作为开发服务器和构建工具
- 使用 Socket.IO 实现实时通信
- 支持热更新和自动重连

## 注意事项

- 确保上传目录具有写入权限
- 在生产环境中修改默认密码
- 建议使用 HTTPS 进行安全通信
- 定期备份数据文件
- 注意文件存储空间管理

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

ISC

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。 