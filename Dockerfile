FROM node:9.11-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN yarn

COPY ./src /usr/src/app/src
RUN yarn build

RUN yarn --production
ENV NODE_ENV production

EXPOSE 6500

CMD ["yarn", "start"]
