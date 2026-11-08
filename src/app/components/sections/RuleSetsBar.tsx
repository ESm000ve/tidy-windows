import { useMemo, useState } from "react";
import { FluentSelect } from "../controls/FluentSelect";
import {
  builtInRuleSets,
  cleanRuleSetName,
  fromImportFile,
  newRuleSetId,
  toExportFile,
  type RuleSet,
} from "../../lib/ruleSets";

interface RuleSetsBarProps {
  /** Rule sets the user saved or imported. */
  savedSets: RuleSet[];
  onSavedSetsChange: (sets: RuleSet[]) => void;
  /** Capture the current rules as a set with the given name. */
  captureCurrent: (name: string) => RuleSet;
  onApply: (set: RuleSet) => void;
}

/**
 * Apply a saved rule set, save the current rules as one, and move sets between
 * computers with Export and Import.
 */
export function RuleSetsBar({ savedSets, onSavedSetsChange, captureCurrent, onApply }: RuleSetsBarProps) {
  const builtIns = useMemo(() => builtInRuleSets(), []);
  const allSets = useMemo(() => [...builtIns, ...savedSets], [builtIns, savedSets]);
  const [selectedId, setSelectedId] = useState("");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const desktop = typeof window.electron?.exportRuleSets === "function";
  const selected = allSets.find((set) => set.id === selectedId);

  function apply(id: string) {
    const set = allSets.find((candidate) => candidate.id === id);
    if (!set) return;
    setSelectedId(id);
    onApply(set);
    setMessage({ text: `Applied “${set.name}”. Your folders were not changed.`, failed: false });
  }

  function save() {
    const clean = cleanRuleSetName(name);
    if (!clean) return;
    const existing = savedSets.find((set) => set.name.toLowerCase() === clean.toLowerCase());
    if (!existing && savedSets.length >= 50) {
      setMessage({ text: "You can save up to 50 rule sets. Delete one before saving another.", failed: true });
      return;
    }
    const set = { ...captureCurrent(clean), id: existing?.id ?? newRuleSetId() };
    onSavedSetsChange(existing ? savedSets.map((candidate) => (candidate.id === existing.id ? set : candidate)) : [...savedSets, set]);
    setSelectedId(set.id);
    setNaming(false);
    setName("");
    setMessage({ text: existing ? `Updated “${clean}”.` : `Saved “${clean}”.`, failed: false });
  }

  function remove() {
    if (!selected || selected.builtIn) return;
    onSavedSetsChange(savedSets.filter((set) => set.id !== selected.id));
    setSelectedId("");
    setMessage({ text: `Deleted “${selected.name}”.`, failed: false });
  }

  async function exportSets() {
    if (!window.electron || savedSets.length === 0) return;
    const result = await window.electron.exportRuleSets(toExportFile(savedSets), "Tidy rule sets");
    if (result.success) setMessage({ text: `Exported ${savedSets.length} rule set(s).`, failed: false });
    else if (!result.canceled) setMessage({ text: result.error ?? "Could not export.", failed: true });
  }

  async function importSets() {
    if (!window.electron) return;
    const result = await window.electron.importRuleSets();
    if (!result.success) {
      if (!result.canceled) setMessage({ text: result.error ?? "Could not import.", failed: true });
      return;
    }
    const imported = fromImportFile(result.data, allSets);
    if (typeof imported === "string") {
      setMessage({ text: imported, failed: true });
      return;
    }
    onSavedSetsChange([...savedSets, ...imported]);
    setMessage({ text: `Imported ${imported.map((set) => `“${set.name}”`).join(", ")}. Choose one from Rule set to apply it.`, failed: false });
  }

  return (
    <div className="fluent-rule-sets flex flex-col gap-2" role="group" aria-label="Rule sets">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1 max-w-[320px]">
          <FluentSelect
            id="rule-set-select"
            label="Rule set"
            value={selectedId}
            onChange={apply}
            placeholder="Choose a rule set…"
            options={allSets.map((set) => ({ value: set.id, label: set.builtIn ? `${set.name} (built-in)` : set.name }))}
          />
        </div>
        <button type="button" className="fluent-button" onClick={() => { setNaming(true); setName(selected && !selected.builtIn ? selected.name : ""); }}>
          Save current…
        </button>
        <button type="button" className="fluent-button" disabled={!selected || selected.builtIn} onClick={remove} title={selected?.builtIn ? "Built-in rule sets can't be deleted" : undefined}>
          Delete
        </button>
        <button type="button" className="fluent-button" disabled={!desktop} onClick={() => void importSets()}>
          Import…
        </button>
        <button type="button" className="fluent-button" disabled={!desktop || savedSets.length === 0} onClick={() => void exportSets()} title={savedSets.length === 0 ? "Save a rule set first" : "Export your saved rule sets to a file"}>
          Export…
        </button>
      </div>

      {naming && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label htmlFor="rule-set-name" className="text-[14px] text-muted-foreground">Name</label>
          <input
            id="rule-set-name"
            className="fluent-time min-w-[220px]"
            value={name}
            maxLength={60}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setNaming(false);
              }
            }}
            placeholder="For example, Work downloads"
          />
          <button type="submit" className="fluent-button" disabled={!cleanRuleSetName(name)}>Save</button>
          <button type="button" className="fluent-button" onClick={() => setNaming(false)}>Cancel</button>
          <p className="w-full text-[12px] text-muted-foreground">Saves your rules, filters, tools, and conflict setting. Folders are not included.</p>
        </form>
      )}

      {message && <p role={message.failed ? "alert" : "status"} className="text-[12px] text-muted-foreground">{message.text}</p>}
    </div>
  );
}
