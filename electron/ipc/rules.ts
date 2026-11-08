/**
 * Turning a sentence into organizer settings.
 *
 * The model returns a patch, not a command: it never touches the filesystem
 * itself, and the renderer decides what to do with what comes back.
 */
import path from "node:path";
import { app, ipcMain } from "electron";
import { CHANNELS } from "../channels";
import { createClient, generateContent, aiErrorMessage } from "../services/gemini";
import type { CategoryRule } from "../types";
import { initialRuleQuestion } from "../../src/shared/ruleQuestions";

/** The organizer state sent along with the rule, so the model can patch it. */
interface RuleContext {
  categories: CategoryRule[];
  sourcePath?: string;
  destPath?: string;
  filters?: unknown;
  smartRenameEnabled?: boolean;
  includeSubfolders?: boolean;
  clarifications?: { question: string; answer: string }[];
}

const CATEGORY_PROPERTIES = {
  extensions: { type: "array", items: { type: "string" } },
  subfolders: { type: "boolean" }, smartCategorization: { type: "boolean" }, duplicateDetection: { type: "boolean" },
  dateFolders: { type: "string", enum: ["none", "year", "month"] },
};
const RULE_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    clarification: { type: "string" },
    newCategories: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, ...CATEGORY_PROPERTIES }, required: ["name", "extensions"] } },
    updateCategories: { type: "array", items: { type: "object", additionalProperties: false, properties: { id: { type: "string" }, enabled: { type: "boolean" }, ...CATEGORY_PROPERTIES }, required: ["id"] } },
    updateFilters: { type: "object", additionalProperties: false, properties: { dateModified: { type: "string", enum: ["any", "today", "week", "month", "year"] }, fileSize: { type: "string", enum: ["any", "small", "medium", "large"] }, excludeHidden: { type: "boolean" } } },
    includeSubfolders: { type: "boolean" },
    smartRename: { type: "boolean" }, sourcePath: { type: "string" }, destPath: { type: "string" }, execute: { type: "boolean" },
  },
};

function buildPrompt(rule: string, context: RuleContext): string {
  const homeDir = "%USERPROFILE%";
  const categorySummary = JSON.stringify(
    context.categories.map(({ id, name, enabled, extensions }) => ({
      id,
      name,
      enabled,
      extensions,
    })),
    null,
    2,
  );

  return `You are an expert configuration parser for a File Organizer App.
The user wants to create a new rule or update settings using natural language.
User's Rule: "${rule}"
Clarification conversation (if any): ${JSON.stringify(context.clarifications ?? [])}
Current filters: ${JSON.stringify(context.filters ?? {})}
Include source subfolders is currently: ${context.includeSubfolders === true ? "on" : "off"}
Smart Rename is currently: ${context.smartRenameEnabled === true ? "on" : "off"}

Current Categories context (to help you decide whether to update an existing category or create a new one):
${categorySummary}

Current source path: "${context.sourcePath ? "%SOURCE%" : ""}"
Current dest path: "${context.destPath ? "%DESTINATION%" : ""}"
User's home directory: "${homeDir}"

Return a strict JSON response containing ONLY the updates required. Do not include markdown code blocks.
The exact JSON schema MUST be:
{
  "clarification": "A single focused question, only when more detail is needed",
  "newCategories": [
    { "name": "Category Name", "extensions": ["ext1", "ext2"], "subfolders": boolean, "smartCategorization": boolean, "duplicateDetection": boolean, "dateFolders": "none" | "year" | "month" }
  ],
  "updateCategories": [
    { "id": "existing-category-id", "enabled": boolean, "extensions": ["added_ext1"], "smartCategorization": boolean, "duplicateDetection": boolean, "dateFolders": "none" | "year" | "month" }
  ],
  "updateFilters": {
    "fileSize": "any" | "small" | "medium" | "large",
    "dateModified": "any" | "today" | "week" | "month" | "year"
  },
  "smartRename": boolean,
  "includeSubfolders": boolean,
  "sourcePath": "absolute path string or null",
  "destPath": "absolute path string or null",
  "execute": boolean
}

Rules:
1. If a field is not affected by the user's rule, omit it.
2. Infer standard file extensions for requested categories (e.g. "Archive" usually means ["zip", "rar", "tar", "gz"], "Invoices" usually means ["pdf"]). Be thorough.
3. Never include periods in the extensions (e.g., use "pdf", not ".pdf").
4. If the user asks to "rename" or "smart rename" files, set "smartRename" to true.
5. If the user asks for a category but it already exists in the context, add the extensions to the existing category via updateCategories.
6. Use symbolic paths for known locations: %DESKTOP%, %DOWNLOADS%, %DOCUMENTS%, %PICTURES%, %VIDEOS%, %MUSIC%, or %USERPROFILE%. Use %SOURCE% for the current source and %DESTINATION% for the current destination. The app resolves these locally.
7. For subfolders append /FolderName to the symbolic location, for example %DESKTOP%/Images. Never guess the account name or drive letter.
8. Set "execute": true ONLY when the user clearly wants to immediately move/organize/run files right now (action verbs: "move", "organize", "clean up", "sort", "run", "put"). Set to false or omit when they are just configuring rules for future use.
9. If the user says something like "move X from Y to Z" or "move X on Y to Z", set sourcePath to Y's absolute path, destPath to Z's absolute path, and execute to true.
10. CRITICAL: If the user mentions a file type or category they want to move/organize (e.g. "images", "photos", "documents", "videos", "music"), you MUST include that category in updateCategories with "enabled": true. For example, if the user says "move images", find the matching category in the context and add { "id": "<that category's id>", "enabled": true } to updateCategories. If the category is already enabled, still include it to ensure it stays enabled.
11. If the user targets ONLY specific file types (e.g. "move images" — not "organize everything"), also add all OTHER categories to updateCategories with "enabled": false so only the targeted type gets moved.
12. If scope, file types, source/destination, or a date range is ambiguous, return ONLY {"clarification": "one focused question"}. Use the conversation answers to resolve the original rule. Do not guess, and do not repeat an already answered question.
13. This app supports extension categories, recent modification filters (within 1, 7, 30, or 365 days), size buckets (<1 MB, 1–100 MB, >100 MB), subfolders by extension, suggested semantic subfolders, year or year/month folders by last-modified date (category dateFolders: "year" or "month"), duplicate detection, and Smart Rename. It does not support deletion, filename substring rules, arbitrary date ranges, folders by photo capture date, or older-than cutoffs. For an unsupported request, explain the limitation in a clarification question and offer a supported alternative. Never map 'older than a month' to 'month': month means WITHIN the past 30 days.
14. Enabling smartCategorization must also enable subfolders. Plain extension categories such as documents should preserve the file type the user actually requested (e.g. PDF only when they ask for PDFs).
15. Set includeSubfolders true only when the instruction asks to search inside nested/source subfolders, and false for just the main source folder. This is separate from category subfolders, which control destination organization.
16. 'execute' only requests a preview after the user accepts the settings; no files move until the normal file preview is confirmed.
17. Use the existing Books category for ebook types such as EPUB, MOBI, AZW3, FB2 and comic-book archives. If the user specifies only certain extensions, select only those extensions. PDF stays in Documents unless the user explicitly includes it. Ebook organization is based on extensions; do not promise ebook metadata extraction, reading, conversion or DRM removal.`;
}

export function registerRuleHandlers(): void {
  ipcMain.handle(CHANNELS.parseRule, async (_event, rule: string, context: RuleContext) => {
    if (typeof rule !== "string" || !rule.trim() || rule.length > 8000 || !context || !Array.isArray(context.categories)) return { success: false, error: "Please enter a valid instruction." };
    const turns = Array.isArray(context.clarifications) ? context.clarifications.slice(-6).filter(turn => turn && typeof turn.question === "string" && typeof turn.answer === "string").map(turn => ({ question: turn.question.slice(0, 1000), answer: turn.answer.slice(0, 2000) })) : [];
    context = { ...context, clarifications: turns };
    const question = turns.length === 0 ? initialRuleQuestion(rule) : null;
    if (question) return { success: true, data: { clarification: question } };
    const client = createClient();
    if (!client) {
      return {
        success: false,
        error: "AI is not configured. Add a Gemini API key in Settings, or set GEMINI_API_KEY and restart Tidy.",
      };
    }

    try {
      const response = await generateContent(client, {
        contents: buildPrompt(rule, context),
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: RULE_SCHEMA,
          // Rule parsing is a mechanical transformation; extra reasoning only
          // adds latency to what should feel instant.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      if (!response.text) return { success: false, error: "AI returned no content." };
      const data = JSON.parse(response.text.trim());
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("AI returned an invalid rule.");
      if (data.includeSubfolders != null && typeof data.includeSubfolders !== "boolean") throw new Error("AI returned an invalid subfolder option.");
      if (data.clarification != null) {
        if (typeof data.clarification !== "string" || !data.clarification.trim()) throw new Error("AI returned an invalid question.");
        return { success: true, data: { clarification: data.clarification.trim().slice(0, 1000) } };
      }
      // Folder metadata stays on this machine; the model sees only symbolic names.
      const locations: Record<string, string> = {
        USERPROFILE: app.getPath("home"), DESKTOP: app.getPath("desktop"), DOWNLOADS: app.getPath("downloads"),
        DOCUMENTS: app.getPath("documents"), PICTURES: app.getPath("pictures"), VIDEOS: app.getPath("videos"),
        MUSIC: app.getPath("music"), SOURCE: context.sourcePath ?? "", DESTINATION: context.destPath ?? "",
      };
      for (const field of ["sourcePath", "destPath"]) {
        const value = data[field];
        if (typeof value !== "string" || !value.startsWith("%")) continue;
        const match = /^%([A-Z]+)%(?:[\\/](.*))?$/i.exec(value);
        if (!match || !locations[match[1].toUpperCase()]) throw new Error("AI returned an unknown folder location.");
        const segments = (match[2] ?? "").split(/[\\/]/).filter(Boolean);
        if (segments.some(segment => segment === ".." || segment.includes(":"))) throw new Error("AI returned an invalid subfolder.");
        data[field] = path.join(locations[match[1].toUpperCase()], ...segments);
      }
      return { success: true, data };
    } catch (error) {
      const message = aiErrorMessage(error);
      return { success: false, error: message };
    }
  });
}
