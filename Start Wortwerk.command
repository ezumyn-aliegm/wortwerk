#!/bin/zsh
# Open this file on macOS to serve the included, already-built app.
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  print 'Wortwerk needs Node.js 22.12 or newer. Install Node.js from https://nodejs.org, then open this file again.'
  read '?Press Return to close.'
  exit 1
fi
print 'Open http://127.0.0.1:4173 in your browser. Keep this window open while studying.'
node server.mjs
if [[ $? -ne 0 ]]; then
  read '?Press Return to close.'
fi
