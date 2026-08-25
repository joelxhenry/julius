import { DatePickerInput, DatePickerInputProps } from '@mantine/dates';

export type DateRangeValue = [string | null, string | null];

interface DateRangeFilterProps
  extends Omit<DatePickerInputProps<'range'>, 'type' | 'value' | 'onChange'> {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
}

/**
 * Reusable date-range picker for filtering lists by a start/end date.
 * Emits values as `YYYY-MM-DD` strings (Mantine v8 range format), ready to
 * pass straight to backend query params.
 */
export function DateRangeFilter({
  value,
  onChange,
  label = 'Date Range',
  placeholder = 'Filter by date',
  clearable = true,
  miw = 260,
  ...rest
}: DateRangeFilterProps) {
  return (
    <DatePickerInput
      type="range"
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      clearable={clearable}
      miw={miw}
      {...rest}
    />
  );
}
