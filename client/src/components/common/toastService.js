const listeners = new Set();

export const subscribeToast = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const showToast = (message, severity = 'info', options = {}) => {
  if (!message) return;
  const toast = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    message,
    severity,
    persist: Boolean(options.persist || severity === 'error'),
    duration: options.duration,
  };
  listeners.forEach((listener) => listener(toast));
};

export const toast = {
  success: (message, options) => showToast(message, 'success', options),
  error: (message, options) => showToast(message, 'error', { persist: true, ...options }),
  warning: (message, options) => showToast(message, 'warning', options),
  info: (message, options) => showToast(message, 'info', options),
};
