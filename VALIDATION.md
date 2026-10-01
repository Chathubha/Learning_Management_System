# Validation performed

Executed in this workspace on 2026-10-01 using Node 22.16.0 and npm 10.9.2.

| Check                                                               | Result                                     |
| ------------------------------------------------------------------- | ------------------------------------------ |
| Clean `npm ci` from lockfile                                        | Passed                                     |
| Strict TypeScript (`npm run typecheck`)                             | Passed                                     |
| ESLint (`npm run lint`)                                             | Passed, no errors or warnings              |
| Unit, configuration and persistent demo workflow tests (`npm test`) | 11 passed                                  |
| Actual migration tests in embedded PostgreSQL (`npm run test:db`)   | 8 passed                                   |
| Independent-connection concurrency (`npm run test:concurrency`)     | Explicitly skipped: no `TEST_DATABASE_URL` |
| Production bundle (`npm run build`)                                 | Passed                                     |
| `npm audit`                                                         | Zero vulnerabilities                       |

The demo tests exercise student creation, multiple enrollments, duplicate rejection, attendance corrections/unmarked states, persisted payment submissions/review/voids, student filtering and denied teacher actions. Database tests execute migrations 001–005, with stub Auth/Storage schemas, rather than relying only on UI guards. They cover role-metadata protection, forbidden direct role/review writes, allowed teacher actions, student RLS/class/file isolation, uniqueness and class consistency, due generation/date overlap/snapshots, partial and pending/rejected payments, competing approvals/overpayment, correction history, verified linking and archived own-history access.

PGlite has one connection. Its competing review test does **not** verify real independent-session contention. The provided separate PostgreSQL test asserts that a second approval waits for the first transaction's due lock, then rejects overpayment after the first commits. Run it on a disposable migrated database as described in README.

Browser UI/workflow and visual responsive checks were not performed: browser inventory was empty and opening the in-app browser returned `Browser is not available: iab`. The README includes desktop/mobile acceptance steps. Responsive styles are implemented, but their visual correctness is not claimed to have been browser-verified.

No Supabase credentials were available. Hosted Auth confirmation/reset/SMTP, PostgREST permissions, actual Storage API/signed download expiry, independent-client concurrency and Vercel deployment remain unverified. No real accounts were provisioned and no deployment was performed.
