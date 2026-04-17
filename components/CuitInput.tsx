'use client';

import { Input } from 'antd';
import type { InputRef } from 'antd';
import { useRef } from 'react';

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Formats CUIT as XX-XXXXXXXX-X automatically while typing.
 * Only digits are accepted; hyphens are inserted automatically.
 */
function formatCuit(raw: string): string {
  // Strip everything that isn't a digit
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export default function CuitInput({
  value,
  onChange,
  disabled,
  placeholder = 'XX-XXXXXXXX-X',
}: Props) {
  const inputRef = useRef<InputRef>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow the user to delete hyphens naturally: strip all and reformat
    const formatted = formatCuit(raw);
    onChange?.(formatted);
  }

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      maxLength={13}
      disabled={disabled}
      inputMode="numeric"
    />
  );
}
