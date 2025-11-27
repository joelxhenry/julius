import { NumberInput, NumberInputProps } from '@mantine/core';

interface CurrencyInputProps extends Omit<NumberInputProps, 'prefix' | 'decimalScale'> {
  currency?: string;
}

export function CurrencyInput({ currency = '$', ...props }: CurrencyInputProps) {
  return (
    <NumberInput
      prefix={currency}
      decimalScale={2}
      fixedDecimalScale
      thousandSeparator=","
      hideControls
      {...props}
    />
  );
}
