import { PinInput as MantinePinInput, PinInputProps } from '@mantine/core';

interface CustomPINInputProps extends Omit<PinInputProps, 'length' | 'type' | 'mask'> {
  length?: number;
}

export function PINInput({ length = 4, ...props }: CustomPINInputProps) {
  return (
    <MantinePinInput
      length={length}
      type="number"
      mask
      size="lg"
      {...props}
    />
  );
}
