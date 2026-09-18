export const RUNTIME_IDS = [
  "claude_code",
  "codex",
  "opencode",
  "pi",
  "gemini",
  "grok_build",
  "hermes",
  "minimax_code",
  "openclaw",
] as const;
export type Runtime = (typeof RUNTIME_IDS)[number];

export const skillAgents: Partial<Record<Runtime, string>> = {
  claude_code: "claude-code",
  codex: "codex",
  opencode: "opencode",
  pi: "pi",
  gemini: "gemini-cli",
  grok_build: "grok",
  hermes: "hermes-agent",
  minimax_code: "minimax-code",
  openclaw: "openclaw",
};

export const detectCommands: Partial<Record<Runtime, string>> = {
  claude_code: "claude",
  codex: "codex",
  opencode: "opencode",
  pi: "pi",
  gemini: "gemini",
  grok_build: "grok",
  hermes: "hermes",
  minimax_code: "minimax",
  openclaw: "openclaw",
};

export function hasMcp(runtime: Runtime) {
  return runtime !== "openclaw";
}
