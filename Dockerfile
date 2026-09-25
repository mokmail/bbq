FROM nginx:alpine

# Serve the built app.
COPY dist /usr/share/nginx/html

# The project's nginx config was previously never copied into the image, so every rule in
# it (gzip, SPA fallback, security headers) was silently ignored and the stock
# default.conf was used instead. Copy it where nginx actually reads it.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
