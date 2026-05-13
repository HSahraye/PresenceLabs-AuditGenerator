type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...(meta ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    emit("info", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    emit("warn", message, meta);
  },
  error(message: string, meta?: Record<string, unknown>) {
    emit("error", message, meta);
  },
};
