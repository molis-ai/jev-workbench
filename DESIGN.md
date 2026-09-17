---
name: Jev Workbench
description: 安静、清楚、以编辑和试跑为中心的本地判断函数工作台。
colors:
  primary: "#405bcf"
  primary-hover: "#344cbb"
  canvas: "#f7f8fa"
  surface: "#ffffff"
  sidebar: "#f3f5f8"
  text: "#20252d"
  muted: "#596473"
  border: "#e2e6ec"
  success: "#28704b"
  success-bg: "#e9f4ef"
  review: "#896018"
  review-bg: "#fff1d9"
  error: "#a73333"
  error-bg: "#fff4f4"
typography:
  headline:
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  title:
    fontSize: "17px"
    fontWeight: 650
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "14px"
  label:
    fontSize: "12px"
    lineHeight: 1.7
  code:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: "12px"
rounded:
  badge: "4px"
  control: "6px"
  panel: "8px"
spacing:
  field: "8px"
  row: "12px"
  section: "16px"
  panel: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "24px"
---

# Design System: Jev Workbench

## Overview

**Creative North Star: "安静的操作工作台 / Operate"**

延续既有浅色操作界面，不引入新的品牌世界。空间服务于输入、判断配置、试跑和接入；视觉重点落在当前动作与可验证状态。以系统中文字体、低对比背景、白色面板和克制的蓝色建立层次。

本文是当前实现的视觉记录；产品行为和验收范围仍以 `specs/v1/spec.md` 第 12 节及末尾演示授权为准。当前 CSS 的具体实现值记录在此，不把实现与合同之间的差异解释为新授权。

**Key Characteristics:**

- 两个主导航，设置与记录作为次级入口。
- 桌面编辑优先，试跑输入与结果保持完整分组。
- 状态用文字和颜色共同表达；演示数据始终明确标识。

## Colors

单一蓝色强调当前操作，冷灰底色承托白色工作区域。前置 token 的值来自当前样式。

### Primary

蓝色用于主按钮、焦点、选中标签和导航；悬停略加深。不要用强调色装饰整块内容。

### Neutral

画布、侧栏与白色面板通过轻微明度差分层；正文深灰，说明与标签使用次字色，细边框分隔区域。

### Status

绿色表达已发布或判断完成；琥珀色表达需要复核和来自旧配置；红色用于真实错误通知。草稿和未发布状态使用中性标签。

**The Visible State Rule.** 状态必须有明确文字；不能只靠颜色、圆点或图标证明成功、连接或发布。

## Typography

正文与控件采用同一系统 sans 字体栈及中文回退。代码使用系统等宽字体；不引入展示字体，品牌字母标记沿用 Georgia。

当前层级：页面标题使用 headline，编辑标题略小（23px），抽屉标题（20px），面板标题使用 title，小节标题（15px）；正文使用 body，表单与按钮（13px），说明与代码使用 label/code。段落行高（1.7），多行输入（1.6）。这些是当前实现值；合同中代码字号等要求仍由唯一需求书管理。

## Layout

固定侧栏（当前目录约 360px），顶栏（48px）。右侧内容区在桌面与 1024 宽被限制在一屏内：定义判断与试跑左右分列，默认态不出现页面纵向滚动；展开高级配置或接入时只在对应区域内滚动。字段与多行输入使用更紧凑的间距。

低于（700px）时，目录改到内容上方，编辑与试跑上下排列，允许整页滚动。授权行在宽屏并排勾选、函数 key 与版本；手机上逐项堆叠，长 key 可换行。完整编辑验收下限仍为（768px）；390 保证可读、无水平溢出。

## Elevation & Depth

页面以背景层次和细边框建立结构，普通面板没有阴影。只有覆盖式右侧抽屉使用遮罩和侧向阴影，表示临时进入次级任务；抽屉宽度为（min(620px, 95vw)）。阴影、动效与焦点完整参数保存在 sidecar。

按钮和选择框只有短促背景色过渡；抽屉短距离滑入。尊重减少动态效果设置，关闭动画和过渡。

## Shapes

面板轻圆角，表单和按钮采用更紧凑圆角，状态标签更小；避免胶囊化全部控件。常规分隔线与边框保持（1px）。空状态用虚线边界和足够留白，不填充虚构数据。

## Components

### Buttons

主操作为实心蓝底白字；次操作为白底细边框；危险动作使用红色文字。按钮最小高度（38px），禁用时半透明并显示不可操作光标。可见键盘焦点为蓝色外轮廓，不能以悬停代替焦点状态。

### Inputs / Fields

白底、灰边框、紧凑圆角，最小高度（38px）；标签位于上方，帮助文字跟随字段。多行编辑器可纵向调整；JSON 编辑区域独立滚动，长代码和返回内容不会撑破页面。

### Navigation

侧栏保留判断函数与调用接入两个主入口。选中项使用浅蓝底、蓝字与加重字重。图标栏继续保留操作名称的可访问说明。页内标签用底部蓝线，结果视图使用更轻的浅蓝选中底色。

### Panels and lists

白色面板以标题分隔线和内边距组织内容；列表用于函数与客户端记录，运行端选择保留独立卡片。无数据、无搜索结果和读取失败使用各自文案，错误不伪装成空内容。

### Preview input and result

输入组包括样例选择、表单/JSON 切换、编辑内容和测试动作；结果组包括状态、最终返回、原始答案、实际请求和规则命中。配置变更后以“来自旧配置”标签和重新试跑说明提示失效。未发布、等待输入、正在处理和失败均直说，不伪造进度或校准结论。

### Notices and demo state

说明使用浅蓝通知，错误使用浅红通知；状态通知和错误警报保留语义角色。离线演示在顶栏下方常驻显示“所有答案均为模拟，不发送网络请求、不产生费用”及场景触发提示；设置入口也标识离线模拟。演示不是正式 Provider 的失败降级，不能把模拟判断写成真实云端成功。

### Grants and runtime status

勾选、函数 key、固定版本选择的关联在所有宽度下保持可读。接入状态区分生成计划、写入配置、连接测试和实际调用证据；不能用选中外观或配置存在代替连接成功文字。

## Do's and Don'ts

### Do:

- **Do** 延续浅色 Operate 工作台和现有信息密度。
- **Do** 在响应布局中保持完整输入组、结果组及授权字段关联。
- **Do** 明确呈现旧配置、未发布、复核、错误和模拟状态。

### Don't:

- **Don't** 加入 KPI 首页、虚构用量或伪造的精确成功率。
- **Don't** 使用大面积渐变、玻璃效果、营销插画或跳动指标。
- **Don't** 把手机可读、模拟成功或连接配置存在写成完整编辑、真实推理或运行端已连接的证明。
