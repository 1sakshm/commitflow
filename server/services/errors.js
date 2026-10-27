export function fail(status, message, code) {
  return Object.assign(new Error(message), { status, code })
}
