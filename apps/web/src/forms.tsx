import { tr } from "./i18n";
import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button, Field, Notice, JsonEditor } from "./ui";
import { pretty } from "./api";
function inferred(c: any) {
  const properties: any = {};
  for (const [k, m] of Object.entries(c.output_mapping) as any) {
    const [, root, id, part] = m.source.split("/");
    let s: any;
    if (root === "input") s = { ...c.input_schema.properties[id] };
    else {
      const q = c.questions[id];
      s =
        part === "choice" && q?.type === "choice"
          ? { enum: Object.keys(q.criteria) }
          : { type: "number" };
    }
    if (m.enum_map) s = { enum: Object.values(m.enum_map) };
    if (Object.hasOwn(m, "on_review")) {
      if (s.enum) s.enum = [...new Set([...s.enum, m.on_review])];
      else if (m.on_review === null) s = { ...s, type: [s.type, "null"] };
    }
    properties[k] = s;
  }
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
export function ConfigForms({
  tab,
  config: c,
  setConfig,
  published,
  sampleInput,
}: {
  tab: string;
  config: any;
  setConfig: (v: any) => void;
  published: boolean;
  sampleInput: any;
}) {
  const [message, setMessage] = useState("");
  const change = (fn: (v: any) => void, derive = false) => {
    const copy = structuredClone(c);
    fn(copy);
    if (derive) copy.output_schema = inferred(copy);
    setConfig(copy);
  };
  const remove = (obj: any, key: string) => {
    delete obj[key];
  };
  const rename = (obj: any, old: string, key: string) => {
    if (old === key || !key || Object.hasOwn(obj, key)) return;
    obj[key] = obj[old];
    delete obj[old];
  };
  const sources = Object.entries(c.questions)
    .flatMap(([id, q]: [string, any]) =>
      q.type === "noul"
        ? [`/answers/${id}/noul`]
        : q.type === "choice"
          ? [`/answers/${id}/choice`, `/answers/${id}/confidence`]
          : [`/answers/${id}/score`, `/answers/${id}/confidence`],
    )
    .concat(Object.keys(c.input_schema.properties).map((k) => "/input/" + k));
  if (tab === "基本信息")
    return (
      <div className="stack">
        <Field label={tr("函数名称")}>
          <input
            value={c.name}
            onChange={(e) => change((v) => (v.name = e.target.value))}
          />
        </Field>
        <Field
          label={tr("函数 Key")}
          hint={
            published
              ? tr("已发布，Key 不可更改")
              : tr("使用英文字母、数字与下划线，以字母开头")
          }
        >
          <input
            value={c.key}
            disabled={published}
            onChange={(e) => change((v) => (v.key = e.target.value))}
          />
        </Field>
        <Field label={tr("用途说明")}>
          <textarea
            value={c.description}
            onChange={(e) => change((v) => (v.description = e.target.value))}
          />
        </Field>
        <Field
          label={tr("Agent 何时使用")}
          hint={tr("这是工具说明，不会自动触发 Agent。")}
        >
          <textarea
            rows={3}
            value={c.when_to_use}
            onChange={(e) => change((v) => (v.when_to_use = e.target.value))}
          />
        </Field>
        <Field
          label={tr("模型版本")}
          hint={tr("草稿可探索别名；发布需要固定版本，并成功试跑确认。")}
        >
          <input
            value={c.model}
            onChange={(e) => change((v) => (v.model = e.target.value))}
          />
        </Field>
        <Notice>
          {tr(
            "一份配置可包含多个独立问题。所有问题看到相同输入，不能读取彼此答案。",
          )}
        </Notice>
      </div>
    );
  if (tab === "输入")
    return (
      <div className="stack">
        <p className="muted">
          {tr("定义调用方提交的字段，以及发送给模型时的名称。")}
        </p>
        {Object.entries(c.input_schema.properties).map(
          ([k, f]: [string, any]) => (
            <div className="form-section" key={k}>
              <div className="row">
                <Field label={tr("字段名")}>
                  <input
                    defaultValue={k}
                    onBlur={(e) =>
                      change((v) => {
                        const n = e.target.value;
                        rename(v.input_schema.properties, k, n);
                        if (n && n !== k) {
                          v.input_schema.required = v.input_schema.required.map(
                            (x: string) => (x === k ? n : x),
                          );
                          for (const sk of Object.keys(v.state_mapping))
                            if (v.state_mapping[sk] === "/" + k)
                              v.state_mapping[sk] = "/" + n;
                        }
                      })
                    }
                  />
                </Field>
                <Field label={tr("类型")}>
                  <select
                    value={f.type}
                    onChange={(e) =>
                      change((v) => {
                        v.input_schema.properties[k] = {
                          type: e.target.value,
                          description: f.description,
                          ...(e.target.value === "array"
                            ? { items: { type: "string" } }
                            : {}),
                        };
                      })
                    }
                  >
                    <option value="string">{tr("string · 文本")}</option>
                    <option value="number">{tr("number · 数字")}</option>
                    <option value="boolean">{tr("boolean · 布尔")}</option>
                    <option value="array">{tr("string[] · 文本数组")}</option>
                  </select>
                </Field>
                <Button
                  aria-label={tr("删除字段 ") + k}
                  onClick={() =>
                    change((v) => {
                      remove(v.input_schema.properties, k);
                      v.input_schema.required = v.input_schema.required.filter(
                        (x: string) => x !== k,
                      );
                      for (const sk of Object.keys(v.state_mapping))
                        if (v.state_mapping[sk] === "/" + k)
                          delete v.state_mapping[sk];
                    })
                  }
                >
                  <Trash2 size={15} />
                </Button>
              </div>
              <div className="row">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={c.input_schema.required.includes(k)}
                    onChange={(e) =>
                      change(
                        (v) =>
                          (v.input_schema.required = e.target.checked
                            ? [...v.input_schema.required, k]
                            : v.input_schema.required.filter(
                                (x: string) => x !== k,
                              )),
                      )
                    }
                  />
                  {tr("必填")}
                </label>
                <Field label={tr("说明")}>
                  <input
                    value={f.description ?? ""}
                    onChange={(e) =>
                      change(
                        (v) =>
                          (v.input_schema.properties[k].description =
                            e.target.value),
                      )
                    }
                  />
                </Field>
              </div>
              {["string", "number"].includes(f.type) && (
                <div className="row">
                  {(f.type === "string"
                    ? ["minLength", "maxLength"]
                    : ["minimum", "maximum"]
                  ).map((p, i) => (
                    <Field
                      key={p}
                      label={
                        i === 0 ? tr("最小值 / 长度") : tr("最大值 / 长度")
                      }
                    >
                      <input
                        type="number"
                        value={f[p] ?? ""}
                        onChange={(e) =>
                          change((v) => {
                            if (e.target.value === "")
                              delete v.input_schema.properties[k][p];
                            else
                              v.input_schema.properties[k][p] = Number(
                                e.target.value,
                              );
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
              )}
              <Field label={tr("模型 state 字段名")}>
                <input
                  defaultValue={
                    Object.keys(c.state_mapping).find(
                      (n) => c.state_mapping[n] === "/" + k,
                    ) ?? ""
                  }
                  onBlur={(e) =>
                    change((v) => {
                      for (const n of Object.keys(v.state_mapping))
                        if (v.state_mapping[n] === "/" + k)
                          delete v.state_mapping[n];
                      if (e.target.value)
                        v.state_mapping[e.target.value] = "/" + k;
                    })
                  }
                />
              </Field>
            </div>
          ),
        )}
        <div className="row">
          <Button
            onClick={() =>
              change((v) => {
                let k = "field";
                while (v.input_schema.properties[k]) k += "_new";
                v.input_schema.properties[k] = {
                  type: "string",
                  description: "",
                  maxLength: 12000,
                };
                v.state_mapping[k] = "/" + k;
              })
            }
          >
            <Plus size={14} />
            {tr("添加字段")}
          </Button>
          <Button
            onClick={() => {
              if (!sampleInput || Array.isArray(sampleInput)) {
                setMessage(tr("请先在试跑区填写一个有效 JSON 对象"));
                return;
              }
              change((v) => {
                v.input_schema.properties = Object.fromEntries(
                  Object.entries(sampleInput).map(([k, x]) => [
                    k,
                    {
                      type: Array.isArray(x) ? "array" : typeof x,
                      ...(Array.isArray(x)
                        ? { items: { type: "string" } }
                        : {}),
                    },
                  ]),
                );
                v.input_schema.required = Object.keys(sampleInput);
                v.state_mapping = Object.fromEntries(
                  Object.keys(sampleInput).map((k) => [k, "/" + k]),
                );
              });
            }}
          >
            {tr("从试跑 JSON 推导")}
          </Button>
        </div>
        {message && <Notice>{message}</Notice>}
        <details>
          <summary>{tr("输入 Schema")}</summary>
          <JsonEditor value={pretty(c.input_schema)} readOnly />
        </details>
      </div>
    );
  if (tab === "问题")
    return (
      <div className="stack">
        {Object.entries(c.questions).map(([id, q]: [string, any]) => (
          <div className="form-section" key={id}>
            <div className="row between">
              <Field label={tr("问题 ID")}>
                <input
                  defaultValue={id}
                  onBlur={(e) =>
                    change((v) => rename(v.questions, id, e.target.value))
                  }
                />
              </Field>
              <span className="badge">{q.type.toUpperCase()}</span>
              <Button
                aria-label={tr("删除问题 ") + id}
                onClick={() => change((v) => remove(v.questions, id))}
              >
                <Trash2 size={15} />
              </Button>
            </div>
            <Field label={tr("判断说明")}>
              <textarea
                rows={3}
                value={q.instructions}
                onChange={(e) =>
                  change((v) => (v.questions[id].instructions = e.target.value))
                }
              />
            </Field>
            {q.type === "choice" ? (
              <>
                <div className="row muted">
                  <span>{tr("稳定返回值")}</span>
                  <span>{tr("判断标准")}</span>
                </div>
                {Object.entries(q.criteria).map(
                  ([key, text]: [string, any]) => (
                    <div className="row" key={key}>
                      <input
                        aria-label={tr("选项 ") + key}
                        defaultValue={key}
                        onBlur={(e) =>
                          change(
                            (v) =>
                              rename(
                                v.questions[id].criteria,
                                key,
                                e.target.value,
                              ),
                            true,
                          )
                        }
                      />
                      <input
                        aria-label={tr("选项说明 ") + key}
                        value={text ?? ""}
                        onChange={(e) =>
                          change(
                            (v) =>
                              (v.questions[id].criteria[key] = e.target.value),
                          )
                        }
                      />
                      <Button
                        aria-label={tr("删除选项 ") + key}
                        onClick={() =>
                          change(
                            (v) => remove(v.questions[id].criteria, key),
                            true,
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ),
                )}
                <Button
                  onClick={() =>
                    change((v) => {
                      let k = "option";
                      while (v.questions[id].criteria[k] !== undefined)
                        k += "_new";
                      v.questions[id].criteria[k] = "";
                    }, true)
                  }
                >
                  {tr("添加选项")}
                </Button>
              </>
            ) : q.type === "score" ? (
              <>
                {q.criteria.map((text: string, i: number) => (
                  <div className="row" key={i}>
                    <code>{i}</code>
                    <input
                      aria-label={tr("等级 {0}", i)}
                      value={text}
                      onChange={(e) =>
                        change(
                          (v) => (v.questions[id].criteria[i] = e.target.value),
                        )
                      }
                    />
                    <Button
                      disabled={i === 0}
                      aria-label={tr("上移等级")}
                      onClick={() =>
                        change((v) => {
                          const a = v.questions[id].criteria;
                          [a[i], a[i - 1]] = [a[i - 1], a[i]];
                        })
                      }
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      aria-label={tr("删除等级")}
                      onClick={() =>
                        change((v) => v.questions[id].criteria.splice(i, 1))
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={() =>
                    change((v) => v.questions[id].criteria.push(tr("新等级")))
                  }
                >
                  {tr("添加等级")}
                </Button>
                <small>
                  {tr("移动等级会改变索引含义，需发布新版本并检查下游。")}
                </small>
              </>
            ) : (
              <>
                {["true", "false"].map((k) => (
                  <Field
                    key={k}
                    label={
                      k === "true"
                        ? tr("是的标准（可选）")
                        : tr("否的标准（可选）")
                    }
                  >
                    <input
                      value={q.criteria?.[k] ?? ""}
                      onChange={(e) =>
                        change((v) => {
                          v.questions[id].criteria ??= {};
                          v.questions[id].criteria[k] = e.target.value;
                        })
                      }
                    />
                  </Field>
                ))}
                <small>{tr("Noul 返回是的概率，没有独立 confidence。")}</small>
              </>
            )}
          </div>
        ))}
        <div className="row">
          {["noul", "choice", "score"].map((type) => (
            <Button
              key={type}
              onClick={() =>
                change((v) => {
                  let id = type;
                  while (v.questions[id]) id += "_new";
                  v.questions[id] = {
                    type,
                    instructions: tr("请填写完整的判断说明"),
                    ...(type === "choice"
                      ? { criteria: { yes: tr("符合"), no: tr("不符合") } }
                      : type === "score"
                        ? { criteria: ["低", "高"] }
                        : {}),
                  };
                })
              }
            >
              <Plus size={14} />
              {type === "noul"
                ? tr("是非 Noul")
                : type === "choice"
                  ? tr("分类 Choice")
                  : tr("评分 Score")}
            </Button>
          ))}
        </div>
      </div>
    );
  return (
    <div className="stack">
      <h3>{tr("业务输出")}</h3>
      {Object.entries(c.output_mapping).map(([k, m]: [string, any]) => (
        <div className="form-section" key={k}>
          <div className="row">
            <Field label={tr("返回字段")}>
              <input
                defaultValue={k}
                onBlur={(e) =>
                  change(
                    (v) => rename(v.output_mapping, k, e.target.value),
                    true,
                  )
                }
              />
            </Field>
            <Field label={tr("来源")}>
              <select
                value={m.source}
                onChange={(e) =>
                  change(
                    (v) => (v.output_mapping[k].source = e.target.value),
                    true,
                  )
                }
              >
                {sources.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Button
              aria-label={tr("删除输出 ") + k}
              onClick={() => change((v) => remove(v.output_mapping, k), true)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={Object.hasOwn(m, "on_review") && m.on_review === null}
              onChange={(e) =>
                change((v) => {
                  if (e.target.checked) v.output_mapping[k].on_review = null;
                  else delete v.output_mapping[k].on_review;
                }, true)
              }
            />
            {tr("需要复核时置空")}
          </label>
          <details>
            <summary>{tr("枚举映射（高级）")}</summary>
            <textarea
              aria-label={tr("枚举映射 ") + k}
              defaultValue={pretty(m.enum_map ?? {})}
              onBlur={(e) => {
                try {
                  const value = JSON.parse(e.target.value);
                  change((v) => {
                    if (Object.keys(value).length)
                      v.output_mapping[k].enum_map = value;
                    else delete v.output_mapping[k].enum_map;
                  }, true);
                  setMessage("");
                } catch {
                  setMessage(tr("枚举映射不是有效 JSON"));
                }
              }}
            />
          </details>
        </div>
      ))}
      <Button
        onClick={() =>
          change((v) => {
            let k = "result";
            while (v.output_mapping[k]) k += "_new";
            v.output_mapping[k] = { source: sources[0] ?? "" };
          }, true)
        }
      >
        <Plus size={14} /> {tr("添加输出字段")}
      </Button>
      <hr />
      <div className="row between">
        <h3>{tr("复核规则")}</h3>
        <select
          aria-label={tr("规则匹配模式")}
          value={c.review.match}
          onChange={(e) => change((v) => (v.review.match = e.target.value))}
        >
          <option value="any">{tr("任意条件命中")}</option>
          <option value="all">{tr("全部条件命中")}</option>
        </select>
      </div>
      <p className="muted">
        {tr("阈值是业务策略，不是模型正确率。规则为空时不触发复核。")}
      </p>
      {c.review.rules.map((r: any, i: number) => (
        <div className="form-section" key={i}>
          <div className="row">
            <Field label={tr("规则 ID")}>
              <input
                value={r.id}
                onChange={(e) =>
                  change((v) => (v.review.rules[i].id = e.target.value))
                }
              />
            </Field>
            <Button
              aria-label={tr("删除规则 ") + r.id}
              onClick={() => change((v) => v.review.rules.splice(i, 1))}
            >
              <Trash2 size={14} />
            </Button>
          </div>
          <Field label={tr("判断来源")}>
            <select
              value={r.source}
              onChange={(e) =>
                change((v) => (v.review.rules[i].source = e.target.value))
              }
            >
              {sources.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <div className="row">
            <Field label={tr("比较")}>
              <select
                value={r.operator}
                onChange={(e) =>
                  change((v) => (v.review.rules[i].operator = e.target.value))
                }
              >
                {[
                  "eq",
                  "ne",
                  "lt",
                  "lte",
                  "gt",
                  "gte",
                  "in",
                  "between_exclusive",
                ].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label={tr("值（JSON）")}>
              <input
                key={r.id + r.operator}
                defaultValue={JSON.stringify(r.value)}
                onBlur={(e) => {
                  try {
                    const value = JSON.parse(e.target.value);
                    change((v) => (v.review.rules[i].value = value));
                    setMessage("");
                  } catch {
                    setMessage(
                      tr("规则值需为 JSON：文本请加双引号，区间使用 [0.2,0.8]"),
                    );
                  }
                }}
              />
            </Field>
          </div>
        </div>
      ))}
      <Button
        onClick={() =>
          change((v) =>
            v.review.rules.push({
              id: "rule_" + (v.review.rules.length + 1),
              source:
                sources.find(
                  (s) => s.endsWith("confidence") || s.endsWith("noul"),
                ) ?? sources[0],
              operator: "lt",
              value: 0.8,
            }),
          )
        }
      >
        {tr("添加复核规则")}
      </Button>
      {message && <Notice error>{message}</Notice>}
      <details>
        <summary>{tr("输出 Schema（随映射生成，可用高级 JSON 收紧）")}</summary>
        <JsonEditor value={pretty(c.output_schema)} readOnly />
      </details>
    </div>
  );
}
