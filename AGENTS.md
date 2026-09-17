# Jev Workbench 项目事实

- Node 24 / pnpm 11.9.0 / TypeScript；React+Vite SPA，由Fastify同源托管；better-sqlite3。
- 基础需求书：specs/v1/spec.md；单页左右布局/删除/双语的已确认修订：specs/single-page/spec.md。末尾补充用户授权的离线演示模式与当前运行端范围。
- 命令：pnpm typecheck；pnpm build；pnpm test；pnpm test:e2e。
- 生产默认127.0.0.1:17420、~/.jev-workbench；演示17430、~/.jev-workbench-demo。测试使用临时目录及17423/17425/17426/17428/17429端口。
- 所有入口共用Invok​er；MCP/Pi只读专属凭证，不读DB/供应商Key。
- 禁止真实Provider失败后自动fallback；fixture仅显式测试/演示模式。发布必须检查当前checksum对应的成功preview及固定模型版本。
- 已发布release不可更新；草稿乐观锁；客户端Token不得获得admin能力。
- 不在日志、runs或Git保存原始输入/答案/密钥；saved test case是用户明确保存的例外。
- 运行端配置必须先plan后apply，仅操作本产品条目，冲突停止。不要为了验证把用户现有Agent配置静默改掉。
- 从项目根目录运行。构建产物在dist（git忽略），截图在.impeccable/review（git忽略），需pnpm build后测试已构建MCP和生命周期。
