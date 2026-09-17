import { tr } from "./i18n";
import { Field, Button } from "./ui";
export function SimpleDefinition({
  config: c,
  setConfig,
}: {
  config: any;
  setConfig: (c: any) => void;
}) {
  const change = (fn: (v: any) => void) => {
    const v = structuredClone(c);
    fn(v);
    setConfig(v);
  };
  return (
    <div className="stack simple-definition">
      <Field label={tr("函数名称")}>
        <input
          value={c.name}
          onChange={(e) => change((v) => (v.name = e.target.value))}
        />
      </Field>
      {Object.entries(c.questions).map(([id, q]: [string, any]) => (
        <section className="simple-question" key={id}>
          <div className="row between">
            <span className="primitive-tag">
              {q.type[0].toUpperCase() + q.type.slice(1)}
            </span>
            {Object.keys(c.questions).length > 1 && <code>{id}</code>}
            <small>
              {tr(
                q.type === "noul"
                  ? "判断是否成立"
                  : q.type === "choice"
                    ? "从选项中分类"
                    : "按有序档位评分",
              )}
            </small>
          </div>
          <Field label={tr("判断说明")}>
            <textarea
              rows={4}
              value={q.instructions}
              onChange={(e) =>
                change((v) => (v.questions[id].instructions = e.target.value))
              }
            />
          </Field>
          {q.type === "choice" && (
            <div className="criteria-list">
              <div className="criteria-label">
                <span>{tr("稳定返回值")}</span>
                <span>{tr("判断标准")}</span>
              </div>
              {Object.entries(q.criteria).map(([key, value]) => (
                <label className="criterion" key={key}>
                  <code>{key}</code>
                  <input
                    aria-label={tr("选项说明 ") + key}
                    value={String(value ?? "")}
                    onChange={(e) =>
                      change(
                        (v) => (v.questions[id].criteria[key] = e.target.value),
                      )
                    }
                  />
                </label>
              ))}
              <small>{tr("添加或删除选项，请展开高级配置。")}</small>
            </div>
          )}
          {q.type === "score" && (
            <div className="criteria-list">
              {q.criteria.map((value: string, i: number) => (
                <label className="criterion" key={i}>
                  <code>{i}</code>
                  <input
                    aria-label={tr("等级 {0}", i)}
                    value={value}
                    onChange={(e) =>
                      change(
                        (v) => (v.questions[id].criteria[i] = e.target.value),
                      )
                    }
                  />
                </label>
              ))}
              <small>{tr("等级按从低到高排列，返回从 0 开始的索引。")}</small>
            </div>
          )}
          {q.type === "noul" && (
            <>
              <Field label={tr("是的标准（可选）")}>
                <textarea
                  rows={2}
                  value={q.criteria?.true ?? ""}
                  onChange={(e) =>
                    change((v) => {
                      v.questions[id].criteria ??= {};
                      v.questions[id].criteria.true = e.target.value;
                    })
                  }
                />
              </Field>
              <small>{tr("Noul 返回是的概率，没有独立 confidence。")}</small>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
export function AnswerSummary({ result }: { result: any }) {
  return (
    <div className="answer-summary">
      {Object.entries(result.debug?.answers ?? {}).map(
        ([id, a]: [string, any]) => (
          <div key={id} className="answer-item">
            {Object.keys(result.debug.answers).length > 1 && <code>{id}</code>}
            <div className="answer-value">
              {a.type === "noul"
                ? a.noul.toFixed(2)
                : a.type === "choice"
                  ? a.choice
                  : a.score}
              <small>
                {a.type === "noul"
                  ? tr("成立概率")
                  : a.type === "score"
                    ? a.legend?.[String(a.score)]
                    : tr("分类结果")}
              </small>
            </div>
            {a.type === "noul" ? (
              <>
                <div className="answer-meter">
                  <i style={{ width: 100 * a.noul + "%" }} />
                </div>
                <div className="answer-scale">
                  <span>0</span>
                  <span>0.5</span>
                  <span>1</span>
                </div>
              </>
            ) : a.type === "choice" ? (
              Object.entries(a.probabilities).map(([k, v]) => (
                <div className="probability-row" key={k}>
                  <code>{k}</code>
                  <div className="answer-meter">
                    <i style={{ width: 100 * Number(v) + "%" }} />
                  </div>
                  <small>{(100 * Number(v)).toFixed(1)}%</small>
                </div>
              ))
            ) : (
              <div className="score-legend">
                {Object.entries(a.legend).map(([k, v]) => (
                  <span
                    className={Number(k) === a.score ? "chosen" : ""}
                    key={k}
                  >
                    <strong>{k}</strong>
                    {String(v)}
                  </span>
                ))}
              </div>
            )}
            {a.confidence !== undefined && (
              <small>
                {tr("置信度")} {a.confidence.toFixed(2)}
              </small>
            )}
          </div>
        ),
      )}
    </div>
  );
}
