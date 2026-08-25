# ── Stage 1: shrink oversized textures ────────────────────────────────────────
# The Quaternius character pack ships 2048x2048 PNGs (normal maps alone are
# ~3.7 MB each). After compression was turned on they were 91% of the download
# — and PNG is already DEFLATE'd internally, so gzip cannot touch them.
# Characters render roughly 100 px tall in play, so 1024 is still well above
# what the screen resolves. This runs at BUILD time on purpose: the repo keeps
# the full-res originals for future re-authoring, and only the shipped copy is
# reduced. Delete this stage (and point the assets COPY back at the context) to
# revert to full resolution.
FROM alpine:3.21 AS textures
RUN apk add --no-cache imagemagick
COPY assets/ /work/assets/
# '1024x1024>' is ImageMagick's shrink-only flag — images already at or below
# 1024 (the 256px eye/lookup textures) are left byte-identical rather than
# needlessly re-encoded.
RUN find /work/assets -name '*.png' -size +512k \
      -exec mogrify -resize '1024x1024>' -strip {} + \
 && echo "shipped texture payload: $(du -sh /work/assets | cut -f1)"

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# No build step (vanilla ES modules, no bundler) — ship exactly the files
# the site serves, named explicitly rather than "copy everything and
# .dockerignore the rest": that approach bit us once already (nginx.conf
# had to be excluded from the served html root, but .dockerignore applies
# to the whole build context, so it silently broke the COPY above too,
# which needs this same file). Naming files here means nginx.conf itself,
# .git, docs, server.py, node_modules, etc. never enter the image at all.
COPY index.html styles.css /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/
COPY --from=textures /work/assets/ /usr/share/nginx/html/assets/

# Precompress everything gzip_static can serve (see nginx.conf). Done at build
# time with gzip -9 so nginx never spends CPU compressing per request, and so
# the ratio is better than the runtime `gzip_comp_level 6` fallback.
# PNG/JPG are skipped on purpose — already DEFLATE'd internally, gzip saves ~0.
# -k keeps the original next to the .gz: gzip_static needs the plain file for
# clients that send no Accept-Encoding, and nginx picks the .gz for the rest.
RUN find /usr/share/nginx/html \
      \( -name '*.js' -o -name '*.css' -o -name '*.html' \
         -o -name '*.gltf' -o -name '*.bin' -o -name '*.json' -o -name '*.env' \) \
      -size +1k -exec gzip -9 -k {} \;
