# HTTP

Base: `http://127.0.0.1:17420` (or the port shown in the workbench). Host must be that loopback address. Header: `Authorization: Bearer <client-token>`.

## List and describe

```http
GET /v1/functions
GET /v1/functions/ticket_route?version=1
```

Describe returns schemas only. Do not expect `questions` or review rules.

## Invoke a published function

```http
POST /v1/functions/ticket_route/invoke
Content-Type: application/json

{"version":1,"input":{"content":"Please refund the duplicate charge."}}
```

Omit `version` only when the grant follows the default release.

## Official TypeSafe body

Requires the client grant **Allow official Jev calls**. Demo mode returns `DEMO_MODE`.

```http
POST /v1/systemone
Content-Type: application/json

{"model":"jev-1.13.0","state":"...","questions":{"is_billing":{"type":"noul","instructions":"Is this a billing question?"}}}
```

```http
GET /v1/models
```

Python `typesafe-sdk` can use this origin:

```sh
export TYPESAFE_BASE_URL=http://127.0.0.1:17420
export TYPESAFE_API_KEY=$JEV_CLIENT_TOKEN
```

## Errors

`401 INVALID_CLIENT_TOKEN`, `403 FUNCTION_FORBIDDEN` / `OFFICIAL_INVOKE_FORBIDDEN`, `422 INPUT_SCHEMA_INVALID`, `503 PROVIDER_NOT_CONFIGURED` / `FUNCTION_DISABLED`.
