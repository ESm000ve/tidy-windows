import fs from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";

const keyPath = () => path.join(app.getPath("userData"), "gemini-key.bin");

/** Secrets stay in the main process and are encrypted for this Windows account. */
export function readSavedKey(): string | undefined {
  try { return safeStorage.decryptString(fs.readFileSync(keyPath())).trim() || undefined; }
  catch { return undefined; }
}

export function apiKeyStatus() {
  const saved = !!readSavedKey();
  const environment = !!process.env.GEMINI_API_KEY?.trim();
  return { configured: saved || environment, saved, environment, unreadable: !saved && fs.existsSync(keyPath()) };
}

export function saveApiKey(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(value.trim())) throw new Error("Enter a valid Gemini API key.");
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows secure storage is unavailable. Your key was not saved.");
  const target = keyPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const encrypted = safeStorage.encryptString(value.trim());
  fs.writeFileSync(target + ".tmp", encrypted, { mode: 0o600 });
  fs.renameSync(target + ".tmp", target);
}

export function removeApiKey() { fs.rmSync(keyPath(), { force: true }); }
