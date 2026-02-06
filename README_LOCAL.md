# 📖 Local Testing Guide | 本地测试指南

[![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Gemini%20AI-blue.svg)](https://ai.google.dev/)

A step-by-step guide to set up and run the Magic Point-to-Read project locally on your machine.

在本地机器上设置和运行魔法点读笔项目的分步指南。

## 📋 Prerequisites | 前置要求

- **Node.js** (v18 or higher recommended / 推荐 v18 或更高版本)
- **npm** or **yarn**

## 🚀 Steps | 步骤

### 1. Install Dependencies | 安装依赖

```bash
npm install
```

### 2. Configure Environment Variables | 配置环境变量

Create or edit the `.env.local` file in the project root directory and add your Gemini API Key:

在项目根目录创建或编辑 `.env.local` 文件，添加你的 Gemini API Key：

```env
VITE_API_KEY=your_gemini_api_key_here
```

Or use:

或者使用：

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

**Important:** Environment variables must start with `VITE_` prefix so that Vite can access them in client-side code.

**重要提示：** 环境变量必须以 `VITE_` 开头，这样 Vite 才能在客户端代码中访问它们。

### 3. Start Development Server | 启动开发服务器

```bash
npm run dev
```

The development server will start at `http://localhost:3000`.

开发服务器会在 `http://localhost:3000` 启动。

### 4. Build Production Version (Optional) | 构建生产版本（可选）

```bash
npm run build
```

After building, you can preview with:

构建完成后，可以使用以下命令预览：

```bash
npm run preview
```

## 🔑 Getting Gemini API Key | 获取 Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
   使用你的 Google 账号登录
3. Create a new API Key
   创建新的 API Key
4. Copy the API Key to your `.env.local` file
   将 API Key 复制到 `.env.local` 文件中

## ⚠️ Important Notes | 注意事项

- The `.env.local` file is already in `.gitignore` and will not be committed to Git
  `.env.local` 文件已经在 `.gitignore` 中，不会被提交到 Git
- **Never commit your API Key to the code repository**
  **不要将 API Key 提交到代码仓库**
- If you modify the `.env.local` file, you need to restart the development server for changes to take effect
  如果修改了 `.env.local` 文件，需要重启开发服务器才能生效

## 🐛 Troubleshooting | 故障排除

### Port Already in Use | 端口已被占用

If port 3000 is already in use, Vite will automatically try the next available port. Check the terminal output for the actual port number.

如果端口 3000 已被占用，Vite 会自动尝试下一个可用端口。请查看终端输出以获取实际端口号。

### Environment Variables Not Working | 环境变量不工作

- Make sure the variable name starts with `VITE_`
  确保变量名以 `VITE_` 开头
- Restart the development server after modifying `.env.local`
  修改 `.env.local` 后重启开发服务器
- Check that the file is named exactly `.env.local` (not `.env.local.txt`)
  确保文件名完全为 `.env.local`（不是 `.env.local.txt`）

---

Happy coding! | 编码愉快！ 🎉
