// PostToolUse-Hook: nach Edit/Write an .ts/.tsx `npm run typecheck` ausführen.
// Fehler → Exit 2, damit Claude die tsc-Ausgabe sieht und korrigiert.
import { execSync } from 'node:child_process'

let input = ''
for await (const chunk of process.stdin) input += chunk
const file = JSON.parse(input).tool_input?.file_path ?? ''
if (!/\.tsx?$/.test(file)) process.exit(0)

try {
  execSync('npm run typecheck', { cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(), stdio: 'pipe' })
} catch (e) {
  process.stderr.write(`typecheck fehlgeschlagen:\n${e.stdout}${e.stderr}`)
  process.exit(2)
}
