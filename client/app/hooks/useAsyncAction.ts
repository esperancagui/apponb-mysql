"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Wraps an async function to prevent concurrent invocations (multi-click).
 * Uses a ref for the guard (no extra re-render on call) and state only for
 * exposing `pending` to the UI so buttons can be disabled.
 *
 * Usage:
 *   const [handleSave, isSaving] = useAsyncAction(async () => { ... });
 *   <button onClick={handleSave} disabled={isSaving}>Salvar</button>
 */
export function useAsyncAction<T extends unknown[]>(
  fn: (...args: T) => Promise<unknown>,
): [(...args: T) => Promise<void>, boolean] {
  const [pending, setPending] = useState(false);
  const runningRef = useRef(false);

  const run = useCallback(
    async (...args: T) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setPending(true);
      try {
        await fn(...args);
      } finally {
        runningRef.current = false;
        setPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn],
  );

  return [run, pending];
}
