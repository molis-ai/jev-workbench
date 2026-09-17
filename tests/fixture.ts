import type { Provider } from "../apps/server/src/provider";
export const fixture: Provider = {
  fixture: true,
  async models() {
    return { models: ["jev-1.13.0"] };
  },
  async evaluate(request, signal, onAttempt) {
    signal.throwIfAborted();
    onAttempt();
    const ambiguous = JSON.stringify(request.state).includes("不清楚");
    const answers: any = {};
    for (const [key, q] of Object.entries(request.questions) as any) {
      if (q.type === "noul")
        answers[key] = { type: "noul", noul: ambiguous ? 0.5 : 0.95 };
      else if (q.type === "choice") {
        const keys = Object.keys(q.criteria),
          winner = ambiguous && keys.includes("other") ? "other" : keys[0];
        answers[key] = {
          type: "choice",
          choice: winner,
          confidence: ambiguous ? 0.45 : 0.94,
          probabilities: Object.fromEntries(
            keys.map((k) => [
              k,
              k === winner ? 0.94 : 0.06 / (keys.length - 1),
            ]),
          ),
        };
      } else
        answers[key] = {
          type: "score",
          score: 1,
          confidence: 0.9,
          legend: Object.fromEntries(
            q.criteria.map((s: string, i: number) => [String(i), s]),
          ),
          probabilities: Object.fromEntries(
            q.criteria.map((_: string, i: number) => [
              String(i),
              i === 1 ? 1 : 0,
            ]),
          ),
        };
    }
    return {
      model: request.model,
      answers,
      usage: { input_tokens: 42, output_tokens: 16 },
    };
  },
};
