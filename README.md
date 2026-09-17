# Jev Workbench

中文 · [English](README.en.md)

本机浏览器里的判断函数服务：配置输入、问题、复核规则和输出，发布不可变版本，再由 HTTP、MCP 或 Pi 调用同一个执行引擎。

本轮已按要求提供完整离线演示。正式 TypeSafe Provider 已实现；由于没有 API Key，真实推理及四个实际 Agent 的模型调用尚未联调。详见 [VALIDATION.md](VALIDATION.md)。

## 单页工作台

左侧函数列表展示原语类型与草稿、发布、停用、归档状态，支持搜索、筛选和新增。目录按当前、归档、回收站分组计数，行内显示三原语标签与状态。条目菜单可停用、归档或移入回收站；归档及回收站都保留记录并停止业务调用，可恢复。只有回收站中的函数可以确认永久删除，正在执行时会拒绝；永久删除清除该函数的版本、样例、授权与运行记录，其他函数和客户端不受影响。

右侧直接编辑与试跑，Noul、Choice、Score各有结果展示。复杂输入、问题组合与输出规则在高级配置中展开，HTTP/MCP/Pi在当前内容下方接入。切换函数保留本次浏览器会话的未保存草稿与输入；业务内容不自动存localStorage，关闭/刷新有未保存提示。右上角切换中英文，用户编写的内容保持原文。

## 立即体验（无需 Key）

环境：Node.js 24，pnpm 11.9.0。当前机器已安装依赖、构建并启动演示。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm demo
```

浏览器自动打开 [本地演示](http://127.0.0.1:17430)，一次性引导会建立管理会话。常驻横幅明确所有答案为模拟，不访问 TypeSafe、不计费。

演示已预置 `ticket_route@1`、一个受限 API 客户端和四个样例：

| 输入 | 预期 |
|---|---|
| 我的订单被重复扣款，请协助退款 | `ok`，`department=billing` |
| 情况不清楚，需要复核 | `needs_review`，`department=null` |
| 模拟错误 | 502，`UPSTREAM_UNAVAILABLE` |
| 模拟超时 | 504，`UPSTREAM_TIMEOUT` |

可在函数编辑页选样例测试、修改配置、保存、重新试跑后发布 v2；固定 v1 的客户端不会自动升级。

```sh
pnpm demo:call
pnpm demo:call '情况不清楚，需要复核'
pnpm demo:call '模拟错误'  # 故意失败，退出码 1
pnpm demo:call '模拟超时'  # 故意失败，退出码 1
pnpm demo status
pnpm demo open
pnpm demo stop
```

演示数据独立保存在 `~/.jev-workbench-demo`，默认17430端口。`JEV_DEMO_HOME`、`JEV_DEMO_PORT`可指定隔离目录/端口。初始化只在空演示库运行一次，不覆盖已有编辑。API 演示凭证位于该目录下 `clients/demo-api.json`，权限0600；示例脚本读取它，不打印Token。

## 正式服务

```sh
pnpm start                  # 前台，Ctrl-C 停止
# 或：
pnpm jev service start      # 后台；自动打开浏览器
pnpm jev service status
pnpm jev service open       # 重开短期管理会话
pnpm jev service stop
```

正式地址 [127.0.0.1:17420](http://127.0.0.1:17420)，数据目录 `~/.jev-workbench`。生产启动从不安装依赖，也不会在供应商失败后切换到模拟数据。

先在设置中配置 TypeSafe Key，或由启动环境提供 `TYPESAFE_API_KEY`。环境变量优先；页面密钥使用 AES-GCM 加密保存，主密钥与密文仅限当前系统用户读取。不要在聊天、Git、日志或示例代码中放真实凭证。

正式成功路径：新建函数 → 编辑 → 填入样例 → 成功试跑 → 保存/发布固定模型版本 → 在调用与接入页创建固定版本授权 → 复制代码调用。无 Key 时仍能编辑，但推理返回 `PROVIDER_NOT_CONFIGURED`；演示试跑不能作为正式发布证明。

`JEV_HOME`与`JEV_PORT`可更换正式目录/端口；更换后需更新客户端配置。服务仅绑定127.0.0.1，不支持远端机器直接访问本机localhost。请从项目根目录运行脚本。

## HTTP 和 Agent

```sh
curl http://127.0.0.1:17420/v1/functions/ticket_route/invoke \
  -H "Authorization: Bearer $JEV_CLIENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"version":1,"input":{"content":"我的订单被重复扣款，请协助退款。"}}'
```

管理会话、客户端Token、TypeSafe Key相互独立。客户端创建时明文仅显示一次；库中只保存哈希。默认无授权，勾选函数后固定指定版本。`needs_review`是成功判断的业务状态，不是网络错误。

Agent 接入页提供检测、授权、范围选择、脱敏变更、应用、连接测试和撤销。应用会创建独立凭证文件，配置中只有文件路径。只操作 `jev-workbench` 条目；已有冲突会停止，不用整份旧备份覆盖用户后续修改。

- Claude Code 2.1.206：使用官方CLI；已在隔离项目目录实际验证安装/撤销和其他MCP保留。用户范围和实际 Agent 推理尚未验证。
- Codex 0.154.0：用户范围通过官方CLI；已核验命令参数，未修改用户现有配置进行实机安装。该CLI没有项目范围add参数，项目范围仅给手动配置说明，不能冒充用户范围。
- OpenCode：JSONC-aware 写入，保留注释和其他MCP；隔离文件测试通过。本机未安装运行端。
- Pi：生成引用完整构建扩展包的加载文件。共享工具合同测试通过，本机未安装Pi CLI。
- 未验收CLI版本：停在凭证/命令准备阶段，不擅自改写未知格式。

MCP桥固定注册 `jev_list_functions`、`jev_describe_function`、`jev_invoke`，后台离线时仍可初始化，调用返回启动说明。

```sh
node /absolute/project/dist/mcp/index.js \
  --credentials-file /absolute/home/.jev-workbench/clients/example.json
```

独立Pi扩展包在 `dist/pi-extension`（带package.json与typebox依赖声明）：

```sh
JEV_CREDENTIALS_FILE=/absolute/path/client.json pi -e /absolute/project/dist/pi-extension/index.js
```

安装页的Pi加载器直接传入专属凭证路径，无需为每个运行端共享环境变量。连接测试区分 `bridge_verified` 与 `http_verified`，不宣称目标Agent已经加载或模型调用成功。

## 开发与验证

```sh
pnpm typecheck
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

Vitest使用临时SQLite与明确注入的上游fixture；Playwright使用临时测试服务17425并显示测试模式。生命周期测试使用17426，MCP测试17423；演示17430、正式17420不受影响。测试不需要Key。

模块：`packages/contracts`共享DSL；`apps/server/src`负责持久化、权限、执行、Provider和接入；`apps/web/src`是React表单与试跑界面；`apps/mcp`和`apps/pi-extension`只转发到HTTP。

## 备份、恢复与升级

设置里的“备份数据库”调用SQLite在线备份接口。备份可能含用户明确保存的测试样例，权限0600。函数导出不含凭证、运行端配置或调用原文。

升级：停止服务 → 备份 → `pnpm install --frozen-lockfile` → `pnpm build` → 启动。数据库迁移记录在schema_migrations。手动恢复备份时先停止服务，将现有`data`目录整体移到安全位置，再将备份复制为新目录中的`workbench.db`，保持目录0700/文件0600；不要把运行中的单个DB文件与旧WAL混合覆盖。

异常退出：`pnpm jev service recover`（演示用`pnpm demo recover`）只在实例健康检查失败、原PID已不存在时清理锁；PID仍存在或没有足够实例信息时拒绝自动恢复。重启将遗留running标记interrupted，不重放推理。停止服务先关闭接入，3秒宽限后取消剩余请求。

## 已知边界

没有持久化队列、缓存、幂等保证、多租户、桌面安装包或本地模型。重复调用可能重复计费。模型概率与confidence不是业务正确率。macOS ARM64 / Node 24.14.0已运行，其他平台未验证；better-sqlite3若无目标平台预构建产物，可能需要本机编译工具。

需求书：[specs/v1/spec.md](specs/v1/spec.md)。官方上游合同：[TypeSafe HTTP API](https://docs.typesafe.ai/api)。
