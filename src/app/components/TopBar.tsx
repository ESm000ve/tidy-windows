import { useRef, useEffect } from "react";
import { Folder, Play, Search, X } from "./icons";
interface TopBarProps {
    title?: string;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    searchOpen: boolean;
    onSearchOpenChange: (open: boolean) => void;
    runState?: "idle" | "scanning" | "running" | "completed" | "error";
    progress?: number;
    onRunTidy?: () => void;
    isFullScreen?: boolean;
    children?: React.ReactNode;
}
export function TopBar({ title = "Tidy", searchQuery, onSearchChange, searchOpen, onSearchOpenChange, runState = "idle", progress = 0, onRunTidy, children }: TopBarProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const close = () => { onSearchChange(""); onSearchOpenChange(false); };
    useEffect(() => { if (searchOpen)
        inputRef.current?.focus(); }, [searchOpen]);
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && !document.querySelector('[role="dialog"], [role="alertdialog"]')) {
                event.preventDefault();
                onSearchOpenChange(true);
                inputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", keydown);
        return () => window.removeEventListener("keydown", keydown);
    }, [onSearchOpenChange]);
    const busy = runState === "running" || runState === "scanning";
    return <header className="fluent-commandbar">
    <div className="fluent-brand"><Folder className="w-5 h-5" aria-hidden="true"/>{title}</div>
    <div className="fluent-command-progress" role="status">{busy ? `${runState === "scanning" ? "Scanning files…" : "Organizing…"} ${Math.round(progress)}%` : ""}</div>
    <div className="fluent-commands">
      {onRunTidy && <button className="fluent-primary" onClick={onRunTidy} disabled={busy}><Play className="w-4 h-4" aria-hidden="true"/>{runState === "scanning" ? "Scanning…" : runState === "running" ? "Organizing…" : "Run Tidy"}</button>}
      <div className="fluent-utilities">{children}</div>
      <div role="search" aria-label="Search">
        {searchOpen ? <div className="fluent-search"><Search className="w-4 h-4 shrink-0" aria-hidden="true"/><input ref={inputRef} type="search" aria-label="Search rules and categories" placeholder="Search rules" value={searchQuery} onChange={event => onSearchChange(event.target.value)} onKeyDown={event => { if (event.key === "Escape") {
        event.stopPropagation();
        close();
    } }}/><button type="button" className="fluent-icon-button" aria-label="Clear search" onClick={close}><X className="w-3 h-3" aria-hidden="true"/></button></div> : <button type="button" className="fluent-icon-button" title="Search (Ctrl+F)" aria-label="Open search" onClick={() => onSearchOpenChange(true)}><Search className="w-4 h-4" aria-hidden="true"/></button>}
      </div>
    </div>
  </header>;
}
