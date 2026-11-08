import { FluentSelect, type SelectOption } from "../controls/FluentSelect";
import { FluentToggle } from "../controls/FluentToggle";
import { GLASS_SURFACE } from "../../constants";
import type { DateFilter, Filters, SizeFilter } from "../../types";

const DATE_OPTIONS: readonly SelectOption<DateFilter>[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Past 24 hours" },
  { value: "week", label: "Past 7 days" },
  { value: "month", label: "Past 30 days" },
  { value: "year", label: "Past 365 days" },
];

const SIZE_OPTIONS: readonly SelectOption<SizeFilter>[] = [
  { value: "any", label: "Any size" },
  { value: "small", label: "Small  (< 1 MB)" },
  { value: "medium", label: "Medium  (1 MB – 100 MB)" },
  { value: "large", label: "Large  (> 100 MB)" },
];

interface FiltersSectionProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

/** Which files a run considers, before category rules are applied. */
export function FiltersSection({ filters, onChange }: FiltersSectionProps) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <section aria-label="Filters" className="flex flex-col gap-3">
      <h2 className="text-[20px] font-semibold text-foreground">
        Smart filters
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${GLASS_SURFACE} p-4`}>
          <FluentSelect
            label="Date modified"
            value={filters.dateModified}
            onChange={(value) => set("dateModified", value)}
            options={DATE_OPTIONS}
          />
        </div>

        <div className={`${GLASS_SURFACE} p-4`}>
          <FluentSelect
            label="File size"
            value={filters.fileSize}
            onChange={(value) => set("fileSize", value)}
            options={SIZE_OPTIONS}
          />
        </div>

        <div className={`${GLASS_SURFACE} p-4 flex items-center justify-between gap-4`}>
          <div className="min-w-0">
            <p className="text-[14px] text-foreground" id="exclude-hidden-label">
              Exclude hidden
            </p>
            <p className="text-[14px] text-muted-foreground mt-0.5" id="exclude-hidden-desc">
              Skip files whose names begin with a dot
            </p>
          </div>
          <FluentToggle
            checked={filters.excludeHidden}
            onCheckedChange={(value) => set("excludeHidden", value)}
            aria-labelledby="exclude-hidden-label"
            aria-describedby="exclude-hidden-desc"
          />
        </div>
      </div>
    </section>
  );
}
