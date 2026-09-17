import { useSyncExternalStore } from "react";
import english from "./en.json";
const chinese = Object.fromEntries(Object.entries(english).map(([zh, en]) => [en, zh]));
export type Language = "zh" | "en";
let language: Language = (() => {
  try {
    return localStorage.getItem("jev-language") === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
})();
const listeners = new Set<() => void>();
export function getLanguage() {
  return language;
}
export function setLanguage(value: Language) {
  language = value;
  try {
    localStorage.setItem("jev-language", value);
  } catch {}
  document.documentElement.lang = value === "en" ? "en" : "zh-CN";
  document.title =
    value === "en" ? "Jev Workbench · Functions" : "Jev Workbench · 判断函数";
  for (const listener of listeners) listener();
}
export function useLanguage() {
  return useSyncExternalStore((callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }, getLanguage);
}
export function tr(key: string, ...values: unknown[]) {
  const normalized = key.trim().replace(/\s+/g, " ");
  let text =
    language === "en"
      ? (english as Record<string, string>)[normalized] === undefined
        ? key
        : (key.match(/^\s*/)?.[0] ?? "") +
          (english as Record<string, string>)[normalized] +
          (key.match(/\s*$/)?.[0] ?? "")
      : (chinese[normalized] ?? key);
  values.forEach(
    (value, i) => (text = text.replaceAll("{" + i + "}", String(value))),
  );
  return text;
}
export function dateTime(value: string) {
  return new Date(value).toLocaleString(language === "en" ? "en-US" : "zh-CN");
}
export function localizeNewConfig(config: any) {
  if (language === "zh") return config;
  const c = structuredClone(config);
  for (const k of ["name", "description", "when_to_use"]) c[k] = tr(c[k]);
  for (const f of Object.values(c.input_schema.properties) as any[])
    if (f.description) f.description = tr(f.description);
  for (const q of Object.values(c.questions) as any[]) {
    q.instructions = tr(q.instructions);
    if (Array.isArray(q.criteria))
      q.criteria = q.criteria.map((v: string) => tr(v));
    else if (q.criteria)
      q.criteria = Object.fromEntries(
        Object.entries(q.criteria).map(([k, v]) => [
          k,
          typeof v === "string" ? tr(v) : v,
        ]),
      );
  }
  return c;
}
