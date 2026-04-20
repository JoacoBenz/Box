'use client';

import { Input } from 'antd';

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Auto-formats phone numbers as XX-XXXX-XXXX while typing.
 * Accepts only digits; hyphens are inserted automatically after position 2 and 6.
 */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
}

export default function PhoneInput({
  value,
  onChange,
  disabled,
  placeholder = 'XX-XXXX-XXXX',
}: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(formatPhone(e.target.value));
  }

  return (
    <Input
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      maxLength={12}
      disabled={disabled}
      inputMode="numeric"
    />
  );
}
