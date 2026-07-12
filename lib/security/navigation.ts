const ALLOWED_APP_PATH = /^\/(?:dashboard(?:\/[a-z0-9-]+)?|create)(?:[?#].*)?$/i;

export function safeAppPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value) || !ALLOWED_APP_PATH.test(value)) return fallback;
  try {
    const canonical = new URL(value, "https://nook.invalid");
    if (canonical.origin !== "https://nook.invalid") return fallback;
    return `${canonical.pathname}${canonical.search}${canonical.hash}`;
  } catch {
    return fallback;
  }
}
