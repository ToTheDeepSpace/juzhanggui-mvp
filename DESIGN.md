---
version: alpha
name: 泡泡宇宙 (Bubbleverse)
description: 剧司辰 · 灵契 · 红黑榜统一设计语言。戏剧感 × 东方美学 × 现代SaaS。
colors:
  # ── 共享底色 ──
  ink: "#0F1117"
  ink-light: "#1A1D27"
  paper: "#F5F3EE"
  paper-dim: "#E8E4DB"
  primary: "#1B6B6B"
  primary-light: "#2D9D9D"
  
  # ── 剧司辰 ──
  jsc-primary: "#1B6B6B"
  jsc-primary-light: "#2D9D9D"
  jsc-accent: "#C9A84C"
  
  # ── 灵契 ──
  lq-primary: "#6B3FA0"
  lq-primary-light: "#8B5FBF"
  lq-accent: "#D4A843"
  lq-rose: "#E8C4C4"
  
  # ── 红黑榜 ──
  rbb-red: "#C0392B"
  rbb-red-light: "#E74C3C"
  rbb-black: "#1A1A1A"
  rbb-green: "#27AE60"
  rbb-gold: "#F39C12"
  
  # ── 语义色 ──
  success: "#27AE60"
  warning: "#F39C12"
  error: "#E74C3C"
  info: "#3498DB"

typography:
  h1:
    fontFamily: "Noto Serif SC, serif"
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  h2:
    fontFamily: "Noto Serif SC, serif"
    fontSize: 1.75rem
    fontWeight: 600
    lineHeight: 1.35
  h3:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.4
  body-lg:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.7
  body-md:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.04em"
  number:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: 0.9375rem
    fontWeight: 500

rounded:
  none: 0
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  "2xl": 48px
  "3xl": 64px

shadows:
  card: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)"
  elevated: "0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)"
  modal: "0 8px 32px rgba(0,0,0,0.25)"
  glow-gold: "0 0 20px rgba(201,168,76,0.3)"
  glow-purple: "0 0 20px rgba(107,63,160,0.3)"

components:
  # ── 共享组件 ──
  button-primary:
    backgroundColor: "{colors.jsc-primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.jsc-primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "10px 24px"
  button-ghost-hover:
    backgroundColor: "rgba(255,255,255,0.08)"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
  
  card-default:
    backgroundColor: "{colors.ink-light}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  
  input-default:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  
  tag-default:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "{colors.paper-dim}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  
  # ── 剧司辰专属 ──
  jsc-schedule-card:
    backgroundColor: "{colors.ink-light}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  jsc-status-confirmed:
    backgroundColor: "{colors.jsc-primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
  jsc-status-pending:
    backgroundColor: "rgba(201,168,76,0.15)"
    textColor: "{colors.jsc-accent}"
    rounded: "{rounded.sm}"
  
  # ── 灵契专属 ──
  lq-profile-header:
    backgroundColor: "linear-gradient(135deg, {colors.lq-primary}, {colors.ink})"
    rounded: "{rounded.xl}"
    padding: "{spacing.2xl}"
  lq-contract-card:
    backgroundColor: "{colors.ink-light}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  lq-badge-verified:
    backgroundColor: "{colors.lq-accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
  
  # ── 红黑榜专属 ──
  rbb-post-card:
    backgroundColor: "{colors.ink-light}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  rbb-upvote:
    backgroundColor: "transparent"
    textColor: "{colors.rbb-green}"
  rbb-upvote-active:
    backgroundColor: "rgba(39,174,96,0.12)"
    textColor: "{colors.rbb-green}"
  rbb-downvote:
    backgroundColor: "transparent"
    textColor: "{colors.rbb-red}"
  rbb-downvote-active:
    backgroundColor: "rgba(192,57,43,0.12)"
    textColor: "{colors.rbb-red}"
  rbb-star-badge:
    backgroundColor: "{colors.rbb-gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
---

## Overview

泡泡宇宙 (Bubbleverse) 是剧司辰、灵契、红黑榜的统一设计语言。三者共享暗色底盘（ink #0F1117）、东方衬线标题（Noto Serif SC）、克制留白——各自通过专属主题色和微交互建立独立人格。

- **剧司辰**：深海青 + 古铜金，理性可靠，像剧场后台的挂钟。
- **灵契**：紫罗兰 + 暖金 + 玫瑰，神秘而温柔，像一卷展开的契约。
- **红黑榜**：嫣红 + 墨黑 + 翠绿，直接有力，像用朱砂笔在宣纸上判词。

---

## Colors

### 共享底色

| Token | 值 | 用途 |
|--------|-----|------|
| `ink` | #0F1117 | 全局背景，所有产品通用 |
| `ink-light` | #1A1D27 | 卡片、面板、输入框 |
| `paper` | #F5F3EE | 正文、主要文字 |
| `paper-dim` | #E8E4DB | 辅助文字、标签 |

### 剧司辰

- **Primary (#1B6B6B)**：深水绿，传达稳、可信。按钮、tab 激活态、状态标签。
- **Accent (#C9A84C)**：古铜金。时间选择器、高亮日期、VIP 标识。少量点缀，不喧宾夺主。

### 灵契

- **Primary (#6B3FA0)**：紫藤色。导航、主按钮、灵契师认证徽章。
- **Accent (#D4A843)**：暖金。契约签署动效、星标、付费入口。
- **Rose (#E8C4C4)**：樱花粉。委托状态、温柔提示、情感本标签。

### 红黑榜

- **Red (#C0392B)**：朱砂红。点踩、警告、删除确认。不可大面积使用。
- **Green (#27AE60)**：翠绿。点赞、好评、通过标识。
- **Gold (#F39C12)**：实名星标。后台认证后的荣誉标识。
- **Black (#1A1A1A)**：榜单位底色。与 ink 拉开一个色阶，让榜单区域有重量感。

### 语义色

`success`（绿）、`warning`（金）、`error`（红）、`info`（蓝）——跨产品统一，不做变体。

---

## Typography

**层级原则**：标题用衬线体（Noto Serif SC）建立东方仪式感，正文用无衬线（Noto Sans SC）保阅读效率，数字用等宽（JetBrains Mono）传递数据可信度。

- `h1` / `h2`：衬线，克制的大字号，不做超大 hero。
- `h3`：无衬线加粗，用于卡片标题和面板。
- `body-lg`：行高 1.7，保证中文长文本呼吸感。
- `label`：小号大写风格（letter-spacing 0.04em），用于 badge、tag、表头。
- `number`：等宽，数据表格和统计数字。

---

## Layout & Spacing

间距体系从 4px 到 64px，遵循 8px 基准。移动端卡片间距降至 `md`（16px），桌面端保持 `lg`（24px）起步。

关键规则：
1. 页面左右留白 ≥ 16px（移动）/ 32px（桌面）。
2. 卡片之间间距 = `md`（16px）。
3. 信息组之间间距 = `lg`（24px），用空行而非分割线。
4. 表单标签与输入框间距 = `sm`（8px）。

---

## Components

### 按钮
- `button-primary`：主操作。剧司辰用青，灵契用紫，红黑榜用红。
- `button-ghost`：次要操作，透明底 + 白色字，hover 时微亮。

### 卡片
- `card-default`：所有列表卡片基础款。8px 圆角，16px 内边距。
- 红黑榜 `rbb-post-card` 复用同一结构但颜色更重。

### 状态标签
- 剧司辰的排期状态：已确认=青底白字，待定=金底金字。
- 灵契的认证徽章：金色小圆点 + "已认证"。
- 红黑榜的实名星标：金色六角星 + "实名"。

### 红黑榜特有
- 点赞/点踩：默认灰色，激活后绿/红 + 10% 透明度底色。数字用 JetBrains Mono。
- "我是相关方"按钮：幽灵按钮 + 小盾牌 icon，不抢主视觉。

---

## Do's and Don'ts

### ✅ Do
- 标题用衬线体，正文用无衬线体。一个页面不超过一种衬线 + 一种无衬线。
- 暗色背景上，正文确保 `paper` 色（#F5F3EE），不用纯白刺眼。
- 卡片之间用留白间隔，不要加分割线。
- 数字用 JetBrains Mono，对齐右。

### ❌ Don't
- 不要在暗色背景上大片用纯黑或纯白——永远用 `ink` 和 `paper` 体系。
- 不要让红黑榜的红色覆盖面积超过 15% 屏幕——它应该是点缀，不是背景。
- 灵契不要用高饱和紫色做大面积背景，始终从 `ink` 出发渐变。
- 三个产品的主题色不要交叉使用——剧司辰上不出紫色，灵契上不出青色。
