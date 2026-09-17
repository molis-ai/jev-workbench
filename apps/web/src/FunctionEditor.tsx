import { tr, dateTime } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  Play,
  Save,
  Plus,
  Trash2,
  History,
  Upload,
} from "lucide-react";
import { api, pretty, sample, demoMode } from "./api";
import { Button, Field, Drawer, Notice, JsonEditor } from "./ui";
import { SimpleDefinition, AnswerSummary } from "./SimpleDefinition";
import { ConfigForms } from "./forms";
import { Runs } from "./main";
const drafts = new Map<string, any>();
export function discardDraft(id: string) {
  drafts.delete(id);
}
export function FunctionEditor({
  id,
  onBack,
  onUpdated,
}: {
  id: string;
  onBack: () => void;
  onUpdated: () => void;
}) {
  const query = useQuery({
    queryKey: ["function", id],
    queryFn: () => api("/functions/" + id),
  });
  return query.isPending ? (
    <p>{tr("正在载入草稿…")}</p>
  ) : query.isError ? (
    <Notice error>{query.error.message}</Notice>
  ) : (
    <Editor
      key={id}
      initial={query.data}
      onBack={onBack}
      onUpdated={onUpdated}
    />
  );
}
function Editor({
  initial,
  onBack,
  onUpdated,
}: {
  initial: any;
  onBack: () => void;
  onUpdated: () => void;
}) {
  const cached = drafts.get(initial.id);
  const [saved, setSaved] = useState(cached?.saved ?? initial),
    [tab, setTab] = useState("基本信息"),
    [drawer, setDrawer] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState<any>(null),
    [message, setMessage] = useState(""),
    [advanced, setAdvanced] = useState(cached?.advanced ?? false),
    [raw, setRaw] = useState(cached?.raw ?? ""),
    [input, setInput] = useState(
      cached?.input ?? pretty(sample(initial.draft.input_schema)),
    ),
    [inputMode, setInputMode] = useState("form"),
    [result, setResult] = useState<any>(cached?.result ?? null),
    [resultConfig, setResultConfig] = useState(cached?.resultConfig ?? ""),
    [resultTab, setResultTab] = useState("最终返回"),
    [caseName, setCaseName] = useState(""),
    [assertions, setAssertions] = useState("[]"),
    [note, setNote] = useState(""),
    [activate, setActivate] = useState(true),
    [tests, setTests] = useState<any>(null);
  const form = useForm({
      defaultValues: { config: cached?.config ?? initial.draft },
    }),
    config = form.watch("config") as any;
  const abort = useRef<AbortController | null>(null);
  const dirty =
    pretty(config) !== pretty(saved.draft) ||
    (advanced && raw !== pretty(config));
  const stale = result && resultConfig !== pretty(config);
  const cases = useQuery({
    queryKey: ["cases", saved.id],
    queryFn: () => api(`/functions/${saved.id}/test-cases`),
  });
  const setConfig = (next: any) => {
    form.setValue("config", next, { shouldDirty: true });
  };
  useEffect(() => {
    drafts.set(initial.id, {
      saved,
      config,
      raw,
      advanced,
      input,
      result,
      resultConfig,
      dirty,
    });
    (window as any).__jevDirty = [...drafts.values()].some((d) => d.dirty);
    const leave = (e: BeforeUnloadEvent) => {
      if ([...drafts.values()].some((d) => d.dirty)) e.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("beforeunload", leave);
    };
  }, [dirty, saved, config, raw, advanced, input, result, resultConfig]);
  useEffect(() => () => abort.current?.abort(), []);
  async function task(name: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    setError(null);
    setMessage("");
    try {
      await fn();
    } catch (e: any) {
      if (e.name === "AbortError") setMessage(tr("试跑已取消"));
      else setError(e);
    } finally {
      setBusy("");
    }
  }
  async function save() {
    if (advanced && raw !== pretty(config))
      throw new Error(tr("请先应用或放弃高级 JSON 修改"));
    const f = await api(`/functions/${saved.id}/draft`, "PUT", config, {
      headers: { "If-Match": `"draft-${saved.draft_revision}"` },
    });
    setSaved(f);
    onUpdated();
    setMessage(tr("草稿已保存"));
    return f;
  }
  async function preview() {
    if (advanced && raw !== pretty(config))
      throw new Error(tr("请先应用高级 JSON 修改"));
    const c = structuredClone(config);
    abort.current = new AbortController();
    const r = await api(
      `/functions/${saved.id}/preview`,
      "POST",
      { config: c, input: JSON.parse(input) },
      { signal: abort.current.signal },
    );
    setResult(r);
    setResultConfig(pretty(c));
    setResultTab("最终返回");
  }
  useEffect(() => {
    const hot = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void task("save", async () => {
          await save();
        });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void task("preview", preview);
      }
    };
    window.addEventListener("keydown", hot);
    return () => window.removeEventListener("keydown", hot);
  });
  const final = result
    ? Object.fromEntries(
        Object.entries(result).filter(
          ([k]) => !["debug", "fixture"].includes(k),
        ),
      )
    : null;
  let inputObject: any;
  try {
    inputObject = JSON.parse(input);
  } catch {
    inputObject = null;
  }
  return (
    <>
      <div className="page-heading editor-heading">
        <div>
          <div className="row">
            <h1>{config.name}</h1>
            <span className="primitive-tag">
              {[
                ...new Set(
                  Object.values(config.questions).map(
                    (q: any) => q.type[0].toUpperCase() + q.type.slice(1),
                  ),
                ),
              ].join(" + ")}
            </span>
            <span
              className={"badge " + (saved.active_version ? "success" : "")}
            >
              {saved.active_version
                ? tr("默认 v") + saved.active_version
                : tr("未发布")}
            </span>
          </div>
          <p>
            {dirty ? tr("有未保存修改") : tr("草稿已保存")} {tr("· 修订")}{" "}
            {saved.draft_revision} {tr("· 已发布版本不受草稿影响")}
          </p>
        </div>
        <div className="row">
          <Button onClick={() => setDrawer("versions")}>{tr("版本")}</Button>
          <Button onClick={() => setDrawer("runs")} aria-label={tr("查看记录")}>
            <History size={16} />
          </Button>
          <Button
            disabled={!!busy}
            onClick={() =>
              task("save", async () => {
                await save();
              })
            }
          >
            <Save size={15} /> {tr("保存草稿")}
          </Button>
          <Button
            variant="primary"
            disabled={!!busy}
            onClick={() =>
              task("prepare", async () => {
                if (dirty) await save();
                setDrawer("publish");
              })
            }
          >
            <Upload size={15} /> {tr("发布新版本")}
          </Button>
        </div>
      </div>
      {error && (
        <Notice error>
          <strong>{error.message}</strong>
          {error.fields && <pre>{pretty(error.fields)}</pre>}
          {error.code === "DRAFT_REVISION_CONFLICT" && (
            <div className="row">
              <Button
                onClick={() => navigator.clipboard.writeText(pretty(config))}
              >
                {tr("复制本地草稿")}
              </Button>
              <Button
                onClick={() =>
                  task("reload", async () => {
                    const f = await api("/functions/" + saved.id);
                    setSaved(f);
                    setConfig(f.draft);
                    setAdvanced(false);
                  })
                }
              >
                {tr("重新载入服务器草稿")}
              </Button>
            </div>
          )}
        </Notice>
      )}
      {message && <Notice>{tr(message)}</Notice>}
      <div className="editor-grid">
        <section className="panel editor-panel">
          <div className="panel-title">
            <h2>{tr("定义判断")}</h2>
            <code>{saved.function_key}</code>
          </div>
          <div className="panel-body">
            <SimpleDefinition config={config} setConfig={setConfig} />
            <details className="advanced-config">
              <summary>{tr("高级配置 · 输入、规则与输出")}</summary>
              <div className="tabs">
                {["基本信息", "输入", "问题", "输出与规则"].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "selected" : ""}
                    onClick={() => setTab(t)}
                  >
                    {tr(t)}
                  </button>
                ))}
              </div>
              <div className="advanced-body">
                <Button
                  onClick={() => {
                    setRaw(pretty(config));
                    setAdvanced(!advanced);
                  }}
                >
                  {advanced ? tr("放弃 JSON 编辑") : tr("高级 JSON")}
                </Button>
                {advanced ? (
                  <>
                    <JsonEditor
                      value={raw}
                      onChange={setRaw}
                      label={tr("完整配置 JSON")}
                    />
                    <Button
                      onClick={() => {
                        try {
                          setConfig(JSON.parse(raw));
                          setAdvanced(false);
                          setError(null);
                        } catch {
                          setError(
                            new Error(tr("JSON 格式错误，请修正后应用")),
                          );
                        }
                      }}
                    >
                      {tr("应用到表单")}
                    </Button>
                  </>
                ) : (
                  <ConfigForms
                    tab={tab}
                    config={config}
                    setConfig={setConfig}
                    published={saved.releases.length > 0}
                    sampleInput={inputObject}
                  />
                )}
              </div>
            </details>
          </div>
        </section>
        <section className="panel playground">
          <div className="panel-title">
            <h2>{tr("试跑当前编辑")}</h2>
            <span className="badge">{tr("未发布")}</span>
          </div>
          <div className="panel-body playground-body">
            <div className="stack playground-input">
              <div className="row between">
                <strong>{tr("样例输入")}</strong>
                <div className="segmented">
                  <button
                    className={inputMode === "form" ? "selected" : ""}
                    onClick={() => setInputMode("form")}
                  >
                    {tr("表单")}
                  </button>
                  <button
                    className={inputMode === "json" ? "selected" : ""}
                    onClick={() => setInputMode("json")}
                  >
                    JSON
                  </button>
                </div>
              </div>
              <select
                aria-label={tr("选择保存的样例")}
                defaultValue=""
                onChange={(e) => {
                  const t = cases.data?.find(
                    (c: any) => c.id === e.target.value,
                  );
                  if (t) setInput(pretty(t.input));
                }}
              >
                <option value="">{tr("选择已保存样例")}</option>
                {cases.data?.map((t: any) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {inputMode === "json" ? (
                <JsonEditor
                  value={input}
                  onChange={setInput}
                  label={tr("试跑输入 JSON")}
                />
              ) : inputObject &&
                typeof inputObject === "object" &&
                !Array.isArray(inputObject) ? (
                Object.entries(config.input_schema.properties).map(
                  ([key, f]: [string, any]) => (
                    <Field
                      key={key}
                      label={`${key}${config.input_schema.required.includes(key) ? " *" : ""}`}
                      hint={f.description}
                    >
                      {f.type === "boolean" ? (
                        <select
                          value={String(inputObject[key] ?? false)}
                          onChange={(e) =>
                            setInput(
                              pretty({
                                ...inputObject,
                                [key]: e.target.value === "true",
                              }),
                            )
                          }
                        >
                          <option value="false">false</option>
                          <option value="true">true</option>
                        </select>
                      ) : f.type === "number" ? (
                        <input
                          type="number"
                          value={inputObject[key] ?? ""}
                          onChange={(e) =>
                            setInput(
                              pretty({
                                ...inputObject,
                                [key]:
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                              }),
                            )
                          }
                        />
                      ) : (
                        <textarea
                          rows={f.type === "array" ? 3 : 5}
                          value={
                            f.type === "array"
                              ? (inputObject[key] ?? []).join("\n")
                              : (inputObject[key] ?? "")
                          }
                          placeholder={
                            f.type === "array"
                              ? tr("每行一个字符串")
                              : tr("输入用于判断的内容")
                          }
                          onChange={(e) =>
                            setInput(
                              pretty({
                                ...inputObject,
                                [key]:
                                  f.type === "array"
                                    ? e.target.value.split("\n")
                                    : e.target.value,
                              }),
                            )
                          }
                        />
                      )}
                    </Field>
                  ),
                )
              ) : (
                <Notice error>
                  {tr("输入不是有效对象，请切换 JSON 修正。")}
                </Notice>
              )}
              <div className="row">
                <Button
                  variant="primary"
                  disabled={!!busy}
                  onClick={() => task("preview", preview)}
                >
                  <Play size={15} />
                  {busy === "preview" ? tr("正在请求…") : tr("测试当前编辑")}
                </Button>
                {busy === "preview" && (
                  <Button onClick={() => abort.current?.abort()}>
                    {tr("取消")}
                  </Button>
                )}
              </div>
              <small>
                {demoMode
                  ? tr("离线模拟，不发送网络请求、不计费。")
                  : tr("发送至 TypeSafe，可能计费。")}
                ⌘ / Ctrl + Enter
              </small>
            </div>
            <div className="stack playground-result">
              <div className="row between">
                <strong>{tr("试跑结果")}</strong>
                {result && (
                  <span
                    className={
                      "badge " +
                      (stale
                        ? "review"
                        : result.status === "ok"
                          ? "success"
                          : "review")
                    }
                  >
                    {stale
                      ? tr("来自旧配置")
                      : result.status === "needs_review"
                        ? tr("需要复核")
                        : tr("判断完成")}
                  </span>
                )}
              </div>
              {!result ? (
                <div className="result-empty">
                  {tr("填入样例开始试跑")}
                  <br />
                  <small>{tr("这里会展示真实返回、请求与命中规则。")}</small>
                </div>
              ) : (
                <>
                  {stale && (
                    <Notice>
                      {tr("配置已修改，请重新试跑当前快照后发布。")}
                    </Notice>
                  )}
                  <AnswerSummary result={result} />
                  {result.status === "needs_review" && (
                    <Notice>
                      {tr("结果需要人工复核，最终返回以复核规则为准。")}
                    </Notice>
                  )}
                  <details className="response-details">
                    <summary>{tr("查看返回与诊断")}</summary>
                    <div className="mini-tabs">
                      {["最终返回", "原始答案", "实际请求", "规则命中"].map(
                        (t) => (
                          <button
                            className={resultTab === t ? "selected" : ""}
                            key={tr(t)}
                            onClick={() => setResultTab(t)}
                          >
                            {tr(t)}
                          </button>
                        ),
                      )}
                    </div>
                    <JsonEditor
                      readOnly
                      value={pretty(
                        resultTab === "最终返回"
                          ? final
                          : resultTab === "原始答案"
                            ? result.debug.answers
                            : resultTab === "实际请求"
                              ? result.debug.request
                              : result.review_reasons,
                      )}
                    />
                  </details>
                  <small>
                    {result.meta.model} · {result.meta.duration_ms}{" "}
                    {tr("ms · 模型概率不是正确率")}
                  </small>
                </>
              )}
              <Button onClick={() => setDrawer("cases")}>
                {tr("保存与管理样例")}
              </Button>
            </div>
          </div>
        </section>
      </div>
      <Drawer
        open={drawer === "publish"}
        onClose={() => setDrawer("")}
        title={tr("发布 v{0}", (saved.releases[0]?.version ?? 0) + 1)}
      >
        <div className="stack">
          <Notice>
            {tr(
              "发布会固定完整配置与模型版本。单次试跑证明调用合同可用，不代表准确率已校准。",
            )}
          </Notice>
          <p>
            {tr("模型：")}
            <code>{config.model}</code>
          </p>
          <p>
            {result && !stale
              ? tr("当前配置已在此页面试跑")
              : tr("发布前需要当前配置的成功试跑记录，后台会再次核验。")}
          </p>
          <h3>{tr("版本变更预览")}</h3>
          <ul className="change-list">
            {Object.keys(saved.draft)
              .filter(
                (k) =>
                  pretty(saved.releases[0]?.config[k]) !==
                  pretty(saved.draft[k]),
              )
              .map((k) => (
                <li key={k}>
                  <code>{k}</code> ·{" "}
                  {saved.releases[0] ? tr("已修改") : tr("新增")}
                </li>
              ))}
          </ul>
          {saved.releases[0] &&
            pretty(saved.releases[0].config.input_schema) !==
              pretty(config.input_schema) && (
              <Notice error>
                {tr("输入合同有变化，请检查调用方兼容性。")}
              </Notice>
            )}
          {saved.releases[0] &&
            pretty(saved.releases[0].config.output_schema) !==
              pretty(config.output_schema) && (
              <Notice error>
                {tr("输出合同有变化，请检查下游消费代码。")}
              </Notice>
            )}
          <details>
            <summary>{tr("上一发布版")}</summary>
            <JsonEditor
              value={pretty(saved.releases[0]?.config ?? {})}
              readOnly
            />
          </details>
          <details open>
            <summary>{tr("将发布的完整配置")}</summary>
            <JsonEditor value={pretty(saved.draft)} readOnly />
          </details>
          <p>
            {saved.grants.length}{" "}
            {tr("个客户端授权保持现状，不自动升级固定版本。")}
          </p>
          <Field label={tr("发布说明")}>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={activate}
              onChange={(e) => setActivate(e.target.checked)}
            />
            {tr("设为默认版本")}
          </label>
          <Button
            variant="primary"
            disabled={!!busy}
            onClick={() =>
              task("publish", async () => {
                const f = await api(`/functions/${saved.id}/publish`, "POST", {
                  draft_revision: saved.draft_revision,
                  checksum: saved.checksum,
                  activate,
                  note,
                });
                setSaved(f);
                onUpdated();
                setDrawer("");
                setMessage(tr("已发布 v{0}", f.releases[0].version));
              })
            }
          >
            {tr("发布 v")}
            {(saved.releases[0]?.version ?? 0) + 1}
            {activate ? tr(" 并设为默认") : ""}
          </Button>
        </div>
      </Drawer>
      <Drawer
        open={drawer === "versions"}
        onClose={() => setDrawer("")}
        title={tr("发布版本")}
      >
        <div className="stack">
          <p>{tr("回退仅改变默认指针；固定版客户端不会改变。")}</p>
          {saved.releases.length === 0 ? (
            <p>{tr("尚无发布版本")}</p>
          ) : (
            saved.releases.map((r: any) => (
              <div className="record" key={r.version}>
                <div>
                  <strong>
                    v{r.version}{" "}
                    {saved.active_version === r.version ? tr("· 当前默认") : ""}
                  </strong>
                  <Button
                    disabled={!!busy || saved.active_version === r.version}
                    onClick={() =>
                      task("activate", async () => {
                        setSaved(
                          await api(`/functions/${saved.id}/activate`, "POST", {
                            version: r.version,
                          }),
                        );
                        onUpdated();
                      })
                    }
                  >
                    {tr("设为默认")}
                  </Button>
                </div>
                <small>
                  {r.config.model} · {dateTime(r.published_at)}
                </small>
                <p>{r.release_note || tr("无发布说明")}</p>
                <details>
                  <summary>{tr("配置快照")}</summary>
                  <JsonEditor value={pretty(r.config)} readOnly />
                </details>
              </div>
            ))
          )}
          <h3>{tr("固定版本客户端")}</h3>
          {saved.grants.map((g: any) => (
            <p key={g.client_id}>
              {g.name} ·{" "}
              {g.pinned_version ? "v" + g.pinned_version : tr("跟随默认")}
            </p>
          ))}
        </div>
      </Drawer>
      <Drawer
        open={drawer === "cases"}
        onClose={() => setDrawer("")}
        title={tr("测试样例")}
      >
        <div className="stack">
          <Notice>
            {tr(
              "保存样例会把输入业务内容写入本机数据库。默认运行记录不保存这些内容。",
            )}
          </Notice>
          <Field label={tr("样例名称")}>
            <input
              value={caseName}
              onChange={(e) => setCaseName(e.target.value)}
            />
          </Field>
          <Field
            label={tr("字段断言（JSON 数组）")}
            hint={tr('例如 [{"path":"/data/department","equals":"billing"}]')}
          >
            <JsonEditor value={assertions} onChange={setAssertions} />
          </Field>
          <Button
            disabled={!!busy || !caseName}
            onClick={() =>
              task("case", async () => {
                await api(`/functions/${saved.id}/test-cases`, "POST", {
                  name: caseName,
                  input: JSON.parse(input),
                  assertions: JSON.parse(assertions),
                });
                setCaseName("");
                await cases.refetch();
              })
            }
          >
            {tr("保存当前输入为样例")}
          </Button>
          {cases.data?.map((c: any) => (
            <div className="row between" key={c.id}>
              <strong>{c.name}</strong>
              <div className="row">
                <Button
                  onClick={() => {
                    setInput(pretty(c.input));
                    setDrawer("");
                  }}
                >
                  {tr("载入")}
                </Button>
                <Button
                  aria-label={tr("删除样例 ") + c.name}
                  onClick={() =>
                    task("delete", async () => {
                      await api(
                        `/functions/${saved.id}/test-cases/${c.id}`,
                        "DELETE",
                      );
                      await cases.refetch();
                    })
                  }
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
          <Button
            disabled={!!busy || !cases.data?.length}
            onClick={() =>
              task("tests", async () => {
                if (dirty) await save();
                setTests(await api(`/functions/${saved.id}/test`, "POST", {}));
              })
            }
          >
            {demoMode
              ? tr("运行保存样例（离线模拟）")
              : tr("运行保存样例（云端，可能计费）")}
          </Button>
          {tests && <JsonEditor value={pretty(tests)} readOnly />}
        </div>
      </Drawer>
      <Drawer
        open={drawer === "runs"}
        onClose={() => setDrawer("")}
        title={tr("函数调用记录")}
      >
        {drawer === "runs" && <Runs id={saved.id} />}
      </Drawer>
    </>
  );
}
