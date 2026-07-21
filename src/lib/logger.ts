const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;

type Payload = Record<string, unknown> | undefined;

function fmt(scope: string, message: string, payload?: Payload) {
  return payload ? [`[${scope}] ${message}`, payload] : [`[${scope}] ${message}`];
}

export const logger = {
  debug(scope: string, message: string, payload?: Payload) {
    if (!isDev) return;
    // eslint-disable-next-line no-console
    console.debug(...fmt(scope, message, payload));
  },
  warn(scope: string, message: string, payload?: Payload) {
    // eslint-disable-next-line no-console
    console.warn(...fmt(scope, message, payload));
  },
  error(scope: string, message: string, payload?: Payload) {
    // eslint-disable-next-line no-console
    console.error(...fmt(scope, message, payload));
  },
};
