/**
 * Cooperative cancellation for evaluation runs.
 *
 * Why this exists: a BBQ question can take well over a minute to answer (a slow local
 * model, or a long chain of retries). Without real cancellation, pressing Stop only sets
 * a flag that is read *after* the current question finishes, so the button appears dead
 * for up to a minute. These helpers let the UI abort the in-flight HTTP requests
 * immediately while keeping a clean distinction between
 *
 *   - "the user asked us to stop"      -> cancellation, must never be retried
 *   - "the provider took too long"     -> a genuine timeout
 *
 * which matters because both services retry on generic errors; a cancel must not be
 * swallowed by a retry loop and reported later as a timeout.
 */

export const CANCELLED_MESSAGE = 'Cancelled by user';

/** Build the marker error used for every user-initiated cancellation. */
export const createCancelledError = () => {
  const error = new Error(CANCELLED_MESSAGE);
  error.cancelled = true;
  return error;
};

/** True for errors produced by `createCancelledError` (or an equivalent aborted fetch). */
export const isCancelledError = (error) =>
  Boolean(error && (error.cancelled === true || error.message === CANCELLED_MESSAGE));

/**
 * Abort `controller` whenever `externalSignal` fires, returning an unsubscribe function.
 *
 * The service keeps owning its own controller (so its timeout logic is unchanged); this
 * only makes the external signal an additional reason to abort.
 *
 * Accepts either an AbortSignal or an AbortController, so passing the wrong one is
 * harmless rather than a runtime crash.
 */
export const linkAbort = (controller, externalSignal) => {
  const signal = externalSignal?.signal ?? externalSignal;
  if (!signal || typeof signal.addEventListener !== 'function') return () => {};

  if (signal.aborted) {
    controller.abort();
    return () => {};
  }

  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
};

/**
 * `setTimeout` that rejects with a cancellation error if `signal` aborts first.
 * Used for backoff sleeps, so a pending retry does not keep the run alive after Stop.
 */
export const abortableDelay = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createCancelledError());
      return;
    }

    const cleanup = () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(createCancelledError());
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });

export default {
  CANCELLED_MESSAGE,
  createCancelledError,
  isCancelledError,
  linkAbort,
  abortableDelay,
};
