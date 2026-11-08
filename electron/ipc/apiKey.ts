import { ipcMain } from "electron";
import { CHANNELS } from "../channels";
import { apiKeyStatus, saveApiKey, removeApiKey } from "../services/apiKey";
import { createClient, generateContent, aiErrorMessage } from "../services/gemini";

export function registerApiKeyHandlers() {
  ipcMain.handle(CHANNELS.apiKeyStatus, () => apiKeyStatus());
  ipcMain.handle(CHANNELS.apiKeySave, (_event, value: unknown) => {
    try { saveApiKey(value); return { success: true }; }
    catch { return { success: false, error: "Could not save the key. Check the key and Windows secure storage, then try again." }; }
  });
  ipcMain.handle(CHANNELS.apiKeyRemove, () => {
    try { removeApiKey(); return { success: true }; }
    catch { return { success: false, error: "Could not remove the saved key. Please try again." }; }
  });
  ipcMain.handle(CHANNELS.apiKeyTest, async () => {
    const client = createClient();
    if (!client) return { success: false, error: "Add a Gemini API key in Settings first." };
    try {
      const response = await generateContent(client, { contents: "Reply with OK.", config: { maxOutputTokens: 256, thinkingConfig: { thinkingBudget: 0 } } });
      if (!response.text?.trim()) return { success: false, error: "Gemini returned no response. Please try again." };
      return { success: true };
    } catch (error) { return { success: false, error: aiErrorMessage(error) }; }
  });
}
