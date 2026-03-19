# BBQ Benchmark App - Production Dockerfile

FROM docker.bev.gv.at/node:22-alpine

WORKDIR /app

RUN npm install -g serve

COPY dist ./dist

EXPOSE 3000

CMD ["serve", "dist", "-p", "3000"]
