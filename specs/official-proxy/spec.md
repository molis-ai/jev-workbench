# 官方 Jev 调用入口

## 背景与目标
现有 `POST /v1/functions/:key/invoke` 只接受已发布函数的业务 `input`。用户需要另一条入口：本机服务保管 TypeSafe Key，调用方用客户端 Token，按官方合同传 `{model,state,questions}`，由 Workbench 转发到 TypeSafe。

完成等级：功能可用。无 Key 时正式服务返回 `PROVIDER_NOT_CONFIGURED`；本轮不要求真实云端往返。

## 范围
- 正式服务新增 `POST /v1/systemone`、`GET /v1/models`。
- 客户端增加显式能力 `official_invoke`，默认关闭。仅勾选后的 Token 可走这两条路由。
- 上游地址固定 `https://api.typesafe.ai`，调用方不能改。
- 判断函数、发布、函数授权、MCP/Pi 工具合同不变。
- 演示模式（`JEV_MODE=demo`）拒绝这两条路由，避免把模拟写成官方成功。

## 非目标
- 不开放自定义上游、不接收调用方自己的 TypeSafe Key。
- 不把官方透传混进 `/v1/functions/:key/invoke`。
- 不为 MCP/Pi 增加 raw 工具。
- 不把原始 state/questions/answers 写入 runs、日志或 Git。

## 调用合同
`POST /v1/systemone`，Bearer 客户端 Token。

```json
{
  "model": "jev-1.13.0",
  "state": "我的订单被重复扣款，请协助退款。",
  "questions": {
    "is_billing": {
      "type": "noul",
      "instructions": "这是账单或退款问题吗？"
    }
  }
}
```

成功时原样返回官方 `{model,answers,usage}`。响应头带 `x-request-id`。错误仍为本产品 `{error:{code,message},meta}`，供应商 401 不得变成 `INVALID_CLIENT_TOKEN`。

`GET /v1/models` 同样要求 `official_invoke`，转发官方模型列表。

## 授权与隔离
- 创建/编辑客户端时可开关 `official_invoke`；与函数授权独立，允许只开官方入口、不开任何函数。
- 未授权：403 `OFFICIAL_INVOKE_FORBIDDEN`。
- 撤销 Token 后两条路由 401。
- 客户端 Token 仍不能访问 `/api/admin`。
- 旧数据库迁移补列，默认 0，不重置已有客户端。

## 记录
runs 可记 request_id、client_id、模型、usage、耗时、错误码、`diagnostic_meta.official=true`。function_id/version 为空。不存问答正文。

并发/超时沿用 Invoker 的 Gate 与 30s 预算。

## 验收
- 无标志 Token 调 `/v1/systemone` 和 `/v1/models` 为 403；有标志 + fixture 返回官方 answers 形状，且不写入问答正文。
- 函数 invoke 不受影响；空函数授权但 `official_invoke=true` 仍可调官方入口。
- 演示模式 409 `DEMO_MODE`；缺 Key 的正式 Provider 为 503 `PROVIDER_NOT_CONFIGURED`。
- 迁移保留已有客户端，`official_invoke=0`。
- 管理页创建凭证可勾选该能力；英文文案存在。

验证：`pnpm typecheck`；`pnpm test`；`pnpm test:e2e`（现有故事不因默认关闭而失败）。
