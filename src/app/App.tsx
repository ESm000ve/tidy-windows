import { useInertHiddenLayers } from "./hooks/useInertHiddenLayers";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { AccessibilityPanel } from "./components/AccessibilityPanel";
import { AuditLogSidebar, AuditLogToggleButton } from "./components/AuditLogSidebar";
import { BottomPanel } from "./components/BottomPanel";
import { InsightsSidebar, InsightsToggleButton } from "./components/InsightsSidebar";
import { NaturalLanguageRuleBuilder } from "./components/NaturalLanguageRuleBuilder";
import { NoticeDialog } from "./components/NoticeDialog";
import { PreviewSheet } from "./components/PreviewSheet";
import { StatusBar, type RunState } from "./components/StatusBar";
import { TopBar } from "./components/TopBar";
import { AiCommandBar } from "./components/sections/AiCommandBar";
import { AiRuleReviewDialog, type AiRuleReview } from "./components/AiRuleReviewDialog";
import { FiltersSection } from "./components/sections/FiltersSection";
import { LocationsSection } from "./components/sections/LocationsSection";
import { RulesSection } from "./components/sections/RulesSection";
import { RuleSetsBar } from "./components/sections/RuleSetsBar";
import { readRuleSets, type RuleSet } from "./lib/ruleSets";

import { useAppShortcuts } from "./hooks/useAppShortcuts";
import { useCategoryRules } from "./hooks/useCategoryRules";
import { useFolderInsights } from "./hooks/useFolderInsights";
import { useMenuActions } from "./hooks/useMenuActions";
import { useOrganizerRun } from "./hooks/useOrganizerRun";
import { usePersistentState, useSavedState } from "./hooks/usePersistentState";
import { readBoolean, readConflictResolution, readFilters, readSchedule, type SavedSchedule } from "./lib/savedSettings";
import { useFullScreen, useSystemAccentColor } from "./hooks/useSystemAppearance";

import { initialRuleQuestion, prepareRuleDraft, readRuleResponse, type ClarificationTurn } from "./lib/ruleReview";
import { normalizeNamingStyle, type NamingStyle } from "../shared/naming";
import { buildInsightGroups } from "./lib/insights";
import { STORAGE_KEYS } from "./constants";
import type { AiFeedback, ConflictResolution, Filters, OrganizerConfig, ScheduleType } from "./types";

const DEFAULT_FILTERS: Filters = {
  dateModified: "any",
  fileSize: "any",
  excludeHidden: false,
};

/** Extensions listed first in the source file-type picker. */
const COMMON_EXTENSIONS = ["pdf", "docx", "txt", "jpg", "png", "mp3", "mp4", "zip"];

/** How long a transient AI status message stays on screen, in milliseconds. */
const AI_FEEDBACK_TIMEOUT = { success: 4000, running: 5000 } as const;
const SUBFOLDER_CODEC = { parse: (raw: string) => raw === "true", stringify: (value: boolean) => String(value) };
type SourceSelection = {source: string; folders: string[] | null; types: string[] | null};
const SOURCE_SELECTION_CODEC = {
  parse: (raw: string): SourceSelection => {
    const value = JSON.parse(raw);
    const valid = (items: unknown) => items === null || (Array.isArray(items) && items.every(item => typeof item === "string"));
    if (typeof value?.source !== "string" || !valid(value.folders) || !valid(value.types)) throw new Error("Invalid source selection");
    return value;
  },
  stringify: (value: SourceSelection) => JSON.stringify(value),
};
const NAMING_STYLE_CODEC = { parse: normalizeNamingStyle, stringify: (style: NamingStyle) => style };

/**
 * Tidy's root view.
 *
 * `App` owns the settings the user edits directly and composes them into an
 * `OrganizerConfig`. The behaviour built on top of that config — previewing,
 * running, undoing, reacting to menus and shortcuts — lives in the hooks under
 * `./hooks`, and the screen is assembled from the sections under
 * `./components/sections`.
 */
export default function App() {
  useInertHiddenLayers();
  // ─── Locations ──────────────────────────────────────────────────────────────
  const [sourcePath, setSourcePath] = usePersistentState(STORAGE_KEYS.sourcePath, "");
  const [destPath, setDestPath] = usePersistentState(STORAGE_KEYS.destPath, "");

  const [includeSubfolders, setIncludeSubfolders] = usePersistentState(STORAGE_KEYS.includeSubfolders, false, SUBFOLDER_CODEC);

  const [sourceSelection, setSourceSelection] = usePersistentState<SourceSelection>("tidy_source_selection", {source: "", folders: null, types: null}, SOURCE_SELECTION_CODEC);
  const selectedSourceFolders = includeSubfolders && sourceSelection.source === sourcePath ? sourceSelection.folders : null;
  const selectedFileExtensions = includeSubfolders && sourceSelection.source === sourcePath ? sourceSelection.types : null;
  const changeSelection = (folders: string[] | null, types: string[] | null) => setSourceSelection({source: sourcePath, folders, types});

  // ─── Rules, filters, and policy ─────────────────────────────────────────────
  const rules = useCategoryRules();
  const { categories, setCategories } = rules;
  // These settings are saved so rules, filters, and the schedule survive a restart.
  const [filters, setFilters] = useSavedState<Filters>(STORAGE_KEYS.filters, DEFAULT_FILTERS, readFilters);
  const [conflictResolution, setConflictResolution] = useSavedState<ConflictResolution>(STORAGE_KEYS.conflictResolution, "rename", readConflictResolution);
  const [smartRenameEnabled, setSmartRenameEnabled] = useSavedState(STORAGE_KEYS.smartRename, false, readBoolean);
  const [savedSchedule, setSavedSchedule] = useSavedState<SavedSchedule>(
    STORAGE_KEYS.schedule,
    () => ({ type: "manual", time: "09:00", date: new Date().toISOString() }),
    readSchedule,
  );
  const [savedRuleSets, setSavedRuleSets] = useSavedState<RuleSet[]>(STORAGE_KEYS.ruleSets, [], readRuleSets);
  const [watchEnabled, setWatchEnabled] = useSavedState(STORAGE_KEYS.watch, false, readBoolean);
  const [watchStatus, setWatchStatus] = useState<{ watching: boolean; error?: string }>({ watching: false });
  const scheduleType = savedSchedule.type;
  const scheduleTime = savedSchedule.time;
  const scheduleDate = useMemo(() => (savedSchedule.date ? new Date(savedSchedule.date) : undefined), [savedSchedule.date]);
  const setScheduleType = useCallback((type: ScheduleType) => setSavedSchedule((previous) => ({ ...previous, type })), [setSavedSchedule]);
  const setScheduleTime = useCallback((time: string) => setSavedSchedule((previous) => ({ ...previous, time })), [setSavedSchedule]);
  const setScheduleDate = useCallback(
    (date: Date | undefined) => setSavedSchedule((previous) => ({ ...previous, date: date ? date.toISOString() : null })),
    [setSavedSchedule],
  );
  const [namingStyle, setNamingStyle] = usePersistentState<NamingStyle>(STORAGE_KEYS.namingStyle, "descriptive", NAMING_STYLE_CODEC);

  // ─── Chrome: search, panels, notices ────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [ruleBuilderOpen, setRuleBuilderOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = useCallback((message: string) => setNotice(message), []);

  // ─── AI command bar ─────────────────────────────────────────────────────────
  const [aiQuery, setAiQuery] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AiFeedback | null>(null);
  const [aiReview, setAiReview] = useState<AiRuleReview | null>(null);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);

  useSystemAccentColor();
  const isFullScreen = useFullScreen();

  /** Everything a run needs, derived from the settings above. */
  const config: OrganizerConfig = useMemo(
    () => ({
      sourcePath,
      destPath,
      includeSubfolders,
      selectedSourceFolders,
      selectedFileExtensions,
      categories,
      filters,
      conflictResolution,
      schedule: {
        enabled: scheduleType !== "manual",
        frequency: scheduleType,
        date: scheduleDate ?? null,
        time: scheduleTime,
      },
    }),
    [
      sourcePath,
      destPath,
      includeSubfolders,
      selectedSourceFolders,
      selectedFileExtensions,
      categories,
      filters,
      conflictResolution,
      scheduleType,
      scheduleDate,
      scheduleTime,
    ],
  );

  const run = useOrganizerRun({
    config,
    smartRenameEnabled,
    namingStyle,
    onNotice: showNotice,
  });

  // Keep the main process's cron job in step with the configured schedule.
  useEffect(() => {
    const saving = window.electron?.saveSchedule?.(config);
    if (!saving) return;
    let current = true;
    void saving.then(result => {
      if (current && !result.success) showNotice(result.error ?? "Tidy could not save the schedule.");
    }).catch(() => { if (current) showNotice("Tidy could not save the schedule."); });
    return () => { current = false; };
  }, [config]);

  // Keep the watched folder in step with the current rules and folders.
  useEffect(() => window.electron?.onWatchStatus?.(setWatchStatus), []);

  useEffect(() => {
    if (!window.electron?.saveWatch) return;
    let current = true;
    window.electron
      .saveWatch(config, watchEnabled)
      .then((result) => current && setWatchStatus({ watching: result.watching, error: result.error }))
      .catch(() => current && setWatchStatus({ watching: false, error: "Tidy could not watch the source folder." }));
    return () => {
      current = false;
    };
  }, [config, watchEnabled]);

  const insightData = useFolderInsights(sourcePath, includeSubfolders, destPath, selectedSourceFolders, selectedFileExtensions);
  const { startPreview } = run;
  const insights = useMemo(
    () =>
      buildInsightGroups({
        data: insightData,
        categories,
        onReview: () => void startPreview(),
      }),
    [insightData, categories, startPreview],
  );

  /** Extensions offered in the source file-type picker, most common first. */
  const sourceFileExtensions = useMemo(() => {
    const rank = (extension: string) => {
      const index = COMMON_EXTENSIONS.indexOf(extension);
      return index === -1 ? COMMON_EXTENSIONS.length : index;
    };
    return [...new Set(categories.filter((category) => category.enabled).flatMap((category) => category.extensions))]
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [categories]);

  /** Category ids matching the search box, or null when the search is empty. */
  const searchMatches = useMemo<Set<string> | null>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return null;
    return new Set(
      categories
        .filter(
          (category) =>
            category.name.toLowerCase().includes(query) ||
            category.extensions.some((extension) => extension.toLowerCase().includes(query)),
        )
        .map((category) => category.id),
    );
  }, [searchQuery, categories]);

  const browseForFolder = useCallback(async (): Promise<string | null> => {
    if (!window.electron) return null;
    try {
      return await window.electron.openDirectory();
    } catch {
      showNotice("Could not open the folder picker.");
      return null;
    }
  }, [showNotice]);

  /** The current rules, filters, and tools as a rule set. Folders are not included. */
  const captureRuleSet = useCallback(
    (name: string): RuleSet => ({
      id: "",
      name,
      categories,
      filters,
      conflictResolution,
      smartRenameEnabled,
      namingStyle,
      includeSubfolders,
    }),
    [categories, filters, conflictResolution, smartRenameEnabled, namingStyle, includeSubfolders],
  );

  const applyRuleSet = useCallback(
    (set: RuleSet) => {
      setCategories(set.categories.map((category) => ({ ...category, extensions: [...category.extensions] })));
      setFilters(set.filters);
      setConflictResolution(set.conflictResolution);
      setSmartRenameEnabled(set.smartRenameEnabled);
      setNamingStyle(set.namingStyle);
      setIncludeSubfolders(set.includeSubfolders);
    },
    [setCategories, setFilters, setConflictResolution, setSmartRenameEnabled, setNamingStyle, setIncludeSubfolders],
  );

  const resetRules = useCallback(() => {
    rules.reset();
    setFilters(DEFAULT_FILTERS);
    setSearchQuery("");
  }, [rules]);

  /** Parsing only prepares a draft. Settings and schedules stay untouched here. */
  const proposeAiRule = useCallback(async (instruction: string, origin: "inline" | "builder", turns: ClarificationTurn[] = []) => {
    setAiBusy(true);
    setAiFeedback(null);
    setAiReviewError(null);
    try {
      const initialQuestion = turns.length === 0 ? initialRuleQuestion(instruction) : null;
      if (initialQuestion) {
        setAiReview({ kind: "question", instruction, origin, turns, question: initialQuestion });
        return;
      }
      if (!window.electron?.parseRule) throw new Error("AI rules are only available in the desktop app.");
      const result = await window.electron.parseRule(instruction, { categories, filters, smartRenameEnabled, sourcePath, destPath, includeSubfolders, clarifications: turns });
      if (!result.success || !result.data) throw new Error(result.error || "AI couldn't process that. Try rephrasing.");
      const patch = readRuleResponse(result.data);
      const question = patch.clarification?.trim();
      if (question) {
        setAiReview({ kind: "question", instruction, origin, turns, question: question.slice(0, 1000) });
      } else {
        setAiReview({ kind: "draft", instruction, origin, turns, draft: prepareRuleDraft(config, smartRenameEnabled, patch, namingStyle) });
      }
    } finally {
      setAiBusy(false);
    }
  }, [categories, filters, smartRenameEnabled, sourcePath, destPath, includeSubfolders, config, namingStyle]);

  const submitAiQuery = useCallback(async () => {
    if (!aiQuery.trim() || aiBusy) return;
    try { await proposeAiRule(aiQuery.trim(), "inline"); }
    catch (error) { setAiFeedback({ type: "error", message: error instanceof Error ? error.message : "Couldn't reach AI. Please try again." }); }
  }, [aiQuery, aiBusy, proposeAiRule]);

  const confirmAiRule = () => {
    if (aiReview?.kind !== "draft" || aiBusy) return;
    const { draft, origin } = aiReview;
    setCategories(draft.config.categories);
    setFilters(draft.config.filters);
    setSourcePath(draft.config.sourcePath);
    setDestPath(draft.config.destPath);
    setSmartRenameEnabled(draft.smartRenameEnabled);
    setIncludeSubfolders(draft.config.includeSubfolders === true);
    setAiReview(null);
    setAiQuery("");
    setAiFeedback({ type: "success", message: "Reviewed rules applied." });
    window.setTimeout(() => setAiFeedback(null), AI_FEEDBACK_TIMEOUT.success);
    if (origin === "inline" && draft.openPreview && draft.config.sourcePath) void startPreview(draft.config.sourcePath, draft.config, draft.smartRenameEnabled);
  };

  const clarifyAiRule = async (answer: string) => {
    if (aiReview?.kind !== "question" || aiBusy) return;
    try { await proposeAiRule(aiReview.instruction, aiReview.origin, [...aiReview.turns, { question: aiReview.question, answer }]); }
    catch (error) { setAiReviewError(error instanceof Error ? error.message : "Couldn't reach AI. Your settings haven't changed."); }
  };

  const operations = run.runMetrics.operations ?? [];
  const anyPanelOpen =
    run.previewOpen || ruleBuilderOpen || aiReview !== null || insightsOpen || auditLogOpen || notice !== null;

  useMenuActions({
    "open-preferences": () => window.dispatchEvent(new CustomEvent("tidy:open-preferences")),
    "run-tidy": () => void startPreview(),
    "reset-rules": resetRules,
    "open-source": () => void browseForFolder().then((dir) => dir && setSourcePath(dir)),
    "open-destination": () => void browseForFolder().then((dir) => dir && setDestPath(dir)),
    "toggle-insights": () => setInsightsOpen((open) => !open),
    "toggle-audit": () => setAuditLogOpen((open) => !open),
    "clear-search": () => {
      setSearchQuery("");
      setSearchOpen(false);
    },
    "undo-organize": () => void run.undo(operations),
  });

  useAppShortcuts(
    {
      onRun: () => void startPreview(),
      onUndo: () => void run.undo(operations),
    },
    { isModalOpen: anyPanelOpen, canUndo: operations.length > 0 },
  );

  return (
    <div
      className="fluent-app h-screen overflow-hidden relative selection:bg-[var(--system-blue)]/30 selection:text-white bg-[var(--fluent-window-background)] text-foreground"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      <LiveRegion
        runState={run.runState}
        runProgress={run.runProgress}
        metrics={run.runMetrics}
        aiBusy={aiBusy}
        aiFeedback={aiFeedback}
      />

      <div className="absolute top-0 left-0 right-0 z-30">
        <TopBar
          title="Tidy"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchOpen={searchOpen}
          onSearchOpenChange={setSearchOpen}
          runState={run.runState}
          progress={run.runProgress}
          onRunTidy={() => void startPreview()}
          isFullScreen={isFullScreen}
        >
          <AccessibilityPanel isCompact />
          <AuditLogToggleButton
            isOpen={auditLogOpen}
            onClick={() => setAuditLogOpen(!auditLogOpen)}
            isCompact
          />
          <InsightsToggleButton
            isOpen={insightsOpen}
            onClick={() => setInsightsOpen(!insightsOpen)}
            isCompact
          />
        </TopBar>

        <RunProgressBar runState={run.runState} progress={run.runProgress} />
      </div>

      <main
        id="main-content"
        tabIndex={0}
        className="h-full w-full overflow-auto scroll-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--fluent-focus-ring)]"
      >
        {/* Top padding clears the floating top bar; bottom padding clears the status bar. */}
        <div className="fluent-page">
          <div className="fluent-page-intro"><h1>Organize files</h1><p>Choose your folders, set your rules, and preview changes before you run.</p></div>
          <LocationsSection
            sourcePath={sourcePath}
            destPath={destPath}
            includeSubfolders={includeSubfolders}
            onIncludeSubfoldersChange={setIncludeSubfolders}
            selectedSourceFolders={selectedSourceFolders}
            selectedFileExtensions={selectedFileExtensions}
            onSelectionChange={changeSelection}
            fileExtensions={sourceFileExtensions}
            excludeHidden={filters.excludeHidden}
            onSourceChange={setSourcePath}
            onDestChange={setDestPath}
            onBrowse={browseForFolder}
          />

          <Divider />

          <FiltersSection filters={filters} onChange={setFilters} />

          <Divider />

          <RulesSection
            categories={categories}
            expandedIds={rules.expandedIds}
            enabledCount={rules.enabledCount}
            searchMatches={searchMatches}
            smartRenameEnabled={smartRenameEnabled}
            namingStyle={namingStyle}
            onNamingStyleChange={setNamingStyle}
            onSmartRenameToggle={() => setSmartRenameEnabled((enabled) => !enabled)}
            onToggleFeatureForAll={rules.toggleFeatureForAll}
            onToggleExpanded={rules.toggleExpanded}
            onPatchCategory={rules.updateCategory}
            onToggleExtension={rules.toggleExtension}
          >
            <RuleSetsBar
              savedSets={savedRuleSets}
              onSavedSetsChange={setSavedRuleSets}
              captureCurrent={captureRuleSet}
              onApply={applyRuleSet}
            />
          </RulesSection>

          <AiCommandBar
            value={aiQuery}
            onValueChange={(value) => {
              setAiQuery(value);
              setAiFeedback(null);
            }}
            onSubmit={() => void submitAiQuery()}
            busy={aiBusy}
            feedback={aiFeedback}
            onOpenAdvanced={() => setRuleBuilderOpen(true)}
          />

          <Divider />

          <BottomPanel
            scheduleType={scheduleType}
            onScheduleTypeChange={setScheduleType}
            scheduleTime={scheduleTime}
            onScheduleTimeChange={setScheduleTime}
            scheduleDate={scheduleDate ?? null}
            onScheduleDateChange={setScheduleDate}
            conflictResolution={conflictResolution}
            onConflictResolutionChange={setConflictResolution}
            watchEnabled={watchEnabled}
            onWatchEnabledChange={setWatchEnabled}
            watchStatus={watchStatus}
            canWatch={Boolean(sourcePath && destPath)}
          />
        </div>
      </main>

      <footer className="fluent-status">
        <StatusBar runState={run.runState} metrics={run.runMetrics} logEvents={run.logEvents} />
      </footer>

      <PreviewSheet
        isOpen={run.previewOpen}
        onClose={run.closePreview}
        onConfirm={run.confirmRun}
        onUndo={operations => run.undo(operations, false)}
        categories={categories}
        runState={run.runState}
        runMetrics={run.runMetrics}
        runProgress={run.runProgress}
        files={run.previewFiles}
        smartRenameEnabled={smartRenameEnabled}
      />

      <NaturalLanguageRuleBuilder
        isOpen={ruleBuilderOpen}
        onClose={() => setRuleBuilderOpen(false)}
        onSave={rule => proposeAiRule(rule, "builder")}
      />

      <AiRuleReviewDialog
        key={aiReview ? `${aiReview.instruction}-${aiReview.kind}-${aiReview.turns.length}` : "closed"}
        review={aiReview}
        busy={aiBusy}
        error={aiReviewError}
        onCancel={() => { setAiReview(null); setAiReviewError(null); }}
        onClarify={answer => void clarifyAiRule(answer)}
        onConfirm={confirmAiRule}
      />

      <InsightsSidebar
        isOpen={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        insights={insights}
      />

      <AuditLogSidebar
        isOpen={auditLogOpen}
        onClose={() => setAuditLogOpen(false)}
        operations={operations}
        lastRunTime={run.runMetrics.timestamp}
        onUndo={run.undo}
        isUndoing={run.isUndoing}
        destPath={destPath}
        onRunUndone={run.syncUndoneRun}
      />

      <NoticeDialog
        open={notice !== null}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
        message={notice ?? ""}
      />

    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-black/[0.04] dark:bg-white/[0.04]" aria-hidden="true" />;
}

/** A thin progress bar under the top bar while a scan or run is in flight. */
function RunProgressBar({ runState, progress }: { runState: RunState; progress: number }) {
  const active = runState === "scanning" || runState === "running";

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="progress-bar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute top-[52px] left-0 right-0 h-[2px] bg-black/5 dark:bg-white/5 z-20 overflow-hidden"
          role="progressbar"
          aria-label={runState === "scanning" ? "Scanning files…" : "Organizing files…"}
          aria-valuenow={runState === "scanning" ? undefined : progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {runState === "scanning" ? (
            // There is no file count during the scan, so the bar is indeterminate.
            <motion.div
              className="h-full w-1/3 bg-[var(--system-blue)] rounded-full"
              animate={{ x: ["-100%", "400%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : (
            <motion.div
              className="h-full bg-[var(--system-blue)]"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.25 }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface LiveRegionProps {
  runState: RunState;
  runProgress: number;
  metrics: { moved: number; renamed: number; duplicates: number; errors: number };
  aiBusy: boolean;
  aiFeedback: AiFeedback | null;
}

/** Announces run and AI status to VoiceOver, which cannot see the progress bar. */
function LiveRegion({ runState, runProgress, metrics, aiBusy, aiFeedback }: LiveRegionProps) {
  let message = "";

  if (runState === "scanning") {
    message = "Scanning files to organize…";
  } else if (runState === "running") {
    message = `Organizing files… ${Math.round(runProgress)}% complete`;
  } else if (runState === "completed") {
    message = `Organization complete. Moved ${metrics.moved}, renamed ${metrics.renamed}, and found ${metrics.duplicates} duplicates.`;
  } else if (runState === "error") {
    message = `Organization finished with errors. ${metrics.errors} errors encountered.`;
  } else if (aiBusy) {
    message = "AI is processing your request…";
  } else if (aiFeedback) {
    message = `AI ${aiFeedback.type}: ${aiFeedback.message}`;
  }

  return (
    <div aria-live="assertive" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
