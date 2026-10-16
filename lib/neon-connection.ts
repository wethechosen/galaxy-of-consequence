/** Pin the certificate-verifying behavior currently used by pg's SSL aliases. */
export function neonConnectionString(value: string | undefined) {
  if (!value) return value;
  const url = new URL(value);
  if (url.searchParams.get("uselibpqcompat") !== "true"
    && ["prefer", "require", "verify-ca"].includes(url.searchParams.get("sslmode") || "")) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}
