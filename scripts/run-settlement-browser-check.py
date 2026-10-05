from pathlib import Path
import os
import subprocess
import shutil
import json

root = Path(__file__).resolve().parents[1]
source = (root / 'scripts/verify-settlement-browser.mjs').read_text().replace('export async function', 'async function')
(root / 'output/playwright/settlement').mkdir(parents=True, exist_ok=True)
code = 'async (page) => {\n' + source + '\nreturn await verifySettlement(page);\n}'
env = dict(os.environ, PWTEST_DAEMON_SESSION_DIR='/private/tmp/wortwerk-pw-daemon', npm_config_cache='/private/tmp/wortwerk-npm-cache')
result = subprocess.run(['/Users/aliegm/.codex/skills/playwright/scripts/playwright_cli.sh', '-s=wortwerk-expansion', 'run-code', code], cwd=root, env=env, check=False, capture_output=True, text=True)
print(result.stdout)
if result.returncode:
    print(result.stderr)
    raise SystemExit(result.returncode)
receipt=json.loads(result.stdout.split("### Result\n")[1].split("\n")[0])
(root / "docs/evidence/growing-village/browser-result.json").write_text(json.dumps(receipt, indent=2)+"\n")

for name in ['study-closeup-4.png', 'study-closeup-40.png', 'study-closeup-100.png', 'study-closeup-correction.png', 'study-layout-1280.png', 'study-layout-1024.png', 'study-layout-390.png', 'bakery-100.png', 'bakery-4.png', 'bakery-40.png', 'bakery-stages.png', 'connected-complete-future.png', 'connected-current-100.png', 'connected-current-4.png', 'connected-current-40.png', 'exact-correction-resume.png', 'historical-repair.png', 'responsive-1024.png', 'responsive-1280.png', 'responsive-390.png']:
    shutil.copy2(root / "output/playwright/settlement" / name, root / "docs/evidence/growing-village" / name)
