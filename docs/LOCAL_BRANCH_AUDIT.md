# Local branch audit — 2026-10-27

## Result

- Audited all 30 original local branches, the one Git stash, and all 14 modified/untracked working files.
- Before consolidation, no commits reachable from a local branch were missing from all remote branches. This does not mean every feature was merged into main.
- 22 original branch tips are ancestors of main; eight are outside its ancestry. Their nine distinct commits are listed below.
- GitHub Compare API checks confirmed live main, frontend-main and backend-main at `0a69c445ba13dce542462e02f40aac4f22238d93`. Each of the eight non-ancestor local tips also matched its live corresponding branch/archive exactly.
- Ordinary Git fetch remains unavailable because OpenSSH rejects the ownership/permissions of `/etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf`. Live GitHub connector comparisons supplied the independent remote verification; cached refs alone were not treated as conclusive.
- The two unpublished working changes were consolidated on `frontend-main/chore/consolidate-local-work`, based on `origin/frontend-main`. They are committed locally. No branch was pushed, merged remotely, deleted, or reset. The original stash remains.

## Unpublished work consolidated

| Change | Files | Recommendation |
|---|---:|---|
| Google sign-in button component, styling, image/font/license assets, login wiring and signup wording | 6 | Keep. |
| Eight-digit password-reset input, completion/validation, local email OTP configuration, recovery text, docs and regression tests | 8 | Keep. |

The 14 original file contents were preserved byte-for-byte (SHA-256 compared against the backup manifest). This audit is an additional file.

## Every original local branch

“Published” here means the branch commit exists on GitHub, possibly under an archive name. “Delete” is a recommendation for the local branch ref, not for deployed features or remote branches. No deletions were performed.

| Local branch | Finding | Recommendation |
|---|---|---|
| `archive/feat/backend-api` | Superseded API and booking/dashboard WIP; remote archive exists. | Delete local branch; keep current implementation. |
| `archive/feat/mobile-patient-ui` | Historical setup documentation superseded by current guides. | Delete local branch. |
| `backend-main` | Backend integration branch. | Keep. |
| `backend/feat/api` | API implementation reintroduced as fe5747d, an ancestor of main. | Delete local branch; keep current API. |
| `backend/feat/supabase-api` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `chore/ci-hardening` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `feat/backend-clinic-workflows` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `feat/clinic-services` | Catalog overlaps current migration/seed; contact values differ and were not ported. | Keep temporarily to review/extract clinic contact data; do not merge old seed wholesale. |
| `feat/clinic-services-ui` | Alternative zero-price / Price at clinic policy; current code uses priceIsTemporary. | Delete local branch; retain the explicit temporary-price implementation. |
| `feat/clinic-workflows-auth-and-history` | Functionality ported through 6ddc059 and fc75a77; main includes subsequent review fixes. | Delete local branch; keep current implementation. |
| `feat/frontend-clinic-workflows` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `feat/hannah-backend` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `feat/integrate-hannah` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `feat/mobile-patient-ui` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `feat/seed-demo-patient` | Seeder script and seed:patient command are absent from main. Remote archive exists. | Keep temporarily; recover as an optional development tool after adapting/testing against current schema. |
| `feat/unified-login-date-ranges` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `fix/backend-vercel` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `fix/clinic-ui-polish` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `fix/frontend-vercel` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `fix/google-sign-in-branding` | Tip equals main; its working changes are now captured on the consolidation branch. | Delete old local branch after retaining consolidation branch. |
| `fix/patient-login` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `fix/remove-admin-my-account` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `fix/seed-clinical-timeline` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `frontend-main/chore/integrate-backend` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `frontend/feat/api-wiring` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `frontend/feat/ui-scaffold` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `integration/preview-team-mains` | Only two preview merge commits outside main; no non-merge patches. | Delete local branch. |
| `main` | Production branch. | Keep. |
| `setup/backend` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |
| `setup/project-scaffold` | All branch commits are ancestors of main; no unpublished commits. | Delete local branch; retain the features already in main. |

For the 30 original branches: keep the two integration/production refs, retain two feature refs temporarily for review, and remove the other 26 local refs when cleanup is approved. Keep the new consolidation branch until its changes are integrated.

## Commits outside main ancestry

All of these are already published. Different commit hashes alone do not establish missing functionality; the audit also compared source files and successor commits.

| Commit | Existing remote branch | Assessment |
|---|---|---|
| `4a15d4d` | `backend/feat/api`, `archive/feat/backend-api` | Superseded by main API history, including `fe5747d`. |
| `b5d248d` | `archive/feat/backend-api` | Old booking/dashboard WIP. Current code has automatic confirmations, bookedToday and reschedule alerts, plus later date-range/workflow changes. Current local guide explicitly records the archive as database-incompatible. |
| `0db89cd` | `archive/feat/mobile-patient-ui` | Setup guide was rewritten with current ports and workflows; do not restore historical troubleshooting/dependency claims as current facts. |
| `d1ff227` | `archive/feat/clinic-services` | Service catalog now has a newer migration and temporary-price schema. Clinic address/mobile/email changes remain a separate data decision worth preserving for review. |
| `baeb972` | `archive/feat/clinic-services-ui` | Zero-as-unknown pricing differs from current priceIsTemporary handling; merging would change pricing policy. |
| `afd3a5a` | `feat/clinic-workflows-auth-and-history` | Work ported into `6ddc059` / `fc75a77`; current main adds medicine-photo validation and atomic batch receipt fixes. A whole-tree restore would remove those fixes. |
| `7608624` | `archive/feat/seed-demo-patient` | Genuine optional tool absent from main: `backend/src/scripts/seed-patient.ts` and `seed:patient`. It creates synthetic records and updates an existing account password; review/adapt before execution. It was not run or added to this consolidation. |
| `04312fb`, `8ca2498` | `archive/integration/preview-team-mains` | Preview-only merge commits. Their underlying integrated work is already in main. |

## Stash assessment

`stash@{0}` (`ac35aef`) records port 6100/6101 and hosted-environment setup on `archive/feat/backend-api`. It is local-only Git history, but its configuration behavior is already in main:

- `backend/.env.example`, `backend/src/config/env.ts`, and `frontend/vite.config.ts` are byte-identical to the stashed versions.
- Current frontend environment examples retain the hosted setup and add the Google-login feature flag.
- The API base retains port 6101 and adds Vercel same-origin proxy handling; the current Supabase redirects retain port 6100 and add recovery/OAuth callbacks.
- Current README/development/frontend guides document these ports and setup with newer instructions.

Recommendation: drop this stale stash during approved cleanup. Applying it would regress newer docs, proxy logic and callback allowlists. The stash itself was preserved, and its exact contents are included in the backup bundle.

## Validation

- Frontend: full ESLint and production build passed; 79 tests passed across 15 files. Vite reported a bundle-size warning.
- Backend: full ESLint and TypeScript build passed; 60 tests passed across 11 files. Six database suites / 116 tests were intentionally skipped with Supabase pointed at an unavailable local endpoint.
- Initial backend HTTP tests could not bind sockets inside the sandbox (`listen EPERM`); the same suite passed with the required local-port execution access.
- API contract synchronization passed for all 11 generated contract files.
- Git whitespace checks passed for source/documentation changes. The complete diff flags the original CRLF/trailing whitespace in the vendored Google font license; that third-party file was preserved byte-for-byte. Original branch refs and working-file contents were preserved.
- No database migrations, seed scripts, hosted writes, live OAuth login, live email recovery, or browser interaction tests were performed.

## Recovery backup

`/tmp/havencare-local-audit-20261027/` contains a verified complete Git bundle of the original refs (including stash), a binary working-tree patch, a tarball of the 14 working files, and a SHA-256 manifest. This is a temporary local backup; original branches/stash and published archives remain the primary preserved sources.
