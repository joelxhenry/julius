import { DatePickerInput, DatePickerInputProps } from '@mantine/dates';

export type DateRangeValue = [string | null, string | null];

const toDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns a `[start, end]` range spanning the last `days` days (inclusive of
 * today), formatted as `YYYY-MM-DD` strings ready for use as filter defaults.
 */
export function getLastNDaysRange(days: number): DateRangeValue {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return [toDateString(start), toDateString(end)];
}

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
