# CloudOS AI - 云桌面操作系统

一个基于 Web 的模拟桌面操作系统，集成了强大的 AI 助手功能，支持代码执行和文件分析。

## ✨ 主要特性

### 🖥️ 桌面操作系统界面
- **窗口管理**：支持打开、关闭、最小化、最大化、拖拽窗口
- **开始菜单**：快速启动应用程序
- **任务栏**：显示运行中的应用，支持快速切换
- **桌面图标**：双击图标启动应用

### 🤖 AI 助手（Athlon Agent）
- **多 LLM 支持**：
  - Google Gemini
  - Ollama（本地部署）
  - 自定义 LLM API（兼容 OpenAI/vLLM 格式）
- **代码执行功能**（类似 Code Interpreter）：
  - 自动执行 Python 代码
  - 支持 pandas、numpy、matplotlib、seaborn 等数据分析库
  - 自动生成和显示图表
  - 错误自动修复和重试机制
- **文件分析**：
  - 支持上传 Excel、CSV、PDF 等文件
  - 自动分析文件内容
  - 生成数据可视化图表
- **HTML 预览**：支持生成和预览 HTML 报告

### 📁 应用程序
- **文件浏览器**：浏览和管理文件系统
- **记事本**：简单的文本编辑器
- **浏览器**：内置网页浏览器
- **设置**：系统配置（开发中）

## 🛠️ 技术栈

### 前端
- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Lucide React** - 图标库

### 后端
- **FastAPI** - Python Web 框架
- **Pandas** - 数据分析
- **Matplotlib/Seaborn** - 数据可视化
- **PDFplumber** - PDF 处理

### 部署
- **Docker** - 容器化
- **Docker Compose** - 多容器编排
- **Nginx** - 反向代理和静态文件服务

## 📦 项目结构

```
cloud-desktop/
├── components/          # React 组件
│   ├── apps/           # 应用程序组件
│   │   ├── FileExplorer.tsx
│   │   └── GeminiChat.tsx
│   ├── os/             # 操作系统组件
│   │   ├── Window.tsx
│   │   ├── Taskbar.tsx
│   │   └── StartMenu.tsx
│   └── LoginScreen.tsx
├── services/           # 服务层
│   ├── apiService.ts   # 后端 API 调用
│   └── geminiService.ts # Gemini/LLM 服务
├── backend/            # Python 后端
│   ├── main.py        # FastAPI 主应用
│   ├── requirements.txt
│   ├── uploads/       # 上传文件目录
│   └── static/        # 生成的静态文件（图表等）
├── docker-compose.yml  # Docker Compose 配置
├── Dockerfile          # 前端 Docker 镜像
└── nginx.conf          # Nginx 配置
```

## 🚀 快速开始

### 前置要求
- Docker 和 Docker Compose
- （可选）本地 Ollama 服务（用于本地 LLM）

### 使用 Docker Compose（推荐）

1. **克隆项目**
```bash
git clone <repository-url>
cd cloud-desktop
```

2. **配置环境变量**

编辑 `docker-compose.yml`，配置 LLM 服务：

**选项 1：使用 Ollama（本地）**
```yaml
environment:
  - OLLAMA_HOST=http://host.docker.internal:11434
  - LLM_MODEL=gemini-pro
```

**选项 2：使用自定义 LLM API**
```yaml
environment:
  - LLM_API_BASE=https://your-api-endpoint.com/v1
  - LLM_API_KEY=your-api-key
  - LLM_MODEL=your-model-name
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **访问应用**
- 前端：http://localhost
- 后端 API：http://localhost:8000

### 本地开发

#### 前端开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

#### 后端开发

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
python main.py
# 或使用 uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## ⚙️ 配置说明

### LLM 配置

后端支持两种 LLM 配置方式：

1. **Ollama**（本地部署）
   - 适合本地开发和测试
   - 需要先安装并启动 Ollama
   - 配置 `OLLAMA_HOST` 环境变量

2. **自定义 LLM API**（兼容 OpenAI/vLLM）
   - 支持任何兼容 OpenAI API 格式的服务
   - 配置 `LLM_API_BASE` 和 `LLM_API_KEY`
   - 例如：阿里云 DashScope、OpenAI、vLLM 等

### 环境变量

**后端环境变量**（在 `docker-compose.yml` 中配置）：
- `LLM_API_BASE`: LLM API 基础 URL
- `LLM_API_KEY`: LLM API 密钥
- `LLM_MODEL`: 使用的模型名称
- `OLLAMA_HOST`: Ollama 服务地址（默认：http://host.docker.internal:11434）

**前端环境变量**（可选）：
- `API_KEY`: Google Gemini API 密钥（用于直接客户端调用）

## 📖 使用指南

### 启动应用

1. 打开浏览器访问 http://localhost
2. 登录界面（当前为演示模式，点击即可登录）
3. 进入桌面环境

### 使用 AI 助手

1. **打开 Athlon Agent**
   - 双击桌面上的 "Athlon Agent" 图标
   - 或从开始菜单启动

2. **配置连接**
   - 点击右上角设置图标
   - 选择模式：
     - **Interpreter 模式**：使用后端代码执行功能（推荐）
     - **Direct Chat 模式**：直接连接 LLM（无代码执行）

3. **上传文件分析**
   - 点击附件图标上传文件
   - 支持 Excel、CSV、PDF 等格式
   - AI 会自动分析文件内容

4. **代码执行示例**
   ```
   用户：分析这个 CSV 文件，生成销售趋势图
   AI：执行 Python 代码 → 生成图表 → 自动显示
   ```

### 窗口操作

- **打开窗口**：双击桌面图标或从开始菜单启动
- **移动窗口**：拖拽窗口标题栏
- **最小化**：点击窗口标题栏的 `-` 按钮
- **最大化**：点击窗口标题栏的 `□` 按钮
- **关闭窗口**：点击窗口标题栏的 `×` 按钮
- **切换窗口**：点击任务栏中的应用图标

## 🔒 安全说明

后端代码执行环境已实现安全限制：
- 禁止导入危险模块（os、sys、subprocess 等）
- 限制文件访问范围（仅允许访问上传目录）
- 代码执行在隔离环境中进行
- 自动检测和阻止危险操作

## 🐛 故障排除

### 后端无法连接 LLM
- 检查 `docker-compose.yml` 中的 LLM 配置
- 确认 Ollama 服务正在运行（如果使用 Ollama）
- 检查网络连接和 API 密钥

### 文件上传失败
- 确认后端服务正在运行
- 检查 `backend/uploads` 目录权限
- 查看后端日志：`docker-compose logs backend`

### 前端无法访问后端
- 确认后端服务在 8000 端口运行
- 检查 CORS 配置
- 查看浏览器控制台错误信息

## 📝 开发计划

- [ ] 完善设置面板
- [ ] 添加更多应用程序
- [ ] 支持多用户登录
- [ ] 文件系统持久化
- [ ] 主题切换功能
- [ ] 快捷键支持

## 📄 许可证

本项目采用 MIT 许可证。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

如有问题或建议，请通过 Issue 联系。

---

**CloudOS AI** - 让 AI 助手成为你的桌面伙伴 🚀

