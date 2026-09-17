# MCP

The stdio server is `dist/mcp/index.js --credentials-file <absolute-json>`.

The credential file is `0600` JSON: `{ "endpoint": "http://127.0.0.1:17420", "token": "..." }`. The token is a workbench client token, not a TypeSafe key.

## jev_list_functions

No arguments. Returns the functions this token may call, with version and schemas.

If the workbench is down, the tool still exists but the call fails with a start instruction (`pnpm jev service start`).

## jev_describe_function

Arguments: `key` (string), `version` (optional positive integer).

Returns `input_schema`, `output_schema`, `when_to_use`. Internal questions and review rules are not exposed.

## jev_invoke

Arguments: `key`, optional `version`, `input` object matching `input_schema`.

Success body includes `status` (`ok` | `needs_review`), `data`, and `meta` (`request_id`, `version`, `model`). `needs_review` means the judgment finished and a human should decide; do not treat it as authorization.

Pi uses the same three tools through the native extension, not MCP stdio.
