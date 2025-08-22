# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Installera beroenden
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Kopiera källkod och bygg
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.27-alpine
# Kopiera byggt artefakter
COPY --from=build /app/dist /usr/share/nginx/html

# Egen nginx-konfig (valfritt – men bra för single-page)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]