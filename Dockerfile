FROM node:24-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/api/package*.json ./
RUN npm install

COPY apps/api/ ./

RUN npm run build

EXPOSE 3001
CMD ["node", "dist/index.js"]
