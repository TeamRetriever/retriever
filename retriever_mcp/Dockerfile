# syntax=docker/dockerfile:1

FROM node:lts-alpine
WORKDIR /
COPY . .
RUN npm install
RUN npm run build
CMD ["npm", "start"]
EXPOSE 3000