FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# No build step (vanilla ES modules, no bundler) — just ship the static
# site. .dockerignore keeps dev-only files (.git, node_modules, docs, the
# python dev server, the unused legacy root main.js) out of the image.
COPY . /usr/share/nginx/html
