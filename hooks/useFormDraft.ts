'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormInstance } from 'antd/es/form';

interface Envelope<T> {
  savedAt: number;
  values: T;
}

interface UseFormDraftOptions<T> {
  form: FormInstance<T>;
  storageKey: string;
  expireMs?: number;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseFormDraftReturn {
  hasDraft: boolean;
  savedAt: number | null;
  restore: () => void;
  discard: () => void;
  clear: () => void;
  /** Wire to <Form onValuesChange={onValuesChange} /> */
  onValuesChange: () => void;
}

const DEFAULT_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_DEBOUNCE_MS = 500;

function readDraft<T>(key: string, expireMs: number): Envelope<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > expireMs) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Persist an antd Form's values to localStorage so the user doesn't lose
 * work on refresh / session expiry / accidental navigation.
 *
 * Usage:
 *   const draft = useFormDraft({ form, storageKey: 'nueva-solicitud' });
 *   <Form form={form} onValuesChange={draft.onValuesChange}>
 *   {draft.hasDraft && <Banner onRestore={draft.restore} onDiscard={draft.discard} />}
 *   // on successful submit:
 *   draft.clear();
 *
 * On mount, if a draft is present, `hasDraft` is true so the page can show
 * a banner. The draft is NOT auto-applied — silently rewriting inputs under
 * the user surprises them; the restore is explicit.
 */
export function useFormDraft<T = Record<string, unknown>>({
  form,
  storageKey,
  expireMs = DEFAULT_EXPIRE_MS,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseFormDraftOptions<T>): UseFormDraftReturn {
  const [envelope, setEnvelope] = useState<Envelope<T> | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read any existing draft once on mount. Snapshot it so a later debounced
  // save from this session doesn't make the restore banner reappear.
  useEffect(() => {
    if (!enabled) return;
    const existing = readDraft<T>(storageKey, expireMs);
    if (existing) setEnvelope(existing);
  }, [enabled, storageKey, expireMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onValuesChange = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const values = form.getFieldsValue(true);
        const hasAny =
          values && Object.values(values).some((v) => v !== undefined && v !== null && v !== '');
        if (!hasAny) {
          window.localStorage.removeItem(storageKey);
          return;
        }
        const payload: Envelope<T> = { savedAt: Date.now(), values };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // quota exceeded or serialization error — silently skip
      }
    }, debounceMs);
  }, [enabled, form, storageKey, debounceMs]);

  const restore = useCallback(() => {
    if (!envelope) return;
    form.setFieldsValue(envelope.values as never);
    setDismissed(true);
  }, [envelope, form]);

  const discard = useCallback(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey);
    setDismissed(true);
    setEnvelope(null);
  }, [storageKey]);

  const clear = useCallback(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey);
    setEnvelope(null);
    setDismissed(true);
  }, [storageKey]);

  return useMemo(
    () => ({
      hasDraft: !!envelope && !dismissed,
      savedAt: envelope?.savedAt ?? null,
      restore,
      discard,
      clear,
      onValuesChange,
    }),
    [envelope, dismissed, restore, discard, clear, onValuesChange],
  );
}
