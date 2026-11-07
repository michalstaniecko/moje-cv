// Adresy publicznego repo `michalstaniecko/moje-cv` i jego stron (GitHub Pages) – jedyne miejsce w kodzie, w którym
// są wpisane (poza Sponsor linkiem, który należy do `./sponsor` i jest tu reeksportowany, żeby lista była pełna).
// Zmiana repo albo domeny oznacza zmianę tylko tutaj. Proces główny używa wyłącznie tych stałych; renderer nigdy
// nie przesyła URL-a przez IPC. Ścieżki stron (`/` – pomoc, `/privacy/` – polityka prywatności) muszą się zgadzać
// z tym, co publikuje GitHub Pages repo `moje-cv`. Adresy wydań (GitHub Releases i jego API) służą powiadomieniu
// o nowej wersji w `.dmg` (ADR-0006); wydanie to GitHub Release z tagiem `vX.Y.Z`.
export { SPONSOR_URL } from './sponsor'

// Publiczne repo – z niego budowane są pozostałe adresy repo.
export const REPO_URL = 'https://github.com/michalstaniecko/moje-cv'

// Strona pomocy (GitHub Pages repo `moje-cv`).
export const HELP_URL = 'https://michalstaniecko.github.io/moje-cv/'

// Polityka prywatności (wymagana przez App Store).
export const PRIVACY_URL = 'https://michalstaniecko.github.io/moje-cv/privacy/'

// Nowe zgłoszenie w publicznym repo, z wyborem szablonu.
export const REPORT_ISSUE_URL = `${REPO_URL}/issues/new/choose`

// Sprawdzanie nowej wersji w `.dmg` (ADR-0006). Endpoint GitHub API zwraca najnowsze opublikowane wydanie i sam pomija
// drafty i pre-release'y.
export const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/michalstaniecko/moje-cv/releases/latest'

// Strona najnowszego wydania – „Otwórz stronę wydań”, gdy sprawdzenie się nie udało.
export const RELEASES_URL = `${REPO_URL}/releases/latest`

// Strona wydania danej wersji („Pobierz”). Ten sam adres co `html_url` z odpowiedzi GitHuba, ale zbudowany ze stałej
// i zweryfikowanej wersji `X.Y.Z`, więc aplikacja nigdy nie otwiera adresu pochodzącego z sieci.
export function releaseUrl(version: string): string {
  return `${REPO_URL}/releases/tag/v${version}`
}
