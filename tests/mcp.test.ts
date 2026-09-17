import { it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createApp } from "../apps/server/src/app";
import template from "../examples/ticket_route.v1.json";
import { fixture } from "./fixture";
import { register } from "../apps/pi-extension/index";
it("HTTP, SDK MCP and Pi use the same pinned release and authorization; offline bridge registers tools", async () => {
  const home = mkdtempSync(join(tmpdir(), "jev-mcp-")),
    s = await createApp({
      home,
      port: 17423,
      provider: fixture,
      testMode: true,
    });
  const client = new Client({ name: "contract-test", version: "1" });
  let transport: StdioClientTransport | undefined;
  try {
    await s.app.listen({ host: "127.0.0.1", port: 17423 });
    const f = s.functions.create(template);
    await s.invoker.run(
      f.draft,
      { content: "退款" },
      { function_id: f.id, source: "preview" },
    );
    s.functions.publish(f.id, { draft_revision: 1, checksum: f.checksum });
    const c = s.clients.create("agent", "mcp", [
        { function_id: f.id, pinned_version: 1 },
      ]),
      path = join(home, "agent.json");
    writeFileSync(
      path,
      JSON.stringify({ endpoint: s.origin, token: c.token }),
      { mode: 0o600 },
    );
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        join(process.cwd(), "dist/mcp/index.js"),
        "--credentials-file",
        path,
      ],
      stderr: "pipe",
    });
    await client.connect(transport);
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual([
      "jev_list_functions",
      "jev_describe_function",
      "jev_invoke",
    ]);
    const args = {
      key: "ticket_route",
      version: 1,
      input: { content: "退款" },
    };
    const http = await fetch(s.origin + "/v1/functions/ticket_route/invoke", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + c.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ version: 1, input: args.input }),
    }).then((r) => r.json());
    const mcp: any = await client.callTool({
      name: "jev_invoke",
      arguments: args,
    });
    expect(mcp.isError).toBe(false);
    expect(mcp.structuredContent.data).toEqual(http.data);
    expect(mcp.structuredContent.meta.version).toBe(1);
    const tools: any[] = [];
    register({ registerTool: (t: any) => tools.push(t) }, path);
    const pi = await tools
      .find((t) => t.name === "jev_invoke")
      .execute("id", args, new AbortController().signal);
    expect(pi.details.data).toEqual(http.data);
    expect(pi.details.meta.version).toBe(1);
    s.clients.revoke(c.id);
    expect(
      (await client.callTool({ name: "jev_invoke", arguments: args })).isError,
    ).toBe(true);
    await s.app.close();
    expect((await client.listTools()).tools).toHaveLength(3);
    const offline: any = await client.callTool({
      name: "jev_list_functions",
      arguments: {},
    });
    expect(offline.structuredContent.error.code).toBe("BACKEND_UNAVAILABLE");
  } finally {
    await client.close();
    await transport?.close();
    await s.app.close();
    rmSync(home, { recursive: true, force: true });
  }
});
