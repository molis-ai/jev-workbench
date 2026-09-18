import {
  tr,
  useLanguage,
  setLanguage,
  getLanguage,
  dateTime,
  localizeNewConfig,
} from "./i18n";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  Boxes,
  ChevronRight,
  Languages,
  Moon,
  Settings as SettingsIcon,
  Sun,
  Trash2,
} from "lucide-react";
import { api, setCsrf, setDemoMode } from "./api";
import { Button, Drawer, Notice } from "./ui";
import { FunctionEditor, discardDraft } from "./FunctionEditor";
import { FunctionDirectory } from "./FunctionDirectory";
import { Connections } from "./Connections";
import { Settings } from "./Settings";
import { ApiReference } from "./ApiReference";
import englishTemplate from "../../../examples/ticket_route.en.v1.json";
import template from "../../../examples/ticket_route.v1.json";
import "./style.css";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
type Theme = "dark" | "light";
function readTheme(): Theme {
  try {
    return localStorage.getItem("jev-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}
function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return [
    theme,
    (next: Theme) => {
      try {
        localStorage.setItem("jev-theme", next);
      } catch {}
      setThemeState(next);
    },
  ] as const;
}
function App() {
  const language = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  }, [language]);
  const [ready, setReady] = useState(false),
    [authError, setAuthError] = useState("");
  useEffect(() => {
    document.documentElement.dataset.theme = readTheme();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const fragment = new URLSearchParams(location.hash.slice(1)),
          t = fragment.get("bootstrap");
        history.replaceState(null, "", location.pathname + location.search);
        if (t) {
          const result = await api("/bootstrap", "POST", { token: t });
          setCsrf(result.csrf);
        }
        const s = await api("/status");
        setCsrf(s.csrf);
        setDemoMode(!!s.demo_mode);
        setReady(true);
      } catch (e: any) {
        setAuthError(e.message);
      }
    })();
  }, []);
  return !ready ? (
    <main className="welcome">
      <div className="brand-symbol">j</div>
      <h1>Jev Workbench</h1>
      <p>{tr("本地管理 · 云端推理")}</p>
      {authError ? (
        <>
          <Notice error>{authError}</Notice>
          <pre>
            {location.port === "17430"
              ? "pnpm demo open"
              : "pnpm jev service open"}
          </pre>
          <p>{tr("在项目终端运行，安全打开新的管理会话。")}</p>
        </>
      ) : (
        <p>{tr("正在建立本机会话…")}</p>
      )}
    </main>
  ) : (
    <Workspace />
  );
}
function Workspace() {
  const [id, setId] = useState<string | null>(
      new URLSearchParams(location.search).get("function"),
    ),
    [drawer, setDrawer] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pendingDelete, setPendingDelete] = useState<any>(null),
    [theme, setTheme] = useTheme(),
    [view, setView] = useState<"editor" | "connections" | "settings">("editor");
  const status = useQuery({
    queryKey: ["status"],
    queryFn: () => api("/status"),
  });
  const list = useQuery({
    queryKey: ["functions"],
    queryFn: () => api("/functions"),
  });
  const functions = (list.data ?? []) as any[];
  const selected = functions.find((f) => f.id === id);
  useEffect(() => {
    if (!id && functions.some((f) => !f.archived_at && !f.deleted_at))
      setId(functions.find((f) => !f.archived_at && !f.deleted_at).id);
  }, [list.data]);
  useEffect(() => {
    history.replaceState(
      null,
      "",
      id ? "/?function=" + encodeURIComponent(id) : "/",
    );
  }, [id]);
  async function update(f: any, body: any) {
    setBusy(true);
    setError("");
    try {
      await api("/functions/" + f.id, "PATCH", body);
      await list.refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function create(kind: string) {
    setBusy(true);
    setError("");
    try {
      let c = structuredClone(
        getLanguage() === "en" ? englishTemplate : template,
      ) as any;
      c.key = kind + "_" + Date.now().toString(36);
      if (kind === "verify" || kind === "relevance") {
        c.name = kind === "verify" ? "证据核验" : "内容相关性";
        c.description =
          kind === "verify"
            ? "判断输入材料是否支持给定陈述"
            : "判断内容与指定主题的相关程度";
        c.when_to_use = c.description;
        c.input_schema.properties.content.description = tr("输入材料");
        c.questions =
          kind === "verify"
            ? {
                supported: {
                  type: "noul",
                  instructions: "仅根据输入材料判断陈述是否有足够证据支持。",
                },
              }
            : {
                relevance: {
                  type: "score",
                  instructions: "判断输入内容与指定主题的相关程度。",
                  criteria: ["无关", "部分相关", "高度相关"],
                },
              };
        c.input_schema.properties.context = {
          type: "string",
          description: kind === "verify" ? "待核验陈述" : "主题",
          minLength: 1,
          maxLength: 2000,
        };
        c.input_schema.required.push("context");
        c.state_mapping.context = "/context";
        const key = kind === "verify" ? "supported" : "relevance",
          answer = kind === "verify" ? "noul" : "score";
        c.review = { match: "any", rules: [] };
        c.output_mapping = { result: { source: `/answers/${key}/${answer}` } };
        c.output_schema = {
          type: "object",
          properties: { result: { type: "number" } },
          required: ["result"],
          additionalProperties: false,
        };
      }
      const f = await api("/functions", "POST", localizeNewConfig(c));
      await list.refetch();
      setId(f.id);
      setView("editor");
      setDrawer("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const provider = status.data?.demo_mode
    ? { tone: "warn", label: tr("离线模拟数据") }
    : status.data?.provider?.configured
      ? { tone: "ready", label: tr("供应商已配置") }
      : { tone: "", label: tr("配置 TypeSafe Key") };
  const place =
    view === "connections"
      ? tr("调用与接入")
      : view === "settings"
        ? tr("设置")
        : (selected?.display_name ?? tr("本地判断函数"));

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-symbol">j</span>
          <strong>Jev</strong>
          <span>Workbench</span>
        </div>
        <nav className="crumbs" aria-label={tr("当前位置")}>
          <span>
            {view === "editor" && selected ? tr("本地判断函数") : tr("工作台")}
          </span>
          <ChevronRight size={13} />
          <b>{place}</b>
        </nav>
        <div className="topbar-right">
          <button
            className={"status-pill " + provider.tone}
            onClick={() => setView("settings")}
          >
            <i className="dot" />
            {provider.label}
          </button>
          <button
            className="icon-button"
            aria-label="Language / 语言"
            title={getLanguage() === "en" ? "中文" : "English"}
            onClick={() => setLanguage(getLanguage() === "en" ? "zh" : "en")}
          >
            <Languages size={15} />
          </button>
          <button
            className="icon-button"
            aria-label={tr("切换深浅主题")}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            className={"icon-button " + (view === "settings" ? "on" : "")}
            aria-label={tr("设置")}
            onClick={() => setView("settings")}
          >
            <SettingsIcon size={15} />
          </button>
        </div>
      </header>
      <div className="body">
        <FunctionDirectory
          functions={functions}
          selectedId={view === "editor" ? id : null}
          onSelect={(next: string) => {
            setId(next);
            setView("editor");
          }}
          onNew={() => setDrawer("create")}
          onUpdate={update}
          onDelete={setPendingDelete}
          busy={busy}
          loading={list.isPending}
          error={list.error}
          retry={() => list.refetch()}
          onSettings={() => setView("settings")}
          onRuns={() => setDrawer("runs")}
          onApi={() => setDrawer("api")}
          onConnections={() => setView("connections")}
          connectionsActive={view === "connections"}
          settingsActive={view === "settings"}
          port={status.data?.port}
        />
        <main className="stage">
          {(status.data?.demo_mode || status.data?.test_mode || error) && (
            <div className="stage-notes">
              {status.data?.demo_mode && (
                <div className="mode-note">
                  {tr(
                    "离线演示 · 所有答案均为模拟，不访问网络、不计费。输入 unclear 或「不清楚」会复核，simulate error / 「模拟错误」会失败。",
                  )}
                </div>
              )}
              {status.data?.test_mode && (
                <div className="mode-note">
                  {tr(
                    "测试模式 · 当前使用受控上游数据，结果不代表真实模型判断。",
                  )}
                </div>
              )}
              {error && <Notice error>{error}</Notice>}
            </div>
          )}
          {view === "settings" ? (
            <Settings status={status.data} refresh={() => status.refetch()} />
          ) : view === "connections" ? (
            <Connections functions={functions} initialFunction={selected} />
          ) : id && selected?.deleted_at ? (
            <div className="page">
              <div className="trash-detail">
                <Trash2 size={26} />
                <h2>{selected.display_name}</h2>
                <p>
                  {tr(
                    "此函数在回收站，版本、样例与授权仍保留。恢复后可继续编辑和调用。",
                  )}
                </p>
                <div className="row">
                  <Button
                    variant="primary"
                    onClick={() => update(selected, { trashed: false })}
                  >
                    {tr("恢复函数")}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setPendingDelete(selected)}
                  >
                    {tr("永久删除")}
                  </Button>
                </div>
              </div>
            </div>
          ) : id && selected ? (
            <FunctionEditor
              key={id}
              id={id}
              notices={
                <>
                  {selected.archived_at && (
                    <Notice>
                      {tr("此函数已归档，业务调用已停止。可在左侧恢复。")}
                    </Notice>
                  )}
                  {!selected.enabled && (
                    <Notice>{tr("此函数已停用，业务调用已停止。")}</Notice>
                  )}
                </>
              }
              onUpdated={() => list.refetch()}
            />
          ) : (
            <div className="page">
              <div className="empty">
                <Boxes size={26} />
                <h2>{tr("创建你的第一个判断函数")}</h2>
                <p>{tr("选一种原语，配置与测试都在右侧完成。")}</p>
                <PrimitiveChoices busy={busy} create={create} />
              </div>
            </div>
          )}
        </main>
      </div>
      <Drawer
        open={drawer === "create"}
        onClose={() => setDrawer("")}
        title={tr("新增函数")}
      >
        <p className="new-help">{tr("选一种原语，配置与测试都在右侧完成。")}</p>
        <PrimitiveChoices busy={busy} create={create} />
        {error && <Notice error>{error}</Notice>}
      </Drawer>
      <Drawer
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title={tr("删除函数")}
      >
        <div className="stack">
          <strong>{pendingDelete?.display_name}</strong>
          <Notice error>
            {tr(
              "删除不可恢复，将移除该函数的所有版本、样例、授权及运行记录。已有客户端将无法调用。",
            )}
          </Notice>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api("/functions/" + pendingDelete.id, "DELETE");
                discardDraft(pendingDelete.id);
                if (id === pendingDelete.id) setId(null);
                setPendingDelete(null);
                await list.refetch();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {tr("确认永久删除")}
          </Button>
          {error && <Notice error>{error}</Notice>}
        </div>
      </Drawer>
      <Drawer
        open={drawer === "runs"}
        onClose={() => setDrawer("")}
        title={tr("调用记录")}
      >
        {drawer === "runs" && <Runs />}
      </Drawer>
      <Drawer
        open={drawer === "api"}
        onClose={() => setDrawer("")}
        title={tr("接口文档")}
      >
        <ApiReference origin={location.origin} />
      </Drawer>
    </div>
  );
}
function PrimitiveChoices({
  busy,
  create,
}: {
  busy: boolean;
  create: (kind: string) => void;
}) {
  return (
    <div className="primitive-choices">
      {[
        ["verify", "Noul", "判断是否成立", "证据核验"],
        ["ticket_route", "Choice", "从选项中分类", "工单分流"],
        ["relevance", "Score", "按有序档位评分", "内容相关性"],
      ].map(([key, type, help, name]) => (
        <Button key={key} disabled={busy} onClick={() => create(key)}>
          <strong>{type}</strong>
          <span>{tr(help)}</span>
          <small>{tr(name)}</small>
        </Button>
      ))}
    </div>
  );
}

export function Runs({ id }: { id?: string }) {
  const [offset, setOffset] = useState(0);
  const q = useQuery({
    queryKey: ["runs", id, offset],
    queryFn: () =>
      api("/runs?offset=" + offset + (id ? "&function_id=" + id : "")),
  });
  return (
    <div className="stack">
      <p className="muted">
        {tr("只保存调用元数据；未保存的正文和答案无法回放。")}
      </p>
      {q.isError && <Notice error>{q.error.message}</Notice>}
      {q.isPending ? (
        tr("正在读取…")
      ) : q.data?.length === 0 ? (
        <p className="muted">{tr("暂无调用记录")}</p>
      ) : (
        q.data?.map((r: any) => (
          <div className="record" key={r.request_id}>
            <div>
              <strong>{r.business_status ?? r.execution_status}</strong>
              <span>
                {r.source} · {r.version ? "v" + r.version : tr("草稿")}
              </span>
            </div>
            <small>
              {dateTime(r.started_at)} · {r.duration_ms ?? "—"} ms ·{" "}
              {r.resolved_model ?? r.requested_model}
            </small>
            {r.error_code && <code>{r.error_code}</code>}
          </div>
        ))
      )}
      <div className="row">
        <Button
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          {tr("上一页")}
        </Button>
        <Button
          disabled={q.data?.length !== 50}
          onClick={() => setOffset(offset + 50)}
        >
          {tr("下一页")}
        </Button>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
