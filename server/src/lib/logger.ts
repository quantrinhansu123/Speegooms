const SECRET_KEY = /password|secret|token|cookie|authorization|service.?role|csrf|hash/i;

function scrub(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://[redacted]")
    .replace(/https?:\/\/\S+/gi, (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.username) parsed.username = "redacted";
        if (parsed.password) parsed.password = "redacted";
        return parsed.toString();
      } catch {
        return "[redacted-url]";
      }
    })
    .replace(/bearer\s+\S+/gi, "bearer [redacted]")
    .replace(/eyJ[a-zA-Z0-9_-]{10,}/g, "[redacted-jwt]");
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: scrub(err.message),
      stack: err.stack ? scrub(err.stack) : undefined,
    };
  }
  return { message: scrub(String(err)) };
}

function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEY.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (key === "err" || key === "cause") {
      out[key] = serializeError(value);
      continue;
    }
    if (typeof value === "string") out[key] = scrub(value).slice(0, 500);
    else if (typeof value === "number" || typeof value === "boolean" || value == null) out[key] = value;
  }
  return out;
}

function write(level: "info" | "error", message: string, fields?: Record<string, unknown>) {
  let line: string;
  try {
    line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      ...sanitizeFields(fields ?? {}),
    });
  } catch {
    line = JSON.stringify({ time: new Date().toISOString(), level, message });
  }
  if (level === "error") console.error(line);
  else console.log(line);
}

export const logger = {
  info(message: string, fields?: Record<string, unknown>) {
    write("info", message, fields);
  },
  error(message: string, fields?: Record<string, unknown>) {
    write("error", message, fields);
  },
};
