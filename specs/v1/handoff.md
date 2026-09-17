# 实施交付状态

仓库从空目录建立。唯一合同spec.md，用户后续授权离线模拟（尚无Key）。

实现：React/Vite工作台、Fastify、SQLite迁移、严格DSL、Provider、版本发布、权限/会话/密钥、HTTP、SDK MCP、Pi扩展、配置计划/应用/撤销、后台CLI、独立演示模式。用户真实Agent配置未静默改动；Claude CLI实际验证限临时项目。

运行：`pnpm demo`打开17430与~/.jev-workbench-demo，常驻演示横幅，预置ticket_route@1/四样例/受限API凭证。正式17420已停止，无Key仍支持配置但拒绝推理。

验收入口与缺口：README.md、VALIDATION.md。真实供应商推理与四实际Agent模型调用待Key和运行端具备后验证；不计为当前模拟完成证据。

后续开发先读spec与上述两文件，无需依赖聊天。测试先build，因为MCP/生命周期使用真实dist。不要将demo数据库/凭证复制进仓库。原设计包仍在 /Users/yijunwang/Downloads/jev-workbench-design 未修改。

## 2026-09-18 最新用户纠偏：先出单页设计稿

用户认为页面复杂，要求Coss UI风格、一页集成、显露三种原语。已交付 `design/single-page/index.html` 中英交互稿，合同 `specs/single-page/spec.md`。预览 http://127.0.0.1:17431；Python HTTP server运行于exec session 6848。此稿尚未替换正式React。三原语/语言保留编辑/保存恢复/失败复核/响应式检查通过；独立review结论ship as interactive design draft。

Git初始提交和molis-ai推送仍未执行。之前已查组织无同名库、授权创建私有molis-ai/jev-workbench；完成正式改版后继续，不把设计稿作为完整交付。

英文生产UI工作在用户纠偏时中断：新增 en.json/i18n.ts，主要UI已翻译，英文ticket示例与demo英文触发词已加入，typecheck通过。仍需：英文API错误/接入消息覆盖、README.en.md、双语正式E2E、最新build/test、清理scripts/internal两个临时i18n迁移脚本。当前demo17430仍为纠偏前构建。不要把旧20test通过记录冒充这些新改动已全面验收。
