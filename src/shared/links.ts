// Adresy publicznego repo `michalstaniecko/moje-cv` i strony aplikacji – jedyne miejsce w kodzie, w którym
// są wpisane (poza Sponsor linkiem, który należy do `./sponsor` i jest tu reeksportowany, żeby lista była pełna).
// Zmiana repo albo domeny oznacza zmianę tylko tutaj. Proces główny używa wyłącznie tych stałych; renderer nigdy
// nie przesyła URL-a przez IPC. Pomoc i polityka prywatności są na stronie
// `ihumbak.website/cv-drawer/` (te same adresy trafiają do App Store Connect). Adresy wydań (GitHub Releases i jego API) służą powiadomieniu
// o nowej wersji w `.dmg` (ADR-0006); wydanie to GitHub Release z tagiem `vX.Y.Z`.
export { SPONSOR_URL } from './sponsor'

// Publiczne repo (właściciel i nazwa) – z niego budowane są wszystkie adresy poniżej.
const REPO = { owner: 'michalstaniecko', name: 'moje-cv' } as const

export const REPO_URL = `https://github.com/${REPO.owner}/${REPO.name}`

// Strona aplikacji.
const SITE_URL = 'https://ihumbak.website/cv-drawer/'

// Strona pomocy (Support URL w App Store Connect).
export const HELP_URL = SITE_URL

// Polityka prywatności (wymagana przez App Store).
export const PRIVACY_URL = `${SITE_URL}privacy/`

// Nowe zgłoszenie w publicznym repo, z wyborem szablonu.
export const REPORT_ISSUE_URL = `${REPO_URL}/issues/new/choose`

// Sprawdzanie nowej wersji w `.dmg` (ADR-0006). Endpoint GitHub API zwraca najnowsze opublikowane wydanie i sam pomija
// drafty i pre-release'y.
export const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REPO.owner}/${REPO.name}/releases/latest`

// Strona najnowszego wydania – „Otwórz stronę wydań”, gdy sprawdzenie się nie udało.
export const RELEASES_URL = `${REPO_URL}/releases/latest`

// Strona wydania danej wersji („Pobierz”). Ten sam adres co `html_url` z odpowiedzi GitHuba, ale zbudowany ze stałej
// i zweryfikowanej wersji `X.Y.Z`, więc aplikacja nigdy nie otwiera adresu pochodzącego z sieci.
export function releaseUrl(version: string): string {
  return `${REPO_URL}/releases/tag/v${version}`
}
