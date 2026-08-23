---
name: run
description: Start the Weaponstrike Arena HTTP server and give the user a clickable URL to play in their browser.
---

# Run: Weaponstrike Arena

Start the HTTP server and hand the user a URL. No headless browser, no screenshots — just get it running so they can play.

## Steps

1. Kill any existing server on port 8934.
2. Start the server in the background from the project root.
3. Confirm it responds.
4. Print the URL for the user to click.

```bash
lsof -ti:8934 | xargs kill -9 2>/dev/null || true
cd /Users/lukebonano/projects/stormstrike-arena
python3 server.py &
echo $! > /tmp/stormstrike-server.pid
sleep 1 && curl -sf http://localhost:8934 > /dev/null && echo "Ready"
```

Then tell the user: **http://localhost:8934** — click to open in browser.

## Stopping the server

```bash
kill $(cat /tmp/stormstrike-server.pid) 2>/dev/null || lsof -ti:8934 | xargs kill -9 2>/dev/null || true
```

## Notes

- No build step — files are served directly from the project root.
- Must use HTTP (not `file://`) because ES modules require a real server origin.
- The server stays running until explicitly stopped or the terminal session ends.
