import { useCallback, useRef, useState } from 'react';

import { firstFieldError, hasFieldError, type FieldErrors } from '@/src/shared/lib/validation';

/**
 * Per-field validation for a form, shown only once someone tries to save.
 *
 * `build` describes what is wrong with the form right now. It runs on every
 * render, so a message disappears the moment the field is corrected — nothing
 * has to be cleared by hand in each onChangeText. Until the first save attempt
 * `errors` is empty, so a blank form is not covered in red before it is touched.
 *
 *   const fields = useFieldErrors(() => ({
 *     name: requiredText(form.name, 'Enter an item name.'),
 *     price: positiveNumber(form.price),
 *   }));
 *
 *   if (!fields.check()) return toast.error(fields.first);
 *   <FormField error={fields.errors.name} … />
 */
export function useFieldErrors<K extends string>(build: () => FieldErrors<K>) {
  const [showing, setShowing] = useState(false);
  const latest = useRef(build);
  latest.current = build;

  const current = build();
  const errors = showing ? current : ({} as FieldErrors<K>);

  /** Reveals the messages and answers whether the form is good to send. */
  const check = useCallback(() => {
    setShowing(true);
    return !hasFieldError(latest.current());
  }, []);

  /** After a successful save, or when a sheet reopens with a blank form. */
  const reset = useCallback(() => setShowing(false), []);

  return {
    errors,
    check,
    reset,
    /** The first problem, for a toast or a summary line. */
    first: firstFieldError(current),
    hasError: hasFieldError(current),
  };
}
