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
COPY assets/ /usr/share/nginx/html/assets/
