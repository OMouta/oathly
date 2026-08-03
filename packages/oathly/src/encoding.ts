function toBinaryString(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

export function base64Encode(bytes: Uint8Array): string {
  return btoa(toBinaryString(bytes));
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function utf8ToBase64Url(value: string): string {
  return base64UrlEncode(new TextEncoder().encode(value));
}

export function base64UrlToUtf8(value: string): string {
  return new TextDecoder().decode(base64UrlDecode(value));
}
