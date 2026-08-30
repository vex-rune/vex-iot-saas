# Vex 云物联 — Web 管理后台 (app/)

> 🌐 官方网站: **<https://vexrune.top/>**
> 本目录是 Vex 云物联 **管理后台 SPA** 源码;官网首页是另一份独立的营销/产品页。

## 技术栈

- **React 18 + TypeScript 5** — UI 框架
- **Vite 5** — 构建/开发服务器
- **HeroUI (NextUI v2) + Tailwind CSS 3** — 组件库与样式系统
- **React Router v6** — 路由
- **@tanstack/react-query + axios** — 数据请求
- **Zustand** — 轻量状态管理
- **Recharts / React Grid Layout** — 看板与可视化

## 目录

```
app/
├── public/        # 静态资源(直接拷贝到 dist)
├── src/
│   ├── api/       # 后端接口封装
│   ├── components/
│   │   ├── panel/     # 可拖拽看板(仪表盘)
│   │   └── common/    # 通用组件
│   ├── hooks/     # 自定义 React Hooks
│   ├── lib/       # 通用工具(env、http、权限、storage、格式化)
│   ├── pages/     # 路由级页面
│   ├── stores/    # Zustand stores
│   ├── styles/    # 全局样式
│   └── types/     # TS 全局类型
├── .env.development   # 开发环境变量
├── .env.production    # 生产环境变量
├── index.html
├── package.json
└── vite.config.ts
```

## 环境变量

> ⚠️ 所有变量必须以 `VITE_` 前缀,才能在 `src/lib/env.ts` 通过 `import.meta.env` 访问。

| 变量 | 用途 | 示例 |
| --- | --- | --- |
| `VITE_API_BASE` | 后端 API 反代前缀 | `/api` |
| `VITE_APP_TITLE` | 应用名(显示用) | `Vex 云物联` |
| `VITE_OFFICIAL_SITE` | 官方网站裸域名(显示用) | `vexrune.top` |
| `VITE_OFFICIAL_URL` | 官方网站完整 URL(链接用) | `https://vexrune.top/` |

> 所有"官网/品牌"展示位(登录页底部、顶栏地球图标、PWA `og:url` 等)均**统一引用** `src/lib/env.ts` 中的常量,不要在页面里硬编码。

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 本地开发 (默认 http://localhost:5173)
npm run build        # 生产构建(类型检查 + Vite build)
npm run preview      # 预览生产产物
npm run typecheck    # 仅做 TS 类型检查
npm run lint         # ESLint
```

## 与官网 (`vexrune.top`) 的关系

- 本控制台通过顶栏"🌐 地球图标"或登录页底部链接跳转到 **vexrune.top**。
- 部署时建议使用子域名(例如 `console.vexrune.top`)反代本 SPA 静态产物,详见 [`ops/nginx/nginx.conf`](../ops/nginx/nginx.conf)。
- SEO / Open Graph 已经在 [`index.html`](./index.html) 中统一指向 `https://vexrune.top/`。

## 设计约束

- 颜色、间距、圆角一律消费 HeroUI 语义 token,**禁止**新增自定义 hex 颜色变量。
- 任何外部链接必须携带 `target="_blank" rel="noopener noreferrer"`。
- 严禁把 token / 凭据提交到仓库;`.env*` 已经 `.gitignore`。
