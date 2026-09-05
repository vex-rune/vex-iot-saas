# Vex IoT 项目 — Cline 规则索引

> 本目录由 Cline 自动加载,**是本项目唯一的规则源**。本文件是入口,告诉模型"何时该读哪份规则"。

## 触发器(必读)

**任何代码任务开始前**,按下列场景先读对应摘要,再动手:

| 场景 | 必须先读 |
|---|---|
| 任何代码改动前(默认行为) | `.clinerules/02-coding.md` `.clinerules/03-architecture.md` |
| 改前端 list/CRUD 页、PC/移动适配、HeroUI 用法 | `.clinerules/04-web.md` |
| 改后端 Java/Spring/Entity/Repository | `.clinerules/05-server.md` |
| 改前端信息架构、TopBar、登录页、菜单 | `docs/07-后台管理端UI设计.md` |
| 改部署、Nginx、Docker、域名 | `ops/README.md` |

> ❗ 不要跳过这一步。即便任务看似简单,先读一遍规则能避免破坏项目既有约定(命名、样式、文件结构)。

## 本目录文件职责

| 文件 | 用途 |
|---|---|
| `00-index.md` | 本文件 — 触发器与索引 |
| `01-meta.md` | 项目元信息(品牌、官网域名、技术栈、目录约定) |
| `02-coding.md` | 编码准则摘要 — **任何任务都默认适用** |
| `03-architecture.md` | 前端分层架构(api/service/hooks) — **任何前端任务都默认适用** |
| `04-web.md` | 前端列表/CRUD 规范摘要 |
| `05-server.md` | 后端 Java/Entity 规范摘要 |

> 摘要即全部,**不依赖任何外部 `rules/` 目录**。若摘要与项目实际不符,以项目现状为准并请同步修正摘要。

## 一句话准则

> **先读 `02-coding.md` + `03-architecture.md`,再按场景读 `04-*.md` 或 `05-*.md`。**
