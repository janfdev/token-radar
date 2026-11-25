// Token radar entrypoint (Node 22, standard library only).
//
// What a run does, in order:
//   1. Reads the sealed DefiLlama snapshot (default /input/snapshot.json;
//      --input accepts the file itself or the directory holding it).
//   2. Scores every pre-token protocol with the model in lib/model.ts and
//      refuses to write a board the gate would refuse (boardIssue).
//   3. Writes the ranked board to <output>/board.json and the dashboard's
//      data file to <output>/data.js, from the same in-memory board, so
//      the page and the board can never disagree.
//   4. Copies this repository's dashboard/ and screenshots/ alongside
//      them; the screenshots must be three or four sanely named images.
//   5. Writes <output>/dossier.json last, with the vendored make.fun
//      builder: the scorer rebuilds it from the finished output and
//      compares bytes, so it has to describe the output as it stands.
//
// <output> is /output in the grader's container; elsewhere the
// MAKEFUN_OUTPUT_DIR environment variable (or --output) stands in:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));

// The scorer's caps, mirrored from the gate so a bad hand-in fails here
// with a readable reason instead of failing silently at intake.
const CAPS = {
  textBytes: 65_536,
  shots: { max: 4, maxBytes: 524_288 },
  dashboard: { maxFiles: 400, maxBytes: 4_194_304 },
};
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Reads --name <value> or --name=<value> from argv, else the fallback. */
function flagValue(name: string, fallback: string): string {
  const argv = process.argv;
  const at = argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < argv.length) return argv[at + 1]!;
  const inline = argv.find((a) => a.startsWith(`--${name}=`));
  return inline === undefined ? fallback : inline.slice(name.length + 3);
}

function fail(code: number, message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(code);
}

/** Copies a directory's regular files into `dest`, skipping dotfiles. */
function copyDir(source: string, dest: string): string[] {
  if (!existsSync(source)) return [];
  mkdirSync(dest, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(source)) {
    if (name.startsWith('.')) continue;
    const from = join(source, name);
    if (!statSync(from).isFile()) continue;
    copyFileSync(from, join(dest, name));
    copied.push(name);
  }
  return copied;
}

function main(): void {
  const inputArg = flagValue('input', '/input');
  const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
  if (!existsSync(inputFile)) {
    fail(2, `no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input`);
  }
  const outDir = flagValue('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  let snapshot;
  try {
    snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
  } catch (err) {
    fail(2, `the snapshot at ${inputFile} does not parse: ${err instanceof Error ? err.message : String(err)}`);
  }
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) fail(1, `the model wrote a board the gate refuses: ${issue}`);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  writeFileSync(join(outDir, 'data.js'), dataScript(radar));

  copyDir(join(repoDir, 'dashboard'), join(outDir, 'dashboard'));
  const shots = copyDir(join(repoDir, 'screenshots'), join(outDir, 'screenshots'));
  if (shots.length < 3) {
    fail(1, `screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
  }
  for (const name of shots) {
    if (!SHOT_NAME.test(name)) {
      fail(1, `screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
    }
  }

  writeFileSync(
    join(outDir, 'dossier.json'),
    buildDossier(outDir, {
      text_max_bytes: CAPS.textBytes,
      screenshots: { max: CAPS.shots.max, max_bytes: CAPS.shots.maxBytes },
      dashboard: { max_files: CAPS.dashboard.maxFiles, max_bytes: CAPS.dashboard.maxBytes },
    }),
  );

  process.stdout.write(
    `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
      `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')} (3 files), ${join(outDir, 'screenshots')} (${shots.length} images) and ${join(outDir, 'dossier.json')}\n`,
  );
}

main();
