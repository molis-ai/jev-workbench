import { pretty, sample, shellQuote } from "./api";
export function snippet(
  language: string,
  endpoint: string,
  version: number,
  schema: any,
) {
  const payload = { version, input: sample(schema) };
  if (language === "cURL")
    return `curl ${shellQuote(endpoint)} \\\n  -H "Authorization: Bearer $JEV_CLIENT_TOKEN" \\\n  -H 'Content-Type: application/json' \\\n  -d ${shellQuote(JSON.stringify(payload))}`;
  if (language === "Python")
    return `import json, os, requests\nresponse = requests.post(\n    ${JSON.stringify(endpoint)},\n    headers={"Authorization": "Bearer " + os.environ["JEV_CLIENT_TOKEN"]},\n    json=json.loads(${JSON.stringify(JSON.stringify(payload))}),\n    timeout=35,\n)\nresponse.raise_for_status()\nprint(response.json())`;
  return `const response = await fetch(${JSON.stringify(endpoint)}, {\n  method: 'POST',\n  headers: { Authorization: 'Bearer ' + process.env.JEV_CLIENT_TOKEN, 'Content-Type': 'application/json' },\n  body: JSON.stringify(${pretty(payload)}),\n  signal: AbortSignal.timeout(35000),\n});\nconst result = await response.json();\nif (!response.ok) throw new Error(result.error.message);\nconsole.log(result);`;
}
export function officialSnippet(language: string, origin: string) {
  const endpoint = origin.replace(/\/$/, "") + "/v1/systemone";
  const payload = {
    model: "jev-1.13.0",
    state: "Please refund the duplicate charge.",
    questions: {
      is_billing: {
        type: "noul",
        instructions: "Is this a billing or refund issue?",
      },
    },
  };
  if (language === "cURL")
    return `curl ${shellQuote(endpoint)} \\\n  -H "Authorization: Bearer $JEV_CLIENT_TOKEN" \\\n  -H 'Content-Type: application/json' \\\n  -d ${shellQuote(JSON.stringify(payload))}`;
  if (language === "Python")
    return `import json, os, requests\nresponse = requests.post(\n    ${JSON.stringify(endpoint)},\n    headers={"Authorization": "Bearer " + os.environ["JEV_CLIENT_TOKEN"]},\n    json=json.loads(${JSON.stringify(JSON.stringify(payload))}),\n    timeout=35,\n)\nresponse.raise_for_status()\nprint(response.json())`;
  return `const response = await fetch(${JSON.stringify(endpoint)}, {\n  method: 'POST',\n  headers: { Authorization: 'Bearer ' + process.env.JEV_CLIENT_TOKEN, 'Content-Type': 'application/json' },\n  body: JSON.stringify(${pretty(payload)}),\n  signal: AbortSignal.timeout(35000),\n});\nconst result = await response.json();\nif (!response.ok) throw new Error(result.error.message);\nconsole.log(result);`;
}
