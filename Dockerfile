# Bouwen met Node, serveren met nginx. Werkt op x86 én ARM64 (Raspberry Pi 4/5, 64-bit OS).

# ---- 1. Build ----
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 2. Serveren ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
