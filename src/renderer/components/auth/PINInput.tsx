import { PasswordInput, PasswordInputProps } from '@mantine/core';
import { forwardRef } from 'react';

interface PINInputProps extends Omit<PasswordInputProps, 'type'> {
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Alphanumeric PIN input component
 * Uses a password input for masking
 */
export const PINInput = forwardRef<HTMLInputElement, PINInputProps>(
  ({ placeholder = 'Enter PIN', ...props }, ref) => {
    return (
      <PasswordInput
        ref={ref}
        placeholder={placeholder}
        autoComplete="off"
        size="lg"
        styles={{
          input: {
            textAlign: 'center',
            letterSpacing: '0.2em',
            fontFamily: 'monospace',
          },
        }}
        {...props}
      />
    );
  }
);

PINInput.displayName = 'PINInput';
