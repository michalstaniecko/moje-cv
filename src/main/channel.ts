// Kanał dystrybucji: build Mac App Store (`process.mas`, ustalany przy pakowaniu) albo `.dmg`. Jedyne miejsce tej
// decyzji w procesie głównym – korzystają z niej Sponsor bar (`sponsor:is-available`) i menu Pomoc, więc nie mogą się
// rozjechać (ADR-0005).
export function isMacAppStore(): boolean {
  return Boolean(process.mas)
}
