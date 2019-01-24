FROM node:9.11-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install

COPY ./src /usr/src/app/src
RUN npm run build

ENV NODE_ENV production

EXPOSE 6500

CMD ["npm", "run", "start"]
