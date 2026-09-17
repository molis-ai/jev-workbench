import { tr, dateTime, getLanguage } from "./i18n";
import { snippet, officialSnippet } from "./snippets";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, KeyRound, Plug, Terminal } from "lucide-react";
import { api, pretty, sample, demoMode } from "./api";
import { Button, Field, Notice, Drawer, JsonEditor } from "./ui";
export function Connections({
  functions,
  initialFunction,
}: {
  functions: any[];
  initialFunction?: any;
}) {
  const [tab, setTab] = useState("API 调用"),
    [selected, setSelected] = useState(
      initialFunction?.active_version ? initialFunction.id : "",
    ),
    [version, setVersion] = useState(initialFunction?.active_version ?? 0),
    [lang, setLang] = useState("cURL"),
    [name, setName] = useState(""),
    [grants, setGrants] = useState<any[]>([]),
    [token, setToken] = useState(""),
    [shownToken, setShownToken] = useState(""),
    [result, setResult] = useState<any>(null),
    [input, setInput] = useState("{}"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [runtime, setRuntime] = useState("opencode"),
    [scope, setScope] = useState("user"),
    [project, setProject] = useState(""),
    [plan, setPlan] = useState<any>(null),
    [drawer, setDrawer] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [officialInvoke, setOfficialInvoke] = useState(false),
    [skillPlan, setSkillPlan] = useState<any>(null);
  const published = functions.filter((f) => f.active_version && !f.archived_at && !f.deleted_at);
  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: () => api("/clients"),
  });
  const detection = useQuery({
    queryKey: ["detection"],
    queryFn: () => api("/integrations/detect", "POST", {}),
  });
  const installations = useQuery({
    queryKey: ["installations"],
    queryFn: () => api("/integrations"),
  });
  const skillInstalls = useQuery({
    queryKey: ["skills"],
    queryFn: () => api("/skills"),
  });
  const detail = useQuery({
    queryKey: ["connection-function", selected],
    queryFn: () => api("/functions/" + selected),
    enabled: !!selected,
  });
  const release = detail.data?.releases.find((r: any) => r.version === version);
  const c = release?.config;
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const endpoint = c ? `${location.origin}/v1/functions/${c.key}/invoke` : "";
  const code = c
    ? snippet(lang, endpoint, version, c.input_schema)
    : "先选择一个已发布函数与版本。";
  const officialCode = officialSnippet(lang, location.origin);
  const GrantPicker = () => (
    <div className="stack">
      <p className="muted">
        {tr("默认不授权函数。勾选后固定当前默认版本，发布新版本不会自动升级。")}
      </p>
      {published.length === 0 ? (
        <Notice>{tr("先完成函数试跑和发布，再创建授权。")}</Notice>
      ) : (
        published.map((f) => (
          <div className="grant-choice" key={f.id}>
            <label className="check">
              <input
                type="checkbox"
                checked={grants.some((g) => g.function_id === f.id)}
                onChange={(e) =>
                  setGrants(
                    e.target.checked
                      ? [
                          ...grants,
                          {
                            function_id: f.id,
                            pinned_version: f.active_version,
                          },
                        ]
                      : grants.filter((g) => g.function_id !== f.id),
                  )
                }
              />
              <span>{f.display_name}</span>
            </label>
            <code>
              {f.function_key}@
              {grants.some((g) => g.function_id === f.id)
                ? (grants.find((g) => g.function_id === f.id).pinned_version ??
                  tr("默认"))
                : f.active_version}
            </code>
            {grants.some((g) => g.function_id === f.id) && (
              <select
                aria-label={f.display_name + tr(" 授权版本")}
                value={
                  grants.find((g) => g.function_id === f.id)?.pinned_version ??
                  "default"
                }
                onChange={(e) =>
                  setGrants(
                    grants.map((g) =>
                      g.function_id === f.id
                        ? {
                            ...g,
                            pinned_version:
                              e.target.value === "default"
                                ? null
                                : Number(e.target.value),
                          }
                        : g,
                    ),
                  )
                }
              >
                {(f.versions ?? [f.active_version]).map((v: number) => (
                  <option key={v} value={v}>
                    {tr("固定 v")}
                    {v}
                  </option>
                ))}
                <option value="default">
                  {tr("跟随默认（允许指定其他发布版）")}
                </option>
              </select>
            )}
          </div>
        ))
      )}
    </div>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{tr("调用与接入")}</h1>
          <p>{tr("业务服务和 Agent，共享已发布的判断函数。")}</p>
        </div>
      </div>
      <div className="tabs page-tabs">
        {["API 调用", "Agent 接入"].map((t) => (
          <button
            key={tr(t)}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {tr(t)}
          </button>
        ))}
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{tr(message)}</Notice>}
      {[clients, installations, skillInstalls, detection, detail]
        .filter((q) => q.isError)
        .map((q, i) => (
          <Notice key={i} error>
            {q.error?.message}{" "}
            <Button onClick={() => q.refetch()}>{tr("重试")}</Button>
          </Notice>
        ))}
      {tab === "API 调用" ? (
        <>
          <section className="panel">
            <div className="panel-body stack">
              <div className="row">
                <Field label={tr("判断函数")}>
                  <select
                    value={selected}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      setVersion(
                        functions.find((f) => f.id === e.target.value)
                          ?.active_version ?? 0,
                      );
                    }}
                  >
                    <option value="">{tr("选择已发布函数")}</option>
                    {published.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.display_name} · {f.function_key}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={tr("固定调用版本")}>
                  <select
                    value={version}
                    onChange={(e) => setVersion(Number(e.target.value))}
                  >
                    <option value={0}>{tr("选择版本")}</option>
                    {detail.data?.releases.map((r: any) => (
                      <option key={r.version} value={r.version}>
                        v{r.version} · {r.config.model}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {c && (
                <div className="endpoint">
                  <span>POST</span>
                  <code>{endpoint}</code>
                </div>
              )}
              <div className="row between">
                <div className="mini-tabs">
                  {["cURL", "Python", "TypeScript"].map((t) => (
                    <button
                      key={tr(t)}
                      className={lang === t ? "selected" : ""}
                      onClick={() => setLang(t)}
                    >
                      {tr(t)}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() =>
                    task(async () => {
                      await navigator.clipboard.writeText(code);
                      setMessage(tr("调用示例已复制"));
                    })
                  }
                >
                  <Copy size={14} />
                  {tr("复制")}
                </Button>
              </div>
              <pre className="code-block">{code}</pre>
              <details>
                <summary>{tr("官方 Jev 入口（需单独授权）")}</summary>
                <p className="muted">
                  {tr(
                    "调用方按官方 {model,state,questions} 传参。凭证必须勾选「允许官方 Jev 调用」。演示服务拒绝此入口。",
                  )}
                </p>
                <div className="endpoint">
                  <span>POST</span>
                  <code>{`${location.origin}/v1/systemone`}</code>
                </div>
                <pre className="code-block">{officialCode}</pre>
              </details>
              {c && (
                <details>
                  <summary>{tr("输入与输出合同")}</summary>
                  <JsonEditor
                    value={pretty({
                      input_schema: c.input_schema,
                      output_schema: c.output_schema,
                    })}
                    readOnly
                  />
                </details>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-title">
              <h2>{tr("客户端凭证")}</h2>
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setGrants([]);
                  setName("");
                  setOfficialInvoke(false);
                  setDrawer(true);
                }}
              >
                <KeyRound size={15} />
                {tr("创建凭证")}
              </Button>
            </div>
            <div className="panel-body stack">
              {clients.data?.length === 0 ? (
                <p className="muted">
                  {tr(
                    "尚无客户端凭证。每个调用方使用独立授权，便于撤销和归因。",
                  )}
                </p>
              ) : (
                clients.data?.map((cl: any) => (
                  <div className="record" key={cl.id}>
                    <div>
                      <strong>
                        {cl.name} <span className="badge">{cl.kind}</span>
                      </strong>
                      <span>
                        {cl.revoked_at
                          ? tr("已撤销")
                          : cl.token_prefix + "••••"}
                      </span>
                    </div>
                    <small>
                      {[
                        cl.official_invoke ? tr("官方 Jev") : null,
                        cl.grants
                          .map(
                            (g: any) =>
                              `${g.function_key}@${g.pinned_version ?? "default"}`,
                          )
                          .join("，") || tr("无函数授权"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      {tr("· 最近调用")}{" "}
                      {cl.last_seen_at ? dateTime(cl.last_seen_at) : tr("尚无")}
                    </small>
                    {!cl.revoked_at && (
                      <div className="row">
                        <Button
                          onClick={() => {
                            setEditing(cl.id);
                            setName(cl.name);
                            setOfficialInvoke(!!cl.official_invoke);
                            setGrants(
                              cl.grants.map((g: any) => ({
                                function_id: g.function_id,
                                pinned_version: g.pinned_version,
                              })),
                            );
                            setDrawer(true);
                          }}
                        >
                          {tr("编辑授权")}
                        </Button>
                        <Button
                          variant="danger"
                          disabled={busy}
                          onClick={() =>
                            task(async () => {
                              await api(`/clients/${cl.id}/revoke`, "POST", {});
                              await clients.refetch();
                            })
                          }
                        >
                          {tr("撤销")}
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-title">
              <h2>
                {demoMode ? tr("测试模拟 API 调用") : tr("测试真实 API 调用")}
              </h2>
            </div>
            <div className="panel-body stack">
              <p className="muted">
                {demoMode
                  ? tr("使用受限客户端 Token 校验；离线模拟，不计费。")
                  : tr(
                      "使用受限客户端 Token 校验，发送至 TypeSafe，可能计费。",
                    )}
                {tr("测试后会清除输入凭证。")}
              </p>
              <Field label={tr("客户端 Token")}>
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </Field>
              <JsonEditor
                value={input}
                onChange={setInput}
                label={tr("业务 API 输入 JSON")}
              />
              <Button
                disabled={busy || !c || !token}
                onClick={() =>
                  task(async () => {
                    try {
                      const r = await fetch(endpoint, {
                        method: "POST",
                        headers: {
                          Authorization: "Bearer " + token,
                          "Accept-Language": getLanguage(),
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          version,
                          input: JSON.parse(input),
                        }),
                        signal: AbortSignal.timeout(35000),
                      });
                      setResult(await r.json());
                    } finally {
                      setToken("");
                    }
                  })
                }
              >
                {tr("调用所选发布版本")}
              </Button>
              {result && <JsonEditor readOnly value={pretty(result)} />}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="runtime-grid">
            {[
              ["claude_code", "Claude Code", "MCP · stdio"],
              ["codex", "Codex", "MCP · stdio"],
              ["opencode", "OpenCode", "MCP · stdio"],
              ["pi", "Pi", "原生工具扩展"],
            ].map(([key, label, desc]) => (
              <button
                key={key}
                className={"runtime " + (runtime === key ? "selected" : "")}
                onClick={() => {
                  setRuntime(key);
                  setPlan(null);
                }}
              >
                <Terminal size={22} />
                <strong>{label}</strong>
                <span>{tr(desc)}</span>
                <small>
                  {detection.data?.find((d: any) => d.runtime === key)
                    ?.version ?? tr("未检测到 CLI")}
                </small>
              </button>
            ))}
          </section>
          <section className="panel">
            <div className="panel-title">
              <h2>
                {tr("生成")}
                {runtime} {tr("接入配置")}
              </h2>
            </div>
            <div className="panel-body stack">
              <GrantPicker />
              <div className="row">
                <Field label={tr("配置范围")}>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    <option value="user">{tr("用户范围")}</option>
                    <option value="project">{tr("指定项目")}</option>
                  </select>
                </Field>
                {scope === "project" && (
                  <Field label={tr("项目绝对路径")}>
                    <input
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                      placeholder="/Users/you/code/project"
                    />
                  </Field>
                )}
              </div>
              <Button
                disabled={busy}
                variant="primary"
                onClick={() =>
                  task(async () =>
                    setPlan(
                      await api("/integrations/plan", "POST", {
                        runtime,
                        scope,
                        ...(scope === "project" ? { project } : {}),
                        grants,
                      }),
                    ),
                  )
                }
              >
                {tr("生成接入变更")}
              </Button>
              {plan && (
                <>
                  <Notice>
                    {plan.supported
                      ? tr("确认后只写入本产品条目，保留其他配置。")
                      : tr(plan.reason)}
                  </Notice>
                  <code className="break">{plan.path}</code>
                  <details>
                    <summary>{tr("原配置")}</summary>
                    <pre>{plan.before || tr("文件尚不存在")}</pre>
                  </details>
                  <h3>{tr("将写入的配置 / 命令")}</h3>
                  <pre className="code-block">{plan.after}</pre>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      task(async () => {
                        const r = await api("/integrations/apply", "POST", {
                          plan_id: plan.plan_id,
                        });
                        setPlan(null);
                        setResult(r);
                        setMessage(
                          r.status === "configured"
                            ? tr("配置已写入，请执行连接测试。")
                            : tr(
                                "凭证文件已准备，执行下方命令后在目标 Agent 内验证。",
                              ),
                        );
                        await installations.refetch();
                        await clients.refetch();
                      })
                    }
                  >
                    {plan.supported
                      ? tr("确认并应用变更")
                      : tr("创建凭证并准备命令")}
                  </Button>
                </>
              )}
              {result?.command && (
                <pre className="code-block">
                  {result.command
                    .map((s: string) => "'" + s.replace(/'/g, "'\\''") + "'")
                    .join(" ")}
                </pre>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-title">
              <h2>{tr("TypeSafe skill（可选）")}</h2>
            </div>
            <div className="panel-body stack">
              <p className="muted">
                {tr(
                  "安装官方 typesafe-ai skill，让 Agent 按 TypeSafe 文档设计判断。不安装也能通过本工作台的 MCP / HTTP 调用函数。确认前不会改任何运行端。",
                )}
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  task(async () =>
                    setSkillPlan(
                      await api("/skills/plan", "POST", {
                        runtime,
                        scope,
                        ...(scope === "project" ? { project } : {}),
                      }),
                    ),
                  )
                }
              >
                {tr("预览 Skill 安装")}
              </Button>
              {skillPlan && (
                <>
                  <Notice>
                    {skillPlan.supported
                      ? tr("确认后只写入本产品条目，保留其他配置。")
                      : tr(skillPlan.reason)}
                  </Notice>
                  <pre className="code-block">{skillPlan.after}</pre>
                  {skillPlan.supported && (
                    <Button
                      disabled={busy}
                      variant="primary"
                      onClick={() =>
                        task(async () => {
                          await api("/skills/apply", "POST", {
                            plan_id: skillPlan.plan_id,
                          });
                          setSkillPlan(null);
                          setMessage(tr("官方 Skill 已安装"));
                          await skillInstalls.refetch();
                        })
                      }
                    >
                      {tr("确认安装官方 Skill")}
                    </Button>
                  )}
                </>
              )}
              {skillInstalls.data?.filter((s: any) => s.status !== "removed")
                .length ? (
                skillInstalls.data
                  .filter((s: any) => s.status !== "removed")
                  .map((s: any) => (
                    <div className="record" key={s.id}>
                      <div>
                        <strong>
                          {s.runtime} · {s.scope}
                        </strong>
                        <span className="badge">{tr("已写入")}</span>
                      </div>
                      <div className="row">
                        <Button
                          disabled={busy}
                          variant="danger"
                          onClick={() =>
                            task(async () => {
                              await api(`/skills/${s.id}/remove`, "POST", {});
                              setMessage(tr("Skill 已卸载"));
                              await skillInstalls.refetch();
                            })
                          }
                        >
                          {tr("卸载 Skill")}
                        </Button>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="muted">{tr("尚未安装官方 Skill。")}</p>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-title">
              <h2>{tr("已准备的接入")}</h2>
            </div>
            <div className="panel-body stack">
              {installations.data?.length === 0 ? (
                <p>{tr("尚无接入配置。")}</p>
              ) : (
                installations.data?.map((i: any) => (
                  <div className="record" key={i.id}>
                    <div>
                      <strong>
                        {i.runtime} · {i.scope}
                      </strong>
                      <span className="badge">
                        {i.status === "configured"
                          ? tr("已写入")
                          : i.status === "planned"
                            ? tr("待执行命令")
                            : i.status === "removed"
                              ? tr("已撤销")
                              : i.status}
                      </span>
                    </div>
                    <code className="break">{i.config_path}</code>
                    <small>
                      {i.last_test_status ?? tr("尚未连接测试")}{" "}
                      {tr("· 连接测试不会进行付费推理。")}
                    </small>
                    <div className="row">
                      <Button
                        disabled={busy || i.status === "removed"}
                        onClick={() =>
                          task(async () => {
                            const r = await api(
                              `/integrations/${i.id}/test`,
                              "POST",
                              {},
                            );
                            setMessage(tr(r.message));
                            await installations.refetch();
                          })
                        }
                      >
                        {tr("测试连接")}
                      </Button>
                      <Button
                        disabled={busy || i.status === "removed"}
                        onClick={() =>
                          task(async () => {
                            const r = await api(
                              `/integrations/${i.id}/remove`,
                              "POST",
                              {},
                            );
                            setMessage(
                              (r.message ? tr(r.message) : undefined) ??
                                tr("接入已撤销，其他条目保留"),
                            );
                            await installations.refetch();
                            await clients.refetch();
                          })
                        }
                      >
                        {tr("撤销接入")}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          <Notice>
            {tr(
              "目标 Agent 需重新加载配置。桥初始化通过不代表 Agent 已调用模型；真实执行结果可在调用记录中查看。",
            )}
          </Notice>
        </>
      )}
      <Drawer
        open={drawer}
        onClose={() => {
          setDrawer(false);
          setShownToken("");
        }}
        title={editing ? tr("编辑客户端授权") : tr("创建客户端凭证")}
      >
        <div className="stack">
          <Field label={tr("客户端名称")}>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <GrantPicker />
          <label className="check">
            <input
              type="checkbox"
              checked={officialInvoke}
              onChange={(e) => setOfficialInvoke(e.target.checked)}
            />
            <span>{tr("允许官方 Jev 调用")}</span>
          </label>
          <p className="muted">
            {tr(
              "勾选后可用同一 Token 调用 POST /v1/systemone 与 GET /v1/models，按官方合同传参，费用记在本机 TypeSafe Key 上。默认关闭。",
            )}
          </p>
          {shownToken ? (
            <>
              <Notice>
                {tr(
                  "Token 仅展示这一次，请立即保存。关闭抽屉后无法找回，可撤销后重建。",
                )}
              </Notice>
              <code className="break">{shownToken}</code>
              <Button onClick={() => navigator.clipboard.writeText(shownToken)}>
                {tr("复制 Token")}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              disabled={busy || !name}
              onClick={() =>
                task(async () => {
                  if (editing) {
                    await api("/clients/" + editing, "PATCH", {
                      name,
                      grants,
                      official_invoke: officialInvoke,
                    });
                    setDrawer(false);
                  } else {
                    const r = await api("/clients", "POST", {
                      name,
                      kind: "api",
                      grants,
                      official_invoke: officialInvoke,
                    });
                    setShownToken(r.token);
                  }
                  await clients.refetch();
                })
              }
            >
              {editing ? tr("保存授权") : tr("创建凭证")}
            </Button>
          )}
        </div>
      </Drawer>
    </>
  );
}
