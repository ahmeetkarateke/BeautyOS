FROM node:20-bullseye-slim

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/api/package.json ./
RUN npm install

COPY apps/api/ ./

RUN npm run build

EXPOSE 3001
CMD ["node", "dist/index.js"]
