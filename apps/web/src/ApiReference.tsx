import { useState } from "react";
import { Copy } from "lucide-react";
import { tr } from "./i18n";
import { Button } from "./ui";
import { officialSnippet, snippet } from "./snippets";

const rows = [
  ["GET", "/v1/functions", "列出当前凭证可见的函数"],
  ["GET", "/v1/functions/:key", "读取输入输出合同，不含内部问题"],
  ["POST", "/v1/functions/:key/invoke", "调用已发布函数"],
  ["POST", "/v1/systemone", "官方 TypeSafe 请求体，需单独授权"],
  ["GET", "/v1/models", "官方模型列表，同一授权"],
  ["GET", "/health/live", "存活检查，不含密钥"],
];

export function ApiReference({ origin }: { origin: string }) {
  const [lang, setLang] = useState("cURL"),
    [copied, setCopied] = useState("");
  const base = origin.replace(/\/$/, "");
  const invoke = snippet(
    lang,
    `${base}/v1/functions/ticket_route/invoke`,
    1,
    {
      properties: {
        content: {
          type: "string",
          description: "Ticket content",
          minLength: 1,
        },
      },
    },
  );
  const official = officialSnippet(lang, base);
  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
  }
  return (
    <div className="stack api-docs">
      <p className="muted">
        {tr(
          "业务调用走 127.0.0.1 和客户端 Token，不是 TypeSafe Key。管理接口需要本机引导会话。",
        )}
      </p>
      <div className="api-table">
        {rows.map(([method, path, hint]) => (
          <div className="endpoint" key={path}>
            <span>{method}</span>
            <code>
              {base}
              {path}
            </code>
            <small>{tr(hint)}</small>
          </div>
        ))}
      </div>
      <p className="muted">
        {tr(
          "Authorization: Bearer $JEV_CLIENT_TOKEN。错误形状 {error:{code,message},meta}。needs_review 是 200。",
        )}
      </p>
      <div className="row between">
        <div className="mini-tabs">
          {["cURL", "Python", "TypeScript"].map((t) => (
            <button
              key={t}
              className={lang === t ? "selected" : ""}
              onClick={() => setLang(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="row between">
        <strong>{tr("已发布函数")}</strong>
        <Button onClick={() => copy("invoke", invoke)}>
          <Copy size={14} />
          {copied === "invoke" ? tr("已复制") : tr("复制")}
        </Button>
      </div>
      <pre className="code-block">{invoke}</pre>
      <div className="row between">
        <strong>{tr("官方 Jev")}</strong>
        <Button onClick={() => copy("official", official)}>
          <Copy size={14} />
          {copied === "official" ? tr("已复制") : tr("复制")}
        </Button>
      </div>
      <p className="muted">
        {tr(
          "凭证需勾选「允许官方 Jev 调用」。演示服务拒绝此入口。Python 可用 typesafe-sdk，TYPESAFE_BASE_URL 指向本机。",
        )}
      </p>
      <pre className="code-block">{official}</pre>
      <strong>{tr("MCP")}</strong>
      <p className="muted">
        jev_list_functions · jev_describe_function · jev_invoke
        {tr("MCP 工具只用只读凭证，不读数据库或供应商 Key。")}
      </p>
    </div>
  );
}
