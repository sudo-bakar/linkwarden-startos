import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '2.16.3:0',
  releaseNotes: {
    en_US: `Updated Linkwarden to 2.16.3.

**Improvements**

- Significantly faster queries at scale: links, search, tags, collections, and the dashboard
- Case-insensitive sorting of links, collections, and tags
- Announcement dismissals are now saved to your account, so they stay dismissed across devices
- Fixed sign-in issues with Azure AD B2C and improved OIDC account handling

**Upgrade notes**

- MeiliSearch upgraded from 1.12.8 to 1.13.3. The search index upgrades itself in place the first time the service starts after this update; search is unavailable until that finishes (usually seconds, longer for large libraries). No action needed.

[Full release notes](https://github.com/linkwarden/linkwarden/releases/tag/v2.16.3)`,
    es_ES: `Linkwarden actualizado a 2.16.3.

**Mejoras**

- Consultas mucho más rápidas a gran escala: enlaces, búsqueda, etiquetas, colecciones y el panel
- Ordenación sin distinción de mayúsculas y minúsculas de enlaces, colecciones y etiquetas
- El descarte de anuncios ahora se guarda en tu cuenta, por lo que permanece descartado en todos los dispositivos
- Corrección de problemas de inicio de sesión con Azure AD B2C y mejora del manejo de cuentas OIDC

**Notas de actualización**

- MeiliSearch actualizado de 1.12.8 a 1.13.3. El índice de búsqueda se actualiza en el lugar la primera vez que se inicia el servicio tras esta actualización; la búsqueda no está disponible hasta que termine (normalmente segundos, más tiempo en bibliotecas grandes). No se requiere ninguna acción.

[Notas de la versión completa](https://github.com/linkwarden/linkwarden/releases/tag/v2.16.3)`,
    de_DE: `Linkwarden auf 2.16.3 aktualisiert.

**Verbesserungen**

- Deutlich schnellere Abfragen bei großen Datenmengen: Links, Suche, Tags, Sammlungen und Dashboard
- Sortierung ohne Beachtung der Groß-/Kleinschreibung bei Links, Sammlungen und Tags
- Ausgeblendete Ankündigungen werden jetzt im Konto gespeichert und bleiben auf allen Geräten ausgeblendet
- Anmeldeprobleme mit Azure AD B2C behoben und OIDC-Kontoverwaltung verbessert

**Hinweise zum Update**

- MeiliSearch von 1.12.8 auf 1.13.3 aktualisiert. Der Suchindex wird beim ersten Start nach diesem Update automatisch aktualisiert; die Suche ist erst danach verfügbar (normalerweise Sekunden, bei großen Bibliotheken länger). Kein Handlungsbedarf.

[Vollständige Versionshinweise](https://github.com/linkwarden/linkwarden/releases/tag/v2.16.3)`,
    pl_PL: `Zaktualizowano Linkwarden do 2.16.3.

**Ulepszenia**

- Znacznie szybsze zapytania przy dużych ilościach danych: linki, wyszukiwanie, tagi, kolekcje i panel
- Sortowanie bez rozróżniania wielkości liter dla linków, kolekcji i tagów
- Odrzucenie ogłoszeń jest teraz zapisywane na koncie, więc pozostaje odrzucone na wszystkich urządzeniach
- Naprawiono problemy z logowaniem przez Azure AD B2C i ulepszono obsługę kont OIDC

**Informacje o aktualizacji**

- MeiliSearch zaktualizowany z 1.12.8 do 1.13.3. Indeks wyszukiwania aktualizuje się w miejscu przy pierwszym uruchomieniu usługi po tej aktualizacji; wyszukiwanie będzie niedostępne do czasu zakończenia (zwykle sekundy, dłużej przy dużych bibliotekach). Nie są wymagane żadne działania.

[Pełne informacje o wydaniu](https://github.com/linkwarden/linkwarden/releases/tag/v2.16.3)`,
    fr_FR: `Linkwarden mis à jour vers 2.16.3.

**Améliorations**

- Requêtes beaucoup plus rapides à grande échelle : liens, recherche, étiquettes, collections et tableau de bord
- Tri insensible à la casse des liens, collections et étiquettes
- Les annonces ignorées sont désormais enregistrées sur votre compte et restent ignorées sur tous les appareils
- Correction des problèmes de connexion avec Azure AD B2C et amélioration de la gestion des comptes OIDC

**Notes de mise à niveau**

- MeiliSearch mis à jour de 1.12.8 vers 1.13.3. L'index de recherche se met à jour sur place au premier démarrage du service après cette mise à jour ; la recherche est indisponible jusqu'à la fin (généralement quelques secondes, plus longtemps pour les grandes bibliothèques). Aucune action requise.

[Notes de version complètes](https://github.com/linkwarden/linkwarden/releases/tag/v2.16.3)`,
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
