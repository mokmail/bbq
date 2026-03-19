# BBQ Benchmark App - Dockerfile
# Multi-stage build for production

# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build:prod

# Stage 2: Serve with node
FROM node:22-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/prod /app/prod

EXPOSE 3000

CMD ["serve", "prod", "-p", "3000"]
