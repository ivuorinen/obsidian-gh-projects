const PREFIX = "[GH Projects]";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface LoggerDeps {
  getDebugMode: () => boolean;
  getToken: () => string | null;
}

function redactArg(arg: unknown, token: string): unknown {
  if (typeof arg === "string") {
    return arg.replaceAll(token, "[REDACTED]");
  }
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message.replaceAll(token, "[REDACTED]")}`;
  }
  if (typeof arg === "object" && arg !== null) {
    return JSON.stringify(arg).replaceAll(token, "[REDACTED]");
  }
  return arg;
}

function redactArgs(args: unknown[], token: string | null): unknown[] {
  if (!token) return args;
  return args.map((arg) => redactArg(arg, token));
}

export function createLogger(deps: LoggerDeps): Logger {
  function log(level: LogLevel, args: unknown[]): void {
    const isVerbose = level === "debug" || level === "info";
    if (isVerbose && !deps.getDebugMode()) return;

    const redacted = redactArgs(args, deps.getToken());
    if (level === "debug") {
      console.debug(PREFIX, ...redacted);
    } else if (level === "info") {
      // eslint-disable-next-line no-console
      console.info(PREFIX, ...redacted);
    } else if (level === "warn") {
      console.warn(PREFIX, ...redacted);
    } else {
      console.error(PREFIX, ...redacted);
    }
  }

  return {
    debug: (...args: unknown[]) => log("debug", args),
    info: (...args: unknown[]) => log("info", args),
    warn: (...args: unknown[]) => log("warn", args),
    error: (...args: unknown[]) => log("error", args),
  };
}
