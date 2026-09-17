# 验收记录 · 2026-09-18

本轮完成等级：**功能可用（含真实 TypeSafe）**。2026-09-18 已用正式服务 Key 跑通配置→试跑→发布→HTTP 调用，以及官方 `/v1/systemone`。Agent 运行端提供可选的官方 TypeSafe skill 安装/卸载（确认前不写配置）；测试使用假 `npx`，不改本机 Claude/Codex。

## 环境与结果

macOS ARM64，Node v24.14.0，pnpm 11.9.0，better-sqlite3 12.11.1，MCP SDK 1.30.0；Chromium 153（Playwright 1.63）。

- `pnpm typecheck`：通过。
- `pnpm build`：通过，同源SPA、服务、MCP桥、完整Pi扩展包均生成；编辑器拆成独立chunk。
- `pnpm test`：31 项通过（含官方公开示例合同、官方入口授权隔离、归档/删除、MCP/Pi 同合同）。
- `pnpm test:e2e`：1条完整双语浏览器故事通过：创建Choice→试跑→保存样例→发布→未保存编辑→切换创建Noul/Score→英文编辑试跑→返回原函数保留草稿→固定授权HTTP调用→清除Token→归档/恢复→移入回收站/恢复/永久删除→搜索→手机→语言刷新持久化；无页面JS错误。
- 1440/1024截图核验；390px可读、无文档水平溢出。独立视觉review发现窄屏试跑分组和手机授权行两处问题，均已修复并复核resolved。截图在`.impeccable/review`。

## 按规格验收矩阵

| 规格范围 | 状态 | 证据及边界 |
|---|---|---|
| string/number/boolean/string[]输入、未知字段拒绝、无隐式转换 | 通过 | engine测试；表单及有限JSON Schema子集 |
| Noul、Choice、Score / any、all / 区间端点 / null复核输出 | 通过 | engine生产路径测试，明确概率不是正确率 |
| 缺失路径、危险路径、枚举映射不完整、模型不匹配、损坏答案 | 通过 | 发布/执行合同拒绝错误，不转默认分类 |
| 配置→试跑→发布→调用 | 通过（模拟） | 浏览器E2E + 演示服务实际HTTP调用 |
| revision冲突、旧版本不可变、v2不影响固定v1、回退 | 通过 | integration测试含DB最终状态和后续调用 |
| Token缺失、越权、撤销、列表隔离、admin隔离 | 通过 | integration测试；授权默认固定版，可显式跟随默认 |
| Host、Origin、会话、CSRF、一次性bootstrap | 通过 | integration测试；启动URL使用fragment，浏览器移除；重启会话失效 |
| 密钥加密、权限、runs不存正文、客户端Token仅哈希 | 通过 | 文件/DB实际检查，AES-GCM roundtrip；明确保存的样例除外 |
| 429/529有限重试、401/422与网络错误分类、并发排队与取消 | 通过（合同） | Provider和Gate测试；deadline贯穿网络等待；尚非云端压测 |
| 保存样例、运行断言、删除后状态 | 通过 | 持久化和断言测试；故意错误样例运行时预计失败 |
| HTTP/MCP/Pi共享同一版本与结果合同 | 通过（fixture） | SDK真实stdio子进程 + HTTP + Pi registerTool执行，撤销及离线后行为 |
| MCP离线仍注册工具、调用报不可用 | 通过 | 实际停止测试后台后SDK工具调用 |
| OpenCode JSONC保留注释、其他MCP、预览冲突、撤销保留后续修改 | 通过 | 临时目录含空格，真实文件读写及最终内容检查 |
| Pi安装/移除与工具转发 | 通过（文件与合同） | 生成加载文件、完整dist扩展包；未运行Pi CLI |
| Claude项目安装/撤销 | 通过（实际CLI） | Claude Code 2.1.206，隔离临时项目，保留已有与后增MCP；未发模型消息 |
| Codex用户配置安装、Claude用户范围 | 未运行 | 已核验本机CLI版本/命令参数；未改用户真实Agent配置 |
| OpenCode/Pi实际运行端自动加载 | 未运行 | 本机未安装两个CLI |
| 启停、重复启动、端口冲突、实例验证、重启恢复 | 通过 | 生命周期测试启动真实构建进程；不向未经验证PID发送kill |
| 缺Key正式启动与试跑 | 通过 | UI可编辑，Provider返回503 PROVIDER_NOT_CONFIGURED，不fallback |
| 离线演示与正式发布隔离 | 通过 | 独立端口/目录、常驻横幅；生产重新打开含fixture记录的库仍拒绝以其发布 |
| 官方 `/v1/systemone` 与 `/v1/models` 授权隔离 | 通过（fixture） | 无授权403、演示409、缺Key 503；问答正文不入库 |
| 公开 TypeSafe 文档中的 Noul/Choice/Score 答案形状 | 通过（无 Key） | `tests/official-contract.test.ts` 使用 2026-09-17 文档完整示例；Score 校验 Σ i·P(i) |
| GET `/v1/models` HTTP 形状 | 通过（mock transport） | 固定 `https://api.typesafe.ai/v1/models`，GET 不带 Content-Type |
| 真实TypeSafe与四个实际Agent的推理 | 部分通过（2026-09-18 真 Key） | 正式 17420：`GET /v1/models` 返回 `jev-latest`/`jev-preview` 别名；请求 `jev-1.13.0` 时响应 `model` 原样为 `jev-1.13.0`。函数试跑扣款工单 `ok/billing`，模糊工单 `needs_review/unclassified`；发布 v1 后客户端 invoke 同样 `ok/billing`，`simulated=false`。官方 `POST /v1/systemone` Noul 返回 `0.98` 且带 usage。四个 Agent 运行端仍未做真实工具推理。 |
| 业务准确率校准、macOS x64/Windows/Linux发布 | 未运行 | 不属于本机模拟通过能证明的结果 |

## 本次左右工作台追加验证

正式React界面已替换旧导航/列表页，左列表右内容，高级与接入原位展开。截图在`.playwright`。新增数据库v2迁移保留旧函数与样例；回收站可恢复并阻断业务调用，从Agent列表隐藏。永久删除仅允许回收站内函数，API事务清理该函数的versions/test cases/grants/runs，运行中拒绝且CSRF仍生效；其他函数和客户端保留。归档/恢复通过真实调用前后行为验证。三种原语的结果展示来自实际执行引擎返回，模拟状态明确。

中文/English覆盖主要表单、状态、新增/删除/接入与错误摘要。用户创作的配置、样例、历史文本不自动翻译，底层字段诊断保留原始信息。英文文档见README.en.md。

## 当前可复现演示

`pnpm demo`启动17430。预置工单分流v1与四个样例。

```sh
pnpm demo:call
pnpm demo:call '情况不清楚，需要复核'
pnpm demo:call '模拟错误'
pnpm demo:call '模拟超时'
```

前两条已得到 `ok/billing`、`needs_review/null`；后两条已得到502/504错误合同，脚本按预期退出1。模拟返回标记`meta.simulated=true`，不声称实际使用了模型。请求耗时是本机真实经历的模拟时间，不是模型性能。

## 当前限制

- Codex CLI用户范围可自动配置；项目范围没有对应CLI参数，只准备手动接入说明，不写错范围。
- 未知Claude/Codex版本只给命令与凭证准备，不自动修改配置。
- 服务升级需保留整个源项目及依赖，尚未做跨平台安装包/签名分发。
- 只有连接初始化测试时，不把状态显示为目标Agent已加载或模型调用成功。
