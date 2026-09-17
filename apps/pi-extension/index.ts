import { Type } from "@sinclair/typebox";
import { credentials, callBackend } from "../mcp/src/client";
export default function (pi: any) {
  const path = process.env.JEV_CREDENTIALS_FILE;
  if (!path)
    throw new Error(
      "Set JEV_CREDENTIALS_FILE to your Jev client credential file",
    );
  register(pi, path);
}
export function register(pi: any, path: string) {
  const c = credentials(path);
  for (const name of [
    "jev_list_functions",
    "jev_describe_function",
    "jev_invoke",
  ]) {
    const properties: any =
      name === "jev_list_functions"
        ? {}
        : {
            key: Type.String(),
            version: Type.Optional(Type.Integer({ minimum: 1 })),
          };
    if (name === "jev_invoke")
      properties.input = Type.Record(Type.String(), Type.Unknown());
    pi.registerTool({
      name,
      label: name,
      description:
        name === "jev_invoke"
          ? "调用 Jev 判断函数（TypeSafe 云端推理，可能计费）；needs_review 需要人工复核。"
          : "发现已授权 Jev 判断函数及输入输出合同。",
      parameters: Type.Object(properties),
      async execute(_id: string, args: any, signal?: AbortSignal) {
        const r = await callBackend(c, name, args, signal);
        return {
          content: [{ type: "text", text: JSON.stringify(r.data) }],
          details: r.data,
          isError: r.error,
        };
      },
    });
  }
}
