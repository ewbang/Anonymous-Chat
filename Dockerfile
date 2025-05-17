# 构建前端
FROM node:18-alpine

WORKDIR /app

# 设置 npm 镜像
RUN npm config set registry https://registry.npmmirror.com

# 复制 package.json 和 yarn.lock
COPY package*.json yarn.lock ./

# 安装依赖
RUN yarn install

# 复制所有源代码
COPY . .

# 创建必要的目录并设置权限
RUN mkdir -p /app/src/public/profile \
    && mkdir -p /app/src/public/uploads \
    && mkdir -p /app/src/data \
    && chmod -R 777 /app/src/public/profile \
    && chmod -R 777 /app/src/public/uploads \
    && chmod -R 777 /app/src/data

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV VITE_SERVER_URL=http://127.0.0.1:3000
ENV HOST=0.0.0.0

# 暴露端口
EXPOSE 3000 5173

# 启动应用
CMD ["yarn", "dev:all"] 