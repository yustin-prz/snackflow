FROM nginx:alpine

COPY ./pages /usr/share/nginx/html
COPY ./assets /usr/share/nginx/html/assets
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
