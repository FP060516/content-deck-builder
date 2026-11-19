import { db } from "./db";

export type SettingKey = "anthropicApiKey" | "anthropicModel" | "anthropicModelCopy";

const ENV: Record<SettingKey, string> = {
  anthropicApiKey: "ANTHROPIC_API_KEY",
  anthropicModel: "ANTHROPIC_MODEL",
  anthropicModelCopy: "ANTHROPIC_MODEL_COPY",
};
const DEFAULTS: Record<SettingKey, string> = {
  anthropicApiKey: "",
  anthropicModel: "claude-sonnet-5-5",
  anthropicModelCopy: "claude-opus-5-5",
};

/** Value saved in the app (Instellingen) wins over .env, then the default. */
export async function getSetting(key: SettingKey): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } }).catch(() => null);
  return row?.value || process.env[ENV[key]] || DEFAULTS[key];
}

export async function setSetting(key: SettingKey, value: string) {
  if (!value) await db.setting.deleteMany({ where: { key } });
  else await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export const maskKey = (k: string) => (k ? `${k.slice(0, 10)}…${k.slice(-4)}` : "");
