import { getLanguage, tr } from "./i18n";
export let demoMode = false;
export function setDemoMode(v: boolean) {
  demoMode = v;
}
export let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
  options: { headers?: Record<string, string>; signal?: AbortSignal } = {},
) {
  const r = await fetch("/api/admin" + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      "x-csrf-token": csrf,
      "Accept-Language": getLanguage(),
      ...options.headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: options.signal,
  });
  const data = await r.json();
  if (!r.ok) {
    const e = new Error(data.error?.message ?? tr("请求失败")) as any;
    e.fields = data.error?.fields;
    e.code = data.error?.code;
    throw e;
  }
  return data;
}
export const pretty = (v: unknown) => JSON.stringify(v, null, 2);
export function sample(schema: any) {
  return Object.fromEntries(
    Object.entries(schema.properties).map(([k, s]: [string, any]) => {
      let value: any = s.enum?.[0];
      if (value === undefined) {
        if (s.type === "number")
          value = Math.max(
            s.minimum ?? -Infinity,
            Math.min(s.maximum ?? Infinity, 0),
          );
        else if (s.type === "boolean") value = false;
        else if (s.type === "array") value = [];
        else
          value = (s.description || tr("示例内容"))
            .padEnd(s.minLength ?? 0, tr("文"))
            .slice(0, s.maxLength ?? 12000);
      }
      return [k, value];
    }),
  );
}
export function shellQuote(text: string) {
  return "'" + text.replaceAll("'", "'\\''") + "'";
}
