import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface FluentSelectProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  placeholder?: string;
  /** Unique id when several selects share a label. Defaults to one from the label. */
  id?: string;
  /** Optional help text below the field. */
  description?: string;
}

/**
 * A labelled dropdown styled per Windows 11 Fluent design specifications.
 *
 * Generic over the option value so callers keep their union type end to end
 * (`"any" | "today" | …`) instead of casting a bare `string` back at the
 * change handler.
 */
export function FluentSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder,
  id,
  description,
}: FluentSelectProps<T>) {
  const selectId = id ?? `fluent-select-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="flex flex-col gap-1.5 flex-1 select-none">
      <label
        htmlFor={selectId}
        className="text-[14px] font-medium text-[var(--fluent-secondary-label)] dark:text-[var(--fluent-secondary-label)] tracking-tight"
      >
        {label}
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger
          id={selectId}
          aria-describedby={description ? `${selectId}-description` : undefined}
          className="w-full bg-black/5 dark:bg-white/[0.05] border border-black/10 dark:border-white/10 text-[14px] h-9 px-3 hover:bg-black/10 dark:hover:bg-white/[0.08] transition-colors"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-white/80 dark:bg-black/80 backdrop-blur-xl border-black/10 dark:border-white/15">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-[14px] focus:bg-blue-500/10 focus:text-foreground"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && (
        <p id={`${selectId}-description`} className="text-[12px] text-[var(--fluent-secondary-label)]">{description}</p>
      )}
    </div>
  );
}
