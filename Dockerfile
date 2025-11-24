# 前端 Dockerfile
# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖（使用 --legacy-peer-deps 解决 React 19 与 lucide-react 的 peer dependency 冲突）
RUN npm install --legacy-peer-deps

# 复制源代码
COPY . .

# 构建参数：API_KEY（可选，用于构建时注入）
ARG API_KEY
ENV API_KEY=${API_KEY}

# 构建应用
RUN npm run build

# 生产阶段
FROM nginx:alpine

# 复制构建产物到 nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

