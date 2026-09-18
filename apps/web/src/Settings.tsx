import { useEffect, useState } from "react";
import { Database, KeyRound, Server } from "lucide-react";
import { tr } from "./i18n";
import { api, pretty } from "./api";
import { Button, JsonEditor, Notice } from "./ui";

const sections = [
  {
    id: "typesafe",
    label: "TypeSafe",
    title: "TypeSafe",
    hint: "管理和配置保存在本机；输入内容、问题会发送至 TypeSafe 云端，可能产生费用。",
    Icon: KeyRound,
  },
  {
    id: "service",
    label: "本机服务",
    title: "本机服务",
    hint: "端口与数据目录只读；调用限制保存后立即生效。",
    Icon: Server,
  },
  {
    id: "data",
    label: "备份与导出",
    title: "备份与导出",
    hint: "导出函数或备份本机数据库。不含供应商 Key 或调用原文。",
    Icon: Database,
  },
] as const;

type Section = (typeof sections)[number]["id"];

export function Settings({
  status,
  refresh,
}: {
  status: any;
  refresh: () => void;
}) {
  const [section, setSection] = useState<Section>("typesafe"),
    [key, setKey] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [model, setModel] = useState<any>(null),
    [timeout, setTimeoutValue] = useState(status?.timeout_ms ?? 30000),
    [concurrency, setConcurrency] = useState(status?.concurrency ?? 4);
  useEffect(() => {
    if (status?.timeout_ms != null) setTimeoutValue(status.timeout_ms);
    if (status?.concurrency != null) setConcurrency(status.concurrency);
  }, [status?.timeout_ms, status?.concurrency]);
  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const current = sections.find((s) => s.id === section)!;
  const envLocked = status?.provider.source === "environment";
  return (
    <div className="settings-page">
      <nav className="settings-nav" aria-label={tr("设置")}>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={
              "settings-nav-item" + (section === s.id ? " selected" : "")
            }
            aria-current={section === s.id ? "page" : undefined}
            onClick={() => setSection(s.id)}
          >
            <s.Icon size={16} />
            {tr(s.label)}
          </button>
        ))}
      </nav>
      <div className="settings-body">
        <div className="settings-heading">
          <h1>{tr(current.title)}</h1>
          <p>{tr(current.hint)}</p>
        </div>
        {message && <Notice>{tr(message)}</Notice>}
        {error && <Notice error>{error}</Notice>}
        {section === "typesafe" && (
          <section className="sheet">
            <div className="sheet-row">
              <div className="sheet-copy">
                <strong>TypeSafe API Key</strong>
                <p>
                  {status?.demo_mode
                    ? tr("离线演示：无需 Key，所有数据为模拟")
                    : status?.provider.configured
                      ? `${status.provider.masked} · ${envLocked ? tr("来自启动环境") : tr("已加密保存")}`
                      : tr("尚未配置")}
                </p>
              </div>
              <div className="sheet-control">
                <input
                  type="password"
                  value={key}
                  autoComplete="off"
                  aria-label={tr("替换 Key")}
                  placeholder={tr("替换 Key")}
                  onChange={(e) => setKey(e.target.value)}
                  disabled={status?.demo_mode || envLocked}
                />
                <div className="row">
                  <Button
                    variant="primary"
                    disabled={busy || !key}
                    onClick={() =>
                      run(async () => {
                        await api("/provider", "PUT", { key });
                        setKey("");
                        setMessage(tr("Key 已加密保存"));
                      })
                    }
                  >
                    {tr("保存 Key")}
                  </Button>
                  <Button
                    disabled={busy || !status?.provider.configured}
                    onClick={() =>
                      run(async () =>
                        setModel(await api("/provider/test", "POST", {})),
                      )
                    }
                  >
                    {tr("查询可用模型")}
                  </Button>
                </div>
              </div>
            </div>
            {model && (
              <div className="sheet-row">
                <div className="sheet-copy">
                  <strong>{tr("可用模型")}</strong>
                  <p>{tr("来自 TypeSafe 的当前模型列表。")}</p>
                </div>
                <JsonEditor value={pretty(model)} readOnly />
              </div>
            )}
          </section>
        )}
        {section === "service" && (
          <section className="sheet">
            <div className="sheet-row">
              <div className="sheet-copy">
                <strong>{tr("端口")}</strong>
                <p>
                  {tr(
                    "更换端口：停止服务后设置 JEV_PORT，再同步客户端 endpoint。关闭浏览器不会停止后台。",
                  )}
                </p>
              </div>
              <code className="sheet-value">{status?.port ?? "—"}</code>
            </div>
            <div className="sheet-row">
              <div className="sheet-copy">
                <strong>{tr("数据目录")}</strong>
                <p>{tr("本机配置、凭证和备份的保存位置。")}</p>
              </div>
              <code className="break sheet-value">{status?.home}</code>
            </div>
            <div className="sheet-row">
              <div className="sheet-copy">
                <strong>{tr("总时间预算（毫秒，1000–30000）")}</strong>
                <p>{tr("单次调用的总时间上限，保存后立即生效。")}</p>
              </div>
              <input
                type="number"
                min={1000}
                max={30000}
                value={timeout}
                aria-label={tr("总时间预算（毫秒，1000–30000）")}
                onChange={(e) => setTimeoutValue(Number(e.target.value))}
              />
            </div>
            <div className="sheet-row">
              <div className="sheet-copy">
                <strong>{tr("上游并发（1–4）")}</strong>
                <p>{tr("同时发给 TypeSafe 的请求数。")}</p>
              </div>
              <input
                type="number"
                min={1}
                max={4}
                value={concurrency}
                aria-label={tr("上游并发（1–4）")}
                onChange={(e) => setConcurrency(Number(e.target.value))}
              />
            </div>
            <div className="sheet-row">
              <div className="sheet-copy">
                <strong>{tr("调用限制")}</strong>
                <p>
                  {tr("当前")} {(status?.timeout_ms ?? 0) / 1000}
                  {tr("秒")}
                  {tr(" · 并发")}
                  {status?.concurrency}
                </p>
              </div>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("/settings", "PATCH", {
                      timeout_ms: timeout,
                      concurrency,
                    });
                    setMessage(tr("调用限制已保存，新请求立即生效"));
                  })
                }
              >
                {tr("保存调用限制")}
              </Button>
            </div>
          </section>
        )}
        {section === "data" && (
          <section className="sheet">
            <div className="sheet-row">
              <div className="sheet-copy">
                <strong>{tr("导出函数配置")}</strong>
                <p>
                  {tr(
                    "导出不含供应商 Key、客户端 Token 或调用原文。数据库备份包含你明确保存的测试样例。",
                  )}
                </p>
              </div>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await api("/export");
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(
                      new Blob([pretty(r)], { type: "application/json" }),
                    );
                    a.download = "jev-functions.json";
                    a.click();
                    URL.revokeObjectURL(a.href);
                  })
                }
              >
                {tr("导出函数配置")}
              </Button>
            </div>
            <div className="sheet-row">
              <div className="sheet-copy">
                <strong>{tr("备份数据库")}</strong>
                <p>{tr("在本机数据目录写入一份 SQLite 在线备份。")}</p>
              </div>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await api("/backup", "POST", {});
                    setMessage(tr("数据库备份已保存：") + r.path);
                  })
                }
              >
                {tr("备份数据库")}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
