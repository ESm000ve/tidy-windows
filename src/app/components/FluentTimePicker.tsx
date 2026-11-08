interface FluentTimePickerProps { value: string; onChange: (value: string) => void; }
/** Keyboard-editable time field using the platform's locale and 12/24-hour format. */
export function FluentTimePicker({value, onChange}: FluentTimePickerProps) {
 return <input type="time" aria-label="Schedule time" className="fluent-time" value={value} onChange={event => { if (event.target.value) onChange(event.target.value); }} />;
}
