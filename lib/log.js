/**
 * Tiny logging helper.
 *
 * The whole add-on only ever talks to the local Thunderbird/Betterbird instance,
 * so a console log is the only diagnostic channel we need. Set DEBUG to true while
 * developing and watch the Error Console (Ctrl+Shift+J).
 */

export const DEBUG = false;

const PREFIX = "[Attach & Reply]";

function emit(level, args) {
  const fn = console[level] || console.log;
  fn(PREFIX, ...args);
}

export const log = {
  debug(...args) {
    if (DEBUG) emit("log", args);
  },
  info(...args) {
    if (DEBUG) emit("log", args);
  },
  warn(...args) {
    emit("warn", args);
  },
  error(...args) {
    emit("error", args);
  },
};

export default log;
