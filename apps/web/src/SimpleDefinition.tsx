import { tr } from "./i18n";
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
    <div className="sheet simple-definition">
      <label className="sheet-row">
        <div className="sheet-copy">
          <strong>{tr("函数名称")}</strong>
          <p>{tr("列表和调用方看到的名字。")}</p>
        </div>
        <input
          aria-label={tr("函数名称")}
          value={c.name}
          onChange={(e) => change((v) => (v.name = e.target.value))}
        />
      </label>
      {Object.entries(c.questions).map(([id, q]: [string, any]) => (
        <section className="sheet-group" key={id}>
          <div className="sheet-row">
            <div className="sheet-copy">
              <strong>{tr("判断说明")}</strong>
              <p className="row">
                <span className={"primitive-tag type-" + q.type}>
                  {q.type[0].toUpperCase() + q.type.slice(1)}
                </span>
                {Object.keys(c.questions).length > 1 && <code>{id}</code>}
                <span>
                  {tr(
                    q.type === "noul"
                      ? "判断是否成立"
                      : q.type === "choice"
                        ? "从选项中分类"
                        : "按有序档位评分",
                  )}
                </span>
              </p>
            </div>
            <textarea
              aria-label={tr("判断说明")}
              rows={3}
              value={q.instructions}
              onChange={(e) =>
                change((v) => (v.questions[id].instructions = e.target.value))
              }
            />
          </div>
          {q.type === "choice" && (
            <div className="sheet-row stacked">
              <div className="sheet-copy">
                <strong>{tr("判断标准")}</strong>
                <p>{tr("左边是返回给调用方的值，右边是给模型的说明。")}</p>
              </div>
              <div className="option-list">
                {Object.entries(q.criteria).map(([key, value]) => (
                  <label className="option-row" key={key}>
                    <code>{key}</code>
                    <input
                      aria-label={tr("选项说明 ") + key}
                      value={String(value ?? "")}
                      onChange={(e) =>
                        change(
                          (v) =>
                            (v.questions[id].criteria[key] = e.target.value),
                        )
                      }
                    />
                  </label>
                ))}
                <small>{tr("添加或删除选项，请展开高级配置。")}</small>
              </div>
            </div>
          )}
          {q.type === "score" && (
            <div className="sheet-row stacked">
              <div className="sheet-copy">
                <strong>{tr("判断标准")}</strong>
                <p>{tr("等级按从低到高排列，返回从 0 开始的索引。")}</p>
              </div>
              <div className="option-list">
                {q.criteria.map((value: string, i: number) => (
                  <label className="option-row" key={i}>
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
              </div>
            </div>
          )}
          {q.type === "noul" && (
            <div className="sheet-row">
              <div className="sheet-copy">
                <strong>{tr("是的标准（可选）")}</strong>
                <p>{tr("Noul 返回是的概率，没有独立 confidence。")}</p>
              </div>
              <textarea
                aria-label={tr("是的标准（可选）")}
                rows={1}
                value={q.criteria?.true ?? ""}
                onChange={(e) =>
                  change((v) => {
                    v.questions[id].criteria ??= {};
                    v.questions[id].criteria.true = e.target.value;
                  })
                }
              />
            </div>
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
