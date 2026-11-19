import { readFile } from "node:fs/promises";
import path from "node:path";

export const PROMPTS_DIR = path.join(process.cwd(), "prompts");

/** Fills {{name}} placeholders. Unknown placeholders stay visible so mistakes are obvious. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

/** Loads prompts/<name>.md. The part before a line "---USER---" is the system prompt. */
export async function loadPrompt(name: string, vars: Record<string, string>): Promise<{ system: string; user: string }> {
  const raw = await readFile(path.join(PROMPTS_DIR, `${name}.md`), "utf8");
  const body = raw.replace(/^<!--[\s\S]*?-->\s*/, "");
  const [system, user] = body.split(/^---USER---\s*$/m);
  return { system: renderTemplate(system.trim(), vars), user: renderTemplate((user ?? "").trim(), vars) };
}
