FROM node:lts-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN npm prune --production

EXPOSE 3000

CMD ["npm", "start"]