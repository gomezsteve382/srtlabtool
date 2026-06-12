# UI rebuild — job-flow model (stages 22–23)

Fixes the "three competing menus, three names per job, 61 flat tabs" problem.
Front-page rail/landing intent preserved; this restructures the **back-end**
workspace nav into six **job doors**. Verified against the live test suite
(pnpm/vitest) — 15 nav-guard tests green, DumpsTab suites green.

## The model — one source of truth
`artifacts/srt-lab/src/workspaceJobs.js` (new). Six jobs, each with a `primary`
tab + member `modes`:

| Job | Door label | Primary | Members (modes) |
|---|---|---|---|
| read  | READ MODULE  | inspector | bcm, rfhub, ecm, skim, skimlive, smartbox, immobcm56xb, bcmconfig, proxi |
| marry | MARRY / SYNC | secsync   | vinsync, modsync |
| keys  | KEYS         | keyprog   | keyxfer, keymgr, livekey, keywriter, radiocodes, seed, jailbreak |
| flash | FLASH        | flasher   | cflash, gpecunlock, efd, efd2bin, fwemul, vinprog, cdasession |
| live  | LIVE OBD     | obd       | uds-console, udsanalyzer, loganalyser |
| ref   | REFERENCE    | dumps     | backups, samples, workflow, investigation, alfaobd, alfaintel, binintel, dispatchcov, unlockcov, canuniverse, patterns, kg, sigdisc, cda6db, exttools |

All **49** workspace tabs map to exactly one job (verified 1:1, zero orphans).
`jobOf()` falls back to `ref`, so a newly-added tab can never go unreachable.

## What changed (stage 22 — rail + drawer)
- `CommandShell` derives BOTH the rail (was 8 arbitrary tabs with a *second*
  vocabulary) and the drawer's 6 sections from `JOBS`. One job = one name
  everywhere. Rail door stays lit while on any member tab (BCM keeps READ lit).

## What changed (stage 23 — mode strip + landing)
- `CommandShell.ModeStrip` — a per-job pill strip across the top of the
  workspace. The 8 KEYS / 10 READ duplicate tabs become **modes inside one
  screen** instead of N separate drawer entries. This is the piece that makes
  the duplication disappear on screen.
- `App.JobCards` — the six doors as a "what are you trying to do?" hero on the
  Diagnose landing, gated behind a new `DumpsTabV2 onOpenTab` prop (so the many
  DumpsTab unit tests render the landing unchanged).
- `MarrySyncTab` gets a stable `marry-sync-tab` root testid.

## Tests
Nav drift-guards rewritten to the job-flow model (`workspaceNav`,
`keyTransferNav`, `keyTransferTab`): rail doors open jobs (mode-strip assertion),
keyxfer reached via KEYS door + mode pill, drawer sample expands its collapsible
section first. **15 nav tests + 44 incl. DumpsTab green.**

Pre-existing suite failures (7 files: FcaModuleInspector.workspace, gpec2aImmo,
keyPhotoImport, keyProgWizard.rfhSec16Write, rfhubGen2SizeDetect,
checksum.fixtures, corruptReject) were confirmed failing on a clean pre-rebuild
tree — they are fixture/OCR/SEC16/generated-data issues, untouched by this work.

## Apply
Patches `0022-*.patch` and `0023-*.patch` in `patches/`. From the SaaS-Master
repo root: `git am saas-master-cleanup/patches/0022-*.patch saas-master-cleanup/patches/0023-*.patch`
(or `git apply` the diffs). Then `node scripts/generate-quickref-data.mjs` once
so `src/lib/attachedAssetMismatches.generated.json` exists before `pnpm test`.

## Still open (next session)
- `dumps` is the REFERENCE door's primary, so landing on Diagnose lights the
  REFERENCE door — minor. A dedicated HOME door would clean it up.
- Per-tab content density (inside each mode) is unchanged; the nav is fixed,
  the individual tab bodies are the next pass if wanted.
