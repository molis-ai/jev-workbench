import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { credentials, callBackend } from "./client";
const path = process.argv[process.argv.indexOf("--credentials-file") + 1];
if (!process.argv.includes("--credentials-file") || !path)
  throw new Error("Pass --credentials-file /absolute/file.json");
const c = credentials(path),
  server = new McpServer({ name: "jev-workbench", version: "0.1.0" });
const schemas = {
  jev_list_functions: {},
  jev_describe_function: {
    key: z.string(),
    version: z.number().int().positive().optional(),
  },
  jev_invoke: {
    key: z.string(),
    version: z.number().int().positive().optional(),
    input: z.record(z.unknown()),
  },
};
for (const [name, inputSchema] of Object.entries(schemas)) {
  server.registerTool(
    name,
    {
      description:
        name === "jev_invoke"
          ? "调用已授权的判断函数。推理在 TypeSafe 云端，可能计费。needs_review 表示完成且需复核，不可当作自动执行权限。"
          : name === "jev_list_functions"
            ? "列出当前凭证授权的判断函数和版本。"
            : "读取判断函数的输入、输出和使用说明。",
      inputSchema,
    },
    async (args: any, extra: any) => {
      const r = await callBackend(c, name, args, extra.signal);
      const data = Array.isArray(r.data) ? { functions: r.data } : r.data;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data) }],
        structuredContent: data,
        isError: r.error,
      };
    },
  );
}
await server.connect(new StdioServerTransport());
