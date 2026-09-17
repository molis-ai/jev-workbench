import { readFileSync } from "node:fs";
export type Credentials = { endpoint: string; token: string };
export function credentials(path: string): Credentials {
  const c = JSON.parse(readFileSync(path, "utf8"));
  const u = new URL(c.endpoint);
  if (
    u.protocol !== "http:" ||
    u.hostname !== "127.0.0.1" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/"
  )
    throw new Error("Credential endpoint must be loopback HTTP");
  if (typeof c.token !== "string" || !c.token)
    throw new Error("Credential token missing");
  return c;
}
export async function callBackend(
  c: Credentials,
  name: string,
  args: any,
  signal?: AbortSignal,
) {
  const base = c.endpoint.replace(/\/$/, "");
  let path = "/v1/functions",
    method = "GET",
    body: unknown;
  if (name === "jev_describe_function")
    path +=
      "/" +
      encodeURIComponent(args.key) +
      (args.version ? "?version=" + args.version : "");
  else if (name === "jev_invoke") {
    path += "/" + encodeURIComponent(args.key) + "/invoke";
    method = "POST";
    body = {
      input: args.input,
      ...(args.version ? { version: args.version } : {}),
    };
  } else if (name !== "jev_list_functions") throw new Error("Unknown tool");
  try {
    const r = await fetch(base + path, {
      method,
      headers: {
        Authorization: "Bearer " + c.token,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.any([
        AbortSignal.timeout(35000),
        ...(signal ? [signal] : []),
      ]),
    });
    const data = await r.json();
    return { data, error: !r.ok };
  } catch {
    return {
      data: {
        error: {
          code: signal?.aborted ? "CANCELLED" : "BACKEND_UNAVAILABLE",
          message: "请启动 Jev Workbench：pnpm jev service start；然后重试。",
        },
      },
      error: true,
    };
  }
}
