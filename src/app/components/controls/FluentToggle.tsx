import * as Switch from "@radix-ui/react-switch";
interface FluentToggleProps {
    id?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    color?: "green" | "blue" | "purple";
    size?: "sm" | "md";
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
    "aria-label"?: string;
}
/** 40×20 visual track within a keyboard-focusable 44×32 hit target. */
export function FluentToggle({ color: _color, size: _size, ...props }: FluentToggleProps) {
    return <Switch.Root {...props} className="fluent-toggle" data-slot="switch"><span className="fluent-toggle-track"><Switch.Thumb className="fluent-toggle-thumb"/></span></Switch.Root>;
}
