FROM node:24-slim

WORKDIR /app

COPY apps/api/package*.json ./
RUN npm ci

COPY apps/api/ ./

RUN npm run build

EXPOSE 3001
CMD ["node", "dist/index.js"]
