# 开源标准整理与无 Key 合同核验

## 目标
按常见开源仓库标准整理本仓库，并用 TypeSafe 公开文档核验调用逻辑。没有 Jev API Key，不把模拟或文档对照写成云端已通。

## 范围
- 增加 LICENSE、SECURITY.md、CONTRIBUTING.md、CHANGELOG.md；README 去掉本机口述、补仓库/许可证/两条 API。
- 删除未使用导入、状态、依赖；GET `/v1/models` 不带无意义的 Content-Type。
- 按官方文档收紧 Score：`score` 须等于 `Σ i·P(i)`（容差 0.05）。
- 增加 `tests/official-contract.test.ts`：用公开示例核验官方 body、三种原语答案、Noul 无 confidence、函数路径的 model 回显规则。
- 更新 VALIDATION.md 测试计数与无 Key 边界。

## 非目标
- 不接真实 TypeSafe，不改函数/官方两条调用产品边界。
- 不删除仍可能被 CSS 选择器依赖的旧样式块。
- 不新增 CI 工作流。
