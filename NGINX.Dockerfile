FROM nginx:alpine

COPY nginx-proxy.conf.template /etc/nginx/templates/default.conf.template
COPY manifest.json /usr/share/nginx/html/manifest.json
