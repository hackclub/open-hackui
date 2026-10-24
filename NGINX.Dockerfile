FROM nginx:alpine

COPY nginx-proxy.conf /etc/nginx/conf.d/default.conf
COPY manifest.json /usr/share/nginx/html/manifest.json
