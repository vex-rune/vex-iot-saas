# 项目元信息

## 品牌

- **产品名**: Vex 云物联 / Vex IoT
- **官方网站**: `https://vexrune.top/` ⚠️ 这是营销/产品门户,**不是**控制台
- **控制台子域名(规划)**: `console.vexrune.top`
- **后端 API 子域名(规划)**: `api.vexrune.top`

## 品牌常量集中位置

前端任何"对外展示官网"的位置,统一从 `app/src/lib/env.ts` 引用:

```ts
OFFICIAL_SITE  // → 'vexrune.top'
OFFICIAL_URL   // → 'https://vexrune.top/'
APP_TITLE      // → 'Vex 云物联'
API_BASE       // → '/api'
```

**禁止在页面/组件里硬编码 `vexrune.top` 字面量**,必须走 `OFFICIAL_URL`。

## 仓库目录

```
.
├── service/      # Spring Boot 3 后端 (Java 21,单体)
├── app/          # React 18 + TS + Vite 前端管理后台
├── ops/          # 部署与运维(Nginx、Docker、脚本)
├── docs/         # 设计文档(PRD、概要、业务架构、UI 设计)
├── .clinerules/  # ⚠️ 项目唯一的规则源(由 Cline 自动加载)
└── README.md     # 仓库主页
```

## 前端技术栈

- React 18 + TypeScript 5
- Vite 5(构建/开发服务器)
- **HeroUI**(基于 Tailwind CSS 3) — **唯一 UI 来源**,禁止自造交互组件
- React Router v6
- @tanstack/react-query + axios
- Zustand(轻量状态)
- Recharts / React Grid Layout(看板可视化)
- @heroicons/react(若用到的图标必须先在 `src/types/globals.d.ts` 声明)

## 后端技术栈

- Spring Boot 3 + Java 21
- MongoDB(数据存储)
- Redis(缓存)
- EMQX(MQTT broker,设备接入)

## 设计约束(必须遵守)

1. **颜色/间距/圆角**一律消费 HeroUI 语义 token,禁止新增自定义 hex 颜色变量。
2. **外链**必须 `target="_blank" rel="noopener noreferrer"`。
3. **环境变量**前端以 `VITE_` 前缀;`ImportMetaEnv` 类型扩展在 `app/src/types/globals.d.ts`。
4. **不要提交** `.env` 等本地私密配置;`.env.*` 已在 `.gitignore`。
