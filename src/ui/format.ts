import { useCallback } from 'preact/hooks';
import { formatF } from '../domain/money';
import { useStore } from '../state/store';

/** Formateur de montants qui respecte le mode discret. */
export function useMoney() {
  const { settings } = useStore();
  const discreet = settings.discreet;
  return useCallback(
    (amount: number, opts: { sign?: boolean } = {}) => (discreet ? '•••• F' : formatF(amount, opts)),
    [discreet],
  );
}
