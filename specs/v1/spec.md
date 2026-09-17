# Jev Workbench v1 — 本地浏览器版开发规格

**范围：**单用户、本机运行、官方 Jev 云端推理、可配置判断函数、HTTP API、MCP 与 Pi 扩展。  
**资料核验：**2026-09-18。本文中的路径、接口、配置格式、限制和页面交互，除明确标注官方事实外，均为本产品的拟议设计。  
**交付性质：**本文是开发规格；配套 HTML 是无后端的交互原型。没有实际调用 Jev，没有在用户机器上安装或接入任何 Agent。

## 1. 产品定义与首版边界

用户在浏览器里配置“输入 → 问题 → 规则 → 输出”，试跑后发布为不可变版本。业务服务通过配置 Key 调用 HTTP API；Claude Code、Codex、OpenCode 通过 MCP 调用；Pi 通过原生扩展调用。所有入口共享一个执行引擎和同一份发布配置。

首版必须完成：函数管理、输入字段配置、多问题配置、输出映射与复核规则、草稿试跑、样例保存、发布/回退默认版本、受限调用凭证、HTTP API、MCP 桥、Pi 扩展、配置变更预览与恢复、基础调用记录、启动与停止。

首版明确不做：OpenJev 权重下载和本地推理、桌面安装包、云端多租户、聊天界面、代理主模型流量、工作流 DAG、任意脚本/SQL/Shell 执行、自动操作业务系统、Webhook、定时任务、持久化作业队列、Redis、结果缓存、付费/配额体系、操作系统开机启动。

“本地”指管理界面、配置、凭证管理、调用入口和记录在本地；发送给 Jev 的 state/questions 仍然传到 TypeSafe。正式产品界面常驻显示“本地管理 · 云端推理”。[S1][S2]

产品的成功路径：启动服务 → 浏览器设置 Key → 建立函数 → 填样例测试 → 发布 v1 → 创建客户端并授权 → curl 成功 → Agent 成功调用同一版本。

## 2. 技术选择

| 层 | 选择 | 约束 |
|---|---|---|
| 运行环境 | Node.js 24 LTS、TypeScript、pnpm workspace | 仓库提交精确 lockfile 与 packageManager；不在生产启动时拉 latest |
| 前端 | React + Vite + Tailwind CSS + shadcn/ui | SPA，不需要 SSR、Next.js 或另一台前端服务 |
| 前端状态 | TanStack Query 管服务器数据；React Hook Form 管编辑表单 | 不再并行引入全局 Redux/Zustand 保存同一份草稿 |
| 编辑器 | 普通表单优先；CodeMirror 6 编辑 JSON/查看 diff | JSON 与表单共享一份结构化数据，不维护两套真值 |
| HTTP 服务 | Fastify，单进程模块化单体 | 同时托管构建产物、管理 API、业务 API |
| 持久化 | better-sqlite3 + 原生 SQL 迁移 | 单本机数据库，不引入 ORM 抽象或数据库服务器 |
| 校验 | Zod 校验固定 API/config 合同；Ajv 校验用户函数的输入/输出 JSON Schema | 严格限制可用 JSON Schema 子集；无远程 $ref |
| Jev 适配 | Node 原生 fetch + AbortSignal + 显式、有限重试 | 两个上游端点，避免 SDK 与外层重复重试 |
| MCP | 官方 TypeScript SDK 的稳定版本，stdio transport | 独立轻量进程；不得自行拼凑 MCP 协议 |
| Pi | TypeScript 原生扩展 | 只注册工具并请求本机 API，不拦截 Agent 循环 |
| 测试 | Vitest、Fastify inject、Playwright、MCP SDK Client | 先离线合同测试，再带 Key 做明确授权的真实联调 |

目前 Node 24 为 LTS；Vite 与 shadcn/ui 提供 React/Vite 安装路线；MCP 官方 SDK 支持 stdio。[S8][S9][S10][S11]

由于本版不做 OpenJev 本地推理，没有理由再为了模型加载引入 Python、PyTorch 或独立 GPU worker。前后端与 Pi 共用 TypeScript 合同即可。

## 3. 架构与运行形态

```text
浏览器 UI ─────────── 管理 API（本机会话） ───────┐
业务服务 ──────────── 业务 API（受限 Token） ─────┤
Claude/Codex/OpenCode → MCP stdio bridge ────────┤
Pi → 原生扩展 ────────────────────────────────┤
                                               ▼
                                     Fastify / 单一执行引擎
                                      ├─ 配置与发布版本
                                      ├─ 凭证与授权
                                      ├─ 输入映射、规则、输出映射
                                      ├─ 日志元数据
                                      └─ Jev Provider → TypeSafe API
                                               │
                                         本机 SQLite
```

正式运行只监听 `127.0.0.1:17420`。浏览器访问 `http://127.0.0.1:17420`，静态文件、API 同源，无需 Nginx。开发时可使用 Vite 5173 并把 API 代理到 17420；开发 Origin 白名单必须单独开启。

关闭浏览器只关闭界面，不会终止 Node 服务。前台运行时终端退出或 Ctrl-C 会停止服务；要跨终端关闭继续运行，必须使用本项目实现的 `service start` 后台模式，不能把 Vite dev server 当后台守护服务。

每个 MCP 客户端可各自启动一个轻量桥，但这些桥不读数据库、不持有 TypeSafe Key、不启动另一个业务后台，只用自己的受限凭证访问已有服务。

远程服务器上的 localhost 指向远程服务器，而不是用户电脑；本版不承诺通过 localhost 服务云端业务。需要云端部署时，同一后台另行部署，并补充网络、TLS 和多用户边界。

## 4. 领域模型：函数不是一条问题

```text
Function
  ├─ Key / 展示名称 / 草稿 / 当前默认版本 / 开关
  ├─ Release v1（不可变配置快照）
  ├─ Release v2（不可变配置快照）
  └─ Test cases（用户明确保存的输入与断言）

Client
  ├─ kind = api / mcp / pi
  ├─ 独立调用凭证
  └─ Grants：可调用的函数与固定版本
```

一份 Release 包括：format_version、完整名称/描述/when_to_use、provider/model、input_schema、state_mapping、questions、review、output_mapping、output_schema。展示说明也是版本快照的一部分；主列表的 display_name 可独立修改，但不能悄悄改变已发布工具的契约。

Function Key、客户端 Token、TypeSafe API Key 分属三个命名空间。`ticket_route` 是公开标识，不是密码；随机客户端 Token 用来鉴权；供应商 Key 只供后台使用。

函数 Key 首次发布后不可修改。函数内 question id 和 Choice option key 也应视为业务契约，修改必须发新版本；单次 Jev 请求里的 question id 不等于我们持久化函数的 Key。

## 5. 官方 API 适配边界

上游事实：评估端点为 `POST https://api.typesafe.ai/v1/systemone`，Bearer 鉴权；请求是 `{model,state,questions}`，回答按 question id 放进 answers；模型列表为 `GET /v1/models`。[S1][S3]

| 类型 | 请求 criteria | 主要答案 |
|---|---|---|
| Noul | 可选 true/false 描述 | noul：是的概率；没有独立 confidence |
| Choice | 选项 key → 描述/null | choice、probabilities、confidence |
| Score | 有序等级描述数组，至少两个等级 | score、legend、probabilities、confidence；等级索引从 0 起，score 可以是小数 |

当前官方模型文档列出 `jev-1.13.0`。GET models 当前可能只返回别名；不要因为固定版本没出现在列表里就判定无效。正式发布要求固定版本，允许用户从一次真实试跑的 resolved_model 确认；别名可用于草稿探索，但不得静默留在生产 Release。[S3]

Choice/Score 的 confidence 是概率分布的统计量，不是业务正确率。Noul 不能伪造 confidence；例如 0.2–0.8 设为复核区间只是用户策略。阈值不内置成“通用正确答案”。[S4]

同一请求的问题独立看到同一 state，不能消费彼此答案。首版一个函数只发一批独立问题，后处理组合结果；明确依赖前一步答案的多阶段流程暂不做。[S5][S6]

本产品首版仅接收 JSON/文本内容，不读任意文件路径、不下载用户 URL、不解析 PDF/图片。需要处理文件的调用方先取出文本再传入。官方 state 当前也是文本内容承载，不是本机文件句柄。[S7]

## 6. 配置 DSL：有限声明式，不执行代码

完整示例见 `ticket_route.v1.json`。它是本产品格式，不是可以直接发给 TypeSafe 的请求。后台把 state_mapping 与 questions 编译为官方请求，其余字段在本地执行。

### 6.1 输入

v1 表单支持 string、number、boolean、string[]，以及这些字段的必填/说明/长度或数值范围。根输入必须是 object，默认 additionalProperties=false。高级 JSON 编辑只允许同一子集，不支持任意 $ref、执行代码或远程 schema。

不隐式把字符串转数字，不静默删掉未知字段，不悄悄截断正文。缺字段/类型错返回字段级错误。可选字段缺失时对应 state 字段省略；必填字段在校验阶段已经拦截。

### 6.2 state_mapping

`{"ticket_text":"/content"}` 表示从校验后的 input 读取 /content，组成 `{ticket_text: ...}`。路径使用 JSON Pointer 语义，读取自有属性；禁止 __proto__、constructor、prototype 等危险路径段。不引入 Jinja、eval 或字符串模板展开。

问题说明写在配置里；用户文本始终作为数据放入 state，不用于生成后台代码或配置路径。此做法不承诺消除模型层面的提示注入，只限制软件执行边界。

### 6.3 questions

一个函数允许 1–16 个问题（本产品保守上限，不是官方硬限制），Choice 可设置 2–32 个选项。官方问题形态映射保持直接；选项稳定 key 与显示中文名分开。每个问题必须有完整 instructions，不能仅靠 question id 传达含义。

### 6.4 复核规则

`review.match` 支持 any/all；rules 为空时永不触发复核。每条规则是 id/source/operator/value。

- eq/ne：同类型严格相等或不等。
- lt/lte/gt/gte：仅比较有限数值。
- in：标量存在于常量数组。
- between_exclusive：数值严格落在 `[min,max]` 两端之间；等于端点不匹配。

不支持字符串作为数值、任意函数、正则代码执行或跨函数调用。读取路径不存在、类型不匹配是配置/上游合同错误，不能当作规则未命中。

当任意或全部指定规则命中时，业务 status 为 needs_review，并返回命中的 rule id。它是一次完成的判断，不是 HTTP 失败。

### 6.5 输出映射

每个目标字段拥有 source，可选 enum_map，可选 on_review。来源首版限定 /answers/... 和 /input/...；先提取源值，再做全覆盖枚举映射，最后应用 on_review 覆盖。on_review 字段缺失表示保留原值；显式 null 表示复核时置空。enum_map 缺少某个可能值时发布失败。

字段类型由来源与 on_review 推导生成 output_schema；高级模式允许在兼容范围里进一步收紧，不允许声明与推导类型冲突的 schema。每次返回前仍然校验实际 data。

首版不允许任意字符串生成、不允许覆写整个 HTTP response 或自定义状态码，只允许定制 data 的字段。业务服务可以转发统一外壳，或仅取 data 返回自己的接口。

## 7. 执行引擎与返回合同

所有入口调用同一个 `invokeFunction(principal,key,version,input,signal)` 应用服务。

1. 校验本机 Host/Origin 与客户端 Token；获取真实 client id，不信任调用者自报的来源。
2. 查找函数授权，解析已发布版本：固定授权只能使用该版本；未固定授权可以指定一个发布版本，省略时取 active_version。
3. 读取不可变配置快照，校验函数开关，并固定整个本次调用的 config checksum。
4. 校验请求大小与 input_schema；生成 state；创建不含原文的运行元数据。
5. 排队/限流后调用 Jev，传 model/state/questions。
6. 校验上游答案：问题齐全、类型吻合、选项属于 criteria、数值有限并在范围内、probabilities 与问题一致、model 信息可记录。概率和允许合理浮点容差，不私自重归一化。
7. 如果明确请求固定版本而上游返回了不同固定版本，返回 MODEL_VERSION_MISMATCH，不冒充原版本结果。
8. 计算复核规则，进行输出映射，验证 output_schema。
9. 写完成元数据，返回 data/status/meta。

数据库事务不得包住网络等待。发布事务很短；推理中只保留内存配置快照。

示意成功返回（非真实模型结果）：

```json
{
  "status": "ok",
  "data": {"department": "billing"},
  "review_reasons": [],
  "meta": {
    "request_id": "req_example",
    "function_key": "ticket_route",
    "version": 1,
    "model": "jev-1.13.0",
    "config_checksum": "sha256:..."
  }
}
```

示意复核返回：

```json
{
  "status": "needs_review",
  "data": {"department": null},
  "review_reasons": ["low_confidence"],
  "meta": {"request_id":"req_example","function_key":"ticket_route","version":1,"model":"jev-1.13.0","config_checksum":"sha256:..."}
}
```

外部返回不默认暴露 state、questions、原始 answers 或供应商错误全文。管理页试跑可以看到输入、生成请求、原始答案、规则匹配和最终返回；这些调试原文默认仅在当前浏览器内存中存在。

### 7.1 可靠性默认值

本产品初始值：输入 HTTP body 256 KiB、默认 content 上限 12000 字符、全局上游并发 4、等待队列 16、总调用预算 30 秒（包括排队/重试）、客户端建议 timeout 35 秒。均是起始配置，不是性能承诺或官方额度。字段字符数也不等于 token 数；仍要正确处理上游输入限制。

仅对明确的 429/529 响应最多重试一次，遵循合法 Retry-After、加入抖动并受总 deadline 约束。网络超时、连接在响应前断开可能已消耗推理额度，v1 不自动重试这类结果不明的请求。采用 fetch 时只在适配层重试，未来换 SDK 必须关掉双层重试。[S1]

取消通过 AbortSignal 传递；若请求已送到供应商，不承诺取消一定停止上游推理或计费。服务启动时将遗留 running 标记为 interrupted，不自动重放。

**v1 不实现持久化幂等或结果缓存。**重复调用可能再次计费、结果也可能不同；不宣称 exactly-once。后续确有重复流量再实现 Idempotency-Key，并单独设计版本解析、输出保留时长、隐私及“响应丢失但已推理”的状态。不要在首版用一个简单 input hash 冒充幂等保证。

### 7.2 错误合同

错误统一为 `{error:{code,message,fields?},meta:{request_id}}`，不带伪造判断 data。

| HTTP | code 例子 | 行为 |
|---|---|---|
| 400 | BAD_REQUEST | 非法 JSON/固定接口参数错 |
| 401 | INVALID_CLIENT_TOKEN | 调用方凭证缺失、无效或撤销 |
| 403 | FUNCTION_FORBIDDEN / VERSION_FORBIDDEN | 函数或版本未授权 |
| 404 | FUNCTION_NOT_FOUND / VERSION_NOT_FOUND | 未找到可用资源；注意授权后控制枚举信息 |
| 409 | DRAFT_REVISION_CONFLICT / CONFIG_CHANGED | 草稿或外部配置发生并发变更 |
| 413 | INPUT_TOO_LARGE | 输入超出本产品限制 |
| 422 | INPUT_SCHEMA_INVALID / CONFIG_INVALID | 字段级校验错误 |
| 502 | UPSTREAM_AUTH_FAILED / UPSTREAM_INVALID_RESPONSE / MODEL_VERSION_MISMATCH | 上游或供应商配置错误，不误报客户端 Token 错 |
| 503 | PROVIDER_NOT_CONFIGURED / FUNCTION_DISABLED / LOCAL_BUSY / UPSTREAM_BUSY | 当前不能提供服务 |
| 504 | UPSTREAM_TIMEOUT | 调用超出预算 |

上游 422 用 UPSTREAM_INPUT_REJECTED 明确返回，保留经脱敏的可操作说明；供应商 401 不转换成“你的业务 Token 错了”。needs_review 返回 200，因为调用和判断确实完成。

## 8. API 路由

### 8.1 业务 API（Bearer 受限凭证）

| 方法与路径 | 内容 |
|---|---|
| GET /v1/functions | 当前客户端可见函数及可调用版本；用于 MCP list |
| GET /v1/functions/:key?version=N | 获取获授权版本的说明、input_schema、output_schema，不暴露内部问题/规则 |
| POST /v1/functions/:key/invoke | `{version?:number,input:object}`；省略版号按授权规则解析 |
| GET /health/live | 进程是否存在，公开但不返回本机路径/凭证/配置 |

```bash
curl http://127.0.0.1:17420/v1/functions/ticket_route/invoke \
  -H "Authorization: Bearer $JEV_CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version":1,"input":{"content":"我的订单被重复扣款，请协助退款。"}}'
```

生产调用文档默认复制显式版本。Token 的 pinned_version 为 1 时，省略 version 也只能使用 1；请求 2 必须失败。UI 勾选函数时默认建立固定版本授权。

### 8.2 管理 API（本地管理员会话 + CSRF）

| 方法与路径 | 内容 |
|---|---|
| POST /api/admin/bootstrap | 消耗一次性本机引导 token，建立浏览器会话 |
| GET /api/admin/status | DB/供应商 Key/最近模型测试/本地端口状态 |
| GET/POST /api/admin/functions | 列表/新建草稿 |
| GET /api/admin/functions/:id | 草稿、revision、发布版本、绑定摘要 |
| PUT /api/admin/functions/:id/draft | 带 If-Match 的完整草稿保存；成功 revision + 1 |
| POST /api/admin/functions/:id/preview | 提交当前编辑快照及样例，不隐式保存草稿 |
| POST /api/admin/functions/:id/publish | 保存版本并可设为默认，必须核对 draft_revision 和配置校验和 |
| POST /api/admin/functions/:id/activate | 切换默认已发布版本，不改历史快照 |
| PATCH /api/admin/functions/:id | 只更新展示名、enabled、archived 状态等管理字段 |
| GET/POST/DELETE /api/admin/functions/:id/test-cases[/caseId] | 用户保存与删除样例 |
| POST /api/admin/functions/:id/test | 对选定草稿/版本跑保存样例，返回字段断言结果 |
| GET /api/admin/runs | 分页元数据；可按函数/来源/状态筛选 |
| GET/POST/PATCH /api/admin/clients | 查询、创建或更新授权；凭证创建时仅显示一次 |
| POST /api/admin/clients/:id/revoke | 立即撤销凭证，正在执行的调用不保证追溯取消 |
| PUT /api/admin/provider | 保存或替换 TypeSafe Key；GET 只返回 configured/masked 状态 |
| POST /api/admin/provider/test | 查询模型列表；显式试跑按钮才发送一条小型付费判断 |
| POST /api/admin/integrations/detect | 在固定支持位置检查 CLI/配置，用户提供路径只做显式验证 |
| POST /api/admin/integrations/plan | 生成安装动作与脱敏 diff，不落盘 |
| POST /api/admin/integrations/apply | 验证原文件 hash 后应用固定动作 |
| POST /api/admin/integrations/:id/test | MCP 初始化/列工具/本机 HTTP 校验，不冒充模型真实调用 |
| POST /api/admin/integrations/:id/remove | 仅移除本产品拥有的条目，先检查冲突 |

端点可以在工程中按 REST 风格细化，但不能混淆管理和调用权限。运行端拿到的 Token 不能调用任何 /api/admin/*。

## 9. 持久化、版本与恢复

完整初始化 SQL 见 schema.sql。核心表：functions、releases、test_cases、clients、client_grants、runs、installations、app_settings、audit_events；另有迁移版本表。

草稿保存采用 `If-Match: "draft-7"` 乐观锁。多个标签页冲突返回 409，界面提供重新载入/复制本地草稿，不直接覆盖。

发布步骤：规范化并计算 config checksum → 检查映射及 schema → 检查当前快照至少有一条真实试跑完成的记录 → BEGIN IMMEDIATE → 再核对 draft_revision → 分配 max(version)+1 → 插入 release → 可选更新 active_version → 写审计事件 → COMMIT。试跑仅证明链路/合同可用，不代表任务准确率已校准。离线 CI 使用明确 test mode 允许 fixture 发布，正式模式不接受 fixture 作为真实联调证明。

当页面有未保存更改时，“发布”先执行保存及测试有效性检查；不会把旧草稿发布后声称新编辑已生效。

回退默认版本只改变 active_version。固定版本调用不受影响；界面显示“默认版本 v2，仍有 3 个客户端固定 v1”。老版本不可原地修改，不复用版本号。初始规格删除采用归档；用户后续明确要求已由specs/single-page/spec.md修订为可恢复回收站与确认永久删除，历史版本不会因撤销默认而消失。

SQLite 放本机磁盘，开启 WAL/FULL/busy_timeout。一个服务进程作为主要读写者，MCP 桥不得直接打开 DB。WAL 允许读写并行但仍是单写者，不适合共享网络盘。[S12]

备份使用 SQLite 在线备份接口，不直接复制运行中的单个 .db 文件；导出函数不包含密钥、客户端 Token、其他 runtime 配置或原始调用内容。发布/接入配置变更写小型审计记录。

## 10. 安全与隐私边界

### 10.1 本地浏览器也需要权限边界

绑定 127.0.0.1，校验完整 Host 与 Origin，拒绝未知 Origin；不能用 CORS 通配来替代鉴权。业务服务/MCP 的无 Origin 请求需要有效 Bearer。公开 /health/live 信息最少化。MCP 官方 transport 安全建议也强调 localhost 绑定、Origin 检查和认证。[S13]

启动 CLI 生成 256 位随机、一次性、60 秒有效的引导 token，用 URL fragment 打开浏览器。浏览器立即从地址栏移除 fragment，将 token POST 换为 HttpOnly、SameSite=Strict 会话 Cookie；状态修改还需 CSRF token。HTTP loopback 下不依赖 Secure cookie 标记提供 HTTPS 安全，不对外暴露该服务。临时凭证不写到 localStorage、普通日志或 URL query。

管理会话在内存中保存；服务重启后用 `service open` 重新引导。无注册登录、无第三方账号，不为单机首版造用户体系。

### 10.2 三类密钥

- TypeSafe Key：优先从启动环境读取；从页面设置时加密保存为 secrets.json。使用 Node crypto AES-GCM，随机 nonce，主密钥存受本机文件权限保护的 master.key。环境变量生效时页面标注来源，避免“保存了但未生效”。
- Client Token：随机 256 位，数据库仅存 SHA-256 哈希与展示前缀；首次创建仅显示一次。MCP/Pi 的原始 Token 保存在 owner-only 凭证文件，runtime 配置只引用该路径。
- 管理引导/会话 token：短期、本机，不复用作业务 Token。

目录权限 0700，凭证与备份 0600；Windows 后续适配 ACL，首版验收以 macOS 为主。主密钥与密文仍在同一用户机器上，不宣称能抵抗已取得同用户文件访问权限的进程。客户端授权是应用级隔离，不是 OS 沙箱。

### 10.3 内容处理

默认不保存调用原文、state、questions 快照或完整 answers 到运行日志。只记录函数/版本、客户端、状态、耗时、实际模型、token usage、规则 id 和脱敏错误。调试原文在当前页面刷新后丢失；“保存为样例”是单独明确动作并提示其包含的业务内容。

禁止任意 URL 抓取、文件路径读取、Shell 模板、表达式 eval、自定义上游 Base URL。Provider 地址固定在官方域名，避免把配置工具变成 SSRF 或任意代码执行服务。模型不是安全沙箱，不能把置信度当作行为权限。

## 11. Agent 接入

### 11.1 统一暴露的三类工具

v1 保持固定工具表，减少动态 schema 热更新差异：

| 工具 | 入参 | 返回 |
|---|---|---|
| jev_list_functions | 无/分页 | 当前凭证可用的 Key、描述、when_to_use、版本 |
| jev_describe_function | key、可选 version | input_schema、output_schema、简明使用说明 |
| jev_invoke | key、可选 version、input | 同 HTTP 的 status/data/meta |

第一次发现函数可用 list/describe，后续直接 invoke。可选随安装附带简短 Skill 说明何时调用，但不声称安装后 Agent 必然调用。以后确有体验需要再按函数注册原生具名工具；首版不同时维护两套工具模式。

### 11.2 MCP 桥

stdio 的 stdout 只写协议消息，日志写 stderr。使用 SDK 初始化与 tool response；返回 structuredContent 并兼顾文本 JSON。调用失败使用 isError，不将 needs_review 标为工具错误。bridge 只读其专属凭证文件及 endpoint；不读取供应商 Key 或 DB。

后台未启动时仍尽快完成 MCP 工具注册；实际调用返回 BACKEND_UNAVAILABLE 及启动说明，不为每个客户端自动启动一份后台。请求取消与 deadline 从桥传到后台。

Claude Code 和 Codex 提供 MCP add 命令；OpenCode 的本地配置使用 type=local 和 command 数组。[S14][S15][S16]

以下路径属于开发完成后的生成示例，不是现成已发布的命令：

```bash
claude mcp add --transport stdio --scope user jev-workbench \
  -- /absolute/node /absolute/project/dist/mcp/index.js \
  --credentials-file /absolute/home/.jev-workbench/clients/claude.json

codex mcp add jev-workbench \
  -- /absolute/node /absolute/project/dist/mcp/index.js \
  --credentials-file /absolute/home/.jev-workbench/clients/codex.json
```

```json
{
  "mcp": {
    "jev-workbench": {
      "type": "local",
      "command": ["/absolute/node", "/absolute/project/dist/mcp/index.js", "--credentials-file", "/absolute/home/.jev-workbench/clients/opencode.json"],
      "enabled": true
    }
  }
}
```

### 11.3 Pi

Pi 扩展使用 `pi.registerTool()` 注册上述三个工具，转发到本机 API，并传递 execute 的取消信号。全局扩展可放 `~/.pi/agent/extensions/`，项目扩展放 `.pi/extensions/`；遵从项目信任与 `/reload` 机制，不注入工具拦截 hook。[S17]

提供一个受版本控制的完整扩展包，包含 package.json 与所需依赖；不可只复制一个依赖缺失的 TS 文件。credential path 独立于项目仓库。首版 Pi smoke test 采用 `pi -e /absolute/path/to/extension`，安装完成后再测自动加载。

### 11.4 安装配置的正确流程

浏览器不直接读写用户配置文件，执行操作的是已启动且认证的本机后台。后端仅实现四种固定适配器，没有“传入任意 shell 命令”的通用接口。

检测版本/路径 → 生成固定动作与 diff → 用户确认 → 备份当前文件 → 再检查文件 hash → 用 CLI 或结构化 AST 修改本产品条目 → 原子写入/验证 → 连通性测试。JSONC 必须保留注释；TOML/JSON 避免整体粗暴重写。CLI 用 spawn 参数数组，shell=false。

Claude/Codex 优先官方 CLI，未知版本先停在生成命令页，不猜配置路径。OpenCode 使用 JSONC-aware 编辑器。操作对象按 user/project scope 精确选择，不扫描整个 home。卸载只撤销本产品条目；现有配置已被用户修改则提示冲突，不用旧全文件备份覆盖其后续工作。

状态区分：未检测到、可配置、已写入、初始化已验证、最近调用成功、冲突/错误。写入配置不等于 Agent 已加载，更不等于真实模型调用成功。多 runtime 同 UID 下无法提供强安全身份认证；不同 Token 用于最小授权与审计归因。

## 12. 前端信息架构

只保留两个主导航，设置与历史为次级入口：

```text
判断函数 /functions
  └─ /functions/:id
       基本信息、输入、问题、输出/规则
       右侧试跑面板
       版本抽屉 / 调用抽屉 / 记录抽屉
调用与接入 /connections
  ├─ API 调用
  └─ Agent 接入
设置：全局右上角抽屉
```

默认首页是函数列表，不是 KPI 仪表板。空列表引导“创建判断函数”，给“工单分流 / 证据核验 / 内容相关性”三个可编辑示例，不显示虚构使用量。

### 12.1 视觉规范

- 桌面优先，参考 1440×960。全局侧栏 200–208px；内容 padding 28–32px；编辑主列 flex:1,min-width:480px；试跑列 380–420px；gap 24px。
- 1280px 以下试跑面板移到编辑器下方并改为横向双列；900px 以下侧栏收成图标栏，保持单列编辑；更窄时试跑内容继续堆叠，最小支持 768px。手机只保证可读，不把手机编辑列为首版验收目标。
- 页面背景 #F7F8FA，面板 #FFFFFF，侧栏 #F3F5F8；主字 #20252D，次字 #596473，边框 #E2E6EC；主操作 #405BCF。
- 字体使用系统 sans（包括中文回退），标题24/20px，正文14px，标签12px，代码13px；关键说明不低于12px。
- 8px 间距系统，输入高36–40px，主要按钮40px，圆角8px，边框1px。列表优先于堆叠卡片；无大面积渐变、玻璃效果、营销插画和跳动指标。
- 状态同时带文字，不只依赖颜色。error=红、review=琥珀、published=绿色；草稿是中性标签。
- 正式数据图仅展示模型返回的概率分布，标明“模型概率 / 非正确率”。不展示伪造精确耗时、成功率或可信度。

### 12.2 函数列表

列：名称与用途、Key、当前默认版本、草稿状态、启用状态、最近调用状态、操作。上方只有搜索、启用筛选和新建。点击一行进入详情，省去二级卡片墙。

空状态区分“尚无函数”“搜索无结果”“读取失败”；错误保留上次数据并显示重试，不把失败画成空列表。

### 12.3 函数编辑页

顶部：面包屑、名称、只读 Key、当前发布 vN、草稿已修改标识；右侧“保存草稿”“发布新版本”。另有“版本”“调用”次要按钮。

中间四个 tab：

1. **基本信息**：名称、Key、用途、when_to_use、固定模型版本。when_to_use 提示为工具说明，不是触发器。
2. **输入**：字段名/类型/必填/描述/边界；增删字段；从样例 JSON 推导初始字段；输入 schema 预览。
3. **问题**：问题列表；增加 Noul/Choice/Score；id、说明、criteria；Choice 的稳定选项 key 与中文说明分列；Score 等级支持拖动但提示等级索引会变化；保存后仍是草稿。
4. **输出与规则**：字段映射表，来源 dropdown，返回名，复核时置空；any/all 复核条件；示例输出和 output_schema。高级 JSON 与表单双向同步。

右侧试跑面板：输入表单/JSON切换 → 选择保存样例 → “测试当前编辑” → 结果。按钮边注明“发送至 TypeSafe，可能计费”。允许取消请求。未完成请求时只显示真实的处理中状态，不伪造阶段进度。

结果分为“最终返回 / 原始答案 / 实际请求 / 规则命中”四个视图；真实完成后显示版本或草稿 checksum、provider/model、耗时。草稿试跑显示“未发布”，不会伪装成 v1。

用户修改任何影响执行的配置后，之前结果立刻标记“来自旧配置”，发布前需重新试跑当前快照。单次试跑不标记“校准完成”。

### 12.4 发布与版本抽屉

显示当前草稿对上一版的 diff、输入/输出破坏性变更、样例测试结果、固定模型、发布说明。发布按钮文案“发布 v2 并设为默认”，可取消“设为默认”。显示哪些固定客户端仍在 v1，不默认替它们升级。

回退动作只选择已发布版并改变默认指针；明确说明固定版客户端不受影响。未保存离开提示保存/放弃/取消，不能用自动发布替用户决定。

### 12.5 调用与接入 — API

左侧选择函数及版本，右侧呈现 endpoint、所需 input 字段、响应示例和 curl/Python/TypeScript 标签。示例从已发布 schema 生成，不单独硬编码维护。

客户端列表包括名称、授权函数/版本、Token 前缀、最近请求、撤销。创建凭证时默认不授权任何函数，用户勾选后展示一次明文；复制代码使用 `$JEV_CLIENT_TOKEN` 占位，不把明文凭证存浏览器 localStorage。

“测试调用”不能暗用管理员身份：用户刚创建并仍持有凭证时可在内存中测试，或粘贴已有客户端 Token 后发送；后台以真实业务 principal 校验。测试结束清除页面凭证变量，不持久化。

### 12.6 调用与接入 — Agent

四张卡：Claude Code、Codex、OpenCode、Pi。展示检测信息、授权函数与固定版本、配置范围、状态。按钮按阶段变为“生成接入配置 → 查看变更 → 应用 → 测试 → 撤销”。

凭证文件路径是生成配置的一部分，但不要把实际 Token 放进 diff。连通性测试明确标注是否只测连接，用户显式点击才触发实际付费判断。真实 Agent 是否加载工具需要 bridge 初始化遥测或实际调用证据，不能凭 DB 里存在 installation 就显示“已连接”。

### 12.7 设置与记录

设置：供应商 Key（掩码/替换）、模型列表/测试、端口/本机路径只读、内容出境提示、并发/超时高级设置、导出无密钥配置、后台状态。修改端口需重启并提示连接配置同步。

调用记录不单独占主导航；通过函数详情或接入页打开抽屉。行展示时间、函数版本、来源、状态、真实耗时、模型、使用量；error与needs_review分开。默认无原始内容，不能在详情里凭空“回放”一个未保存的请求。只有保存样例才能明确重跑。

### 12.8 交互与可访问性

Tab 可达所有控件；label与错误文本绑定；焦点可见；Escape关抽屉并返回触发位置；弹窗锁定焦点；支持 Cmd/Ctrl+S 保存草稿、Cmd/Ctrl+Enter 试跑。快捷键在普通文本域遵守合理行为，不吞掉必要编辑输入。

每个异步操作具备 idle/pending/success/error；避免重复提交。表单校验显示字段路径，如 questions.department.criteria，而不是只给“参数错误”。网络错误不得清空未保存输入。

## 13. 工程目录与模块边界

```text
jev-workbench/
  apps/
    web/src/
      pages/FunctionList.tsx
      pages/FunctionEditor.tsx
      pages/Connections.tsx
      features/functions/{InputEditor,QuestionEditor,OutputEditor,Playground}.tsx
      features/releases/ReleaseDrawer.tsx
      features/connections/{ApiPanel,AgentPanel,ConfigDiffDialog}.tsx
      features/settings/SettingsDrawer.tsx
      lib/api.ts
    server/src/
      app.ts
      routes/{admin,invoke,health}.ts
      services/{functions,invoke,clients,integrations}.ts
      engine/{validate-input,map-state,validate-answer,review,map-output}.ts
      providers/typesafe.ts
      storage/{db,repositories,migrate}.ts
      security/{session,client-token,secret-store,origin}.ts
      integrations/{claude,codex,opencode,pi}.ts
      lifecycle/{start,stop,open}.ts
    mcp/src/index.ts
    pi-extension/{index.ts,package.json}
  packages/contracts/src/{config,http,provider}.ts
  migrations/001_initial.sql
  examples/ticket_route.v1.json
  tests/{unit,integration,mcp,e2e,fixtures}/
  scripts/{build,start,service}.mjs
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  .nvmrc
```

避免为每个函数生成独立 Node 服务；不让 UI、MCP、Pi 分别实现判断规则。契约可共享，存储和执行逻辑只能在后台。Provider 做小接口封装，但首版不构造一个通用插件市场。

## 14. 启动、数据目录与后台生命周期

开发者拿到最终实现仓库后，目标运行命令是：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

以上是要求项目实现的脚本，设计包本身不是该可执行仓库。首次启动自动迁移 SQLite、创建权限受限目录、检查端口、输出本机地址并打开一次性会话引导页。无 TypeSafe Key 时界面照常可编辑，但试跑与调用显示“供应商未配置”，不能返回 mock 冒充真实结果。

后台模式脚本目标：

```bash
pnpm jev service start
pnpm jev service status
pnpm jev service open
pnpm jev service stop
```

后台启动记录 instance id/PID/端口，健康探针验证同一实例，避免 PID 复用误杀。端口占用时失败并给改端口方案，不随意换端口导致 Agent 断连。stop 先停止接受新调用，有限等待并取消剩余请求，再关闭 DB；不是对任意 PID 调用 kill。

```text
~/.jev-workbench/                 # 0700
  data/workbench.db
  secrets.json                   # AES-GCM 密文，0600
  master.key                     # 0600，不导出
  clients/claude.json             # 本机调用 Token，0600
  clients/codex.json
  clients/opencode.json
  clients/pi.json
  backups/                       # 可能含用户原始配置，0600 文件
  logs/server.log                # 脱敏、轮转
  runtime/instance.json
```

禁止同一目录起两个后台。备份/重启/升级都要可重现；升级依赖按 lockfile，SQLite driver 的原生二进制必须在目标 macOS ARM64/x64 上验收，不能宣称所有平台零编译安装。若某平台没有预构建二进制，说明安装前提或提供已验证的分发包，不在启动时盲目装编译器。

## 15. 测试与验收

| 范围 | 必测事项 |
|---|---|
| 纯执行引擎 | 三种问题、任意/全部规则、阈值边界、on_review=null、缺失路径、枚举映射完整性、输出 schema |
| Provider 合同 | 缺答案、错 question type、未知选项、越界/非有限数值、损坏 JSON、模型版本不匹配、429/529、供应商401 |
| 发布 | 草稿不影响v1、revision冲突409、同事务版本分配、旧版本不可改、回退默认不影响固定版 |
| 鉴权 | 缺Token401、越权403、已撤销Token失败、API客户端访问admin失败、list不能泄露未授权函数 |
| 前端 | 空/错/加载状态、键盘操作、编辑保留、旧测试标记、保存样例、发布diff、Token只展示一次 |
| 配置安装 | 现有MCP保留、JSONC注释保留、路径含空格、文件hash冲突、重复安装幂等、只撤销自己的条目 |
| 进程 | 端口冲突、二次启动、后台断开、关闭浏览器继续运行、服务重启恢复、未配Key |
| 隐私 | URL/日志无秘密、数据库runs无原文、导出无Key、外部Origin被拒、默认不监听局域网 |
| 跨入口 | 相同 fixture + 相同版本 + 相同输入，HTTP/MCP/Pi结果合同一致 |
| 真实联调 | 官方API与四个实际runtime分别调用一遍，记录实际版本/平台/结果；未运行的平台标为未验证 |

Mock provider 只能由明确测试/演示模式启用，并显示永久横幅；绝不能在真实服务错误时自动 fallback 到样例。

真实模型多次判断可能存在差异，跨入口真实联调验证的是同一配置、相同授权和正确合同，不要求浮点数逐次完全一致。概率或单个例子也不能证明模型在业务上准确；准确性需要独立标注集。

最小端到端验收故事：

1. 在空数据目录启动，浏览器打开，设置 Key，确认云端出境提示。
2. 创建 ticket_route，添加 content 字段、四分类问题、复核规则和输出映射。
3. 测试明确工单与模糊工单，查看实际请求/答案/输出，保存样例。
4. 发布 v1，创建只允许 ticket_route@1 的业务 Token，用 curl 得到符合合同的结果。
5. 修改草稿仍不影响 v1，发布 v2 后固定 v1 的客户端仍返回 v1 元数据。
6. 创建四个 Agent 凭证并接入；通过三类工具找到并调用函数。
7. 上游超时表现为错误，不出现默认分类；撤销一个凭证只影响该凭证后续请求。
8. 关闭浏览器再打开，后台和发布版本仍存在；服务停止后所有调用返回明确不可用。

## 16. 实施顺序

**阶段 A：最小纵向链路。**初始化工程、固定合同、SQLite迁移、会话鉴权、单个函数配置导入、Provider、invoke、curl。此时不先画完所有页面，也不接四种 runtime。

**阶段 B：函数工作台。**列表/编辑器、试跑、样例、草稿乐观锁、不可变发布、真实 API 返回。先做完“配置 → 测试 → 发布 → curl”。

**阶段 C：调用管理。**客户端凭证、固定版本授权、API示例生成、日志元数据、错误与重试策略。

**阶段 D：Agent 接入。**先 MCP bridge 与 SDK Client 测试，再 Claude/Codex/OpenCode 配置适配，最后 Pi 扩展。每个适配器必须有配置fixture和实际目标版本测试记录。

**阶段 E：交付收尾。**同源生产构建、后台生命周期、配置diff与安全撤销、备份与迁移、Playwright整链路、README与平台兼容矩阵。

每阶段都要有可运行的入口，禁止所有按钮先用定时器/假数据模拟，最后才接后端。完成标准是实际业务 API 和四种接入路径，而不是仅完成 HTML 页面。

## 17. 给 Coding Agent 的实施约束

以本规格为唯一首版范围，交付真实可运行的本地浏览器应用。先实现HTTP纵向链路，再接UI和Agent。不得增加聊天、模型下载、多租户、云端账号、工作流画布或主模型代理。不要改变用户的主模型配置。

不要把 prototype.html 当成正式代码直接宣称产品完成；它只用于对齐信息架构和视觉。所有 mock 必须隔离在test/demo环境，正式Provider必须请求官方API。配置层禁止任意JS、SQL、Shell执行；配置变更只能用固定适配器。

交付必须包含 lockfile、迁移、示例、单元测试、集成测试、MCP测试、端到端测试、启动/停止脚本、平台兼容记录及未验证项。不要用“已配置”代替“已实际调用验证”，不要用一次试跑代替业务准确率评测。

## 18. 官方资料索引

以下链接供实现时复核，运行端和模型能力可能更新；本文不承诺后续版本的命令或接口保持不变。

- [S1] TypeSafe HTTP API：`https://docs.typesafe.ai/api`
- [S2] Quickstart：`https://docs.typesafe.ai/introduction/quickstart`
- [S3] Models：`https://docs.typesafe.ai/models`
- [S4] Confidence：`https://docs.typesafe.ai/confidence`
- [S5] Primitives：`https://docs.typesafe.ai/primitives`
- [S6] Fan-out：`https://docs.typesafe.ai/patterns/fan-out`
- [S7] State：`https://docs.typesafe.ai/concepts/state`
- [S8] Node releases：`https://nodejs.org/en/about/previous-releases`
- [S9] Vite：`https://vite.dev/guide/`
- [S10] shadcn/ui + Vite：`https://ui.shadcn.com/docs/installation/vite`
- [S11] MCP TypeScript SDK：`https://ts.sdk.modelcontextprotocol.io/`
- [S12] SQLite WAL：`https://www.sqlite.org/wal.html`
- [S13] MCP transport说明：`https://modelcontextprotocol.io/specification/2025-06-18/basic/transports`
- [S14] Claude Code MCP：`https://code.claude.com/docs/en/mcp`
- [S15] Codex MCP：`https://developers.openai.com/codex/mcp/`（核验时重定向至官方 ChatGPT Learn）
- [S16] OpenCode MCP：`https://opencode.ai/docs/mcp-servers/`
- [S17] Pi extensions：`https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md`
- [S18] better-sqlite3：`https://github.com/WiseLibs/better-sqlite3`
- [S19] Fastify：`https://fastify.dev/docs/latest/Reference/Server/`

## 实施补充（2026-09-18，用户本轮确认）

用户尚无 TypeSafe Key，明确要求“先模拟一下数据完成其他”。因此本轮交付增加独立离线演示：`pnpm demo`，端口17430，目录 `~/.jev-workbench-demo`；常驻模拟横幅，并内置正常、复核、错误、超时场景。正式服务17420仍只调用固定官方端点，无 Key 返回明确错误，绝不自动降级。演示发布记录带 fixture 标记，正式发布不接受它作为真实试跑证明。真实云端及四个实际 Agent 的付费调用联调列为未运行，不影响本轮模拟验收。

接入实施：OpenCode JSONC、Pi 扩展支持结构化写入；本机已核验命令参数的 Claude Code 2.1.206 / Codex 0.154.0 使用 CLI。未知 CLI 版本仅准备凭证与命令；Codex CLI 暂无项目范围 add 参数，因此项目范围保留人工配置路径，不假称用户范围为项目范围。外部配置变更仍需在产品内查看变更后点击应用。

### 双语与代码交付追加（用户明确授权）

保留中文界面，新增English切换并持久化语言偏好（仅语言可存localStorage，绝不存Token/Key）。两种语言覆盖导航、编辑表单、试跑、版本、接入、设置、空态、错误提示；切换语言不修改用户配置内容或丢失未保存编辑。新增英文示例与README.en.md。完成中文/英文端到端验收后提交Git，并推送到组织molis-ai；没有同名仓库时创建私有molis-ai/jev-workbench，不覆盖其他仓库。

### 最新单页设计纠偏
用户要求先重出 Coss UI 风格的单页设计稿，直接暴露三种原语并减少跳转。设计稿合同见 `specs/single-page/spec.md`；设计稿之后用户明确“改，改完开发”，已授权并完成正式左右工作台；后续目录图片补充要求已加入紧凑分组、类型标签与回收站。实现复用已有引擎，验收以正式UI与API测试为准。
