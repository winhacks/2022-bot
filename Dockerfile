FROM node:16

WORKDIR /app

# Dependency layer
COPY ./package.json package.json
COPY ./yarn.lock yarn.lock
RUN yarn install

# Build layer
COPY ./src src
COPY ./tsconfig.json tsconfig.json
RUN yarn build

# Config layer
COPY ./config.json5 config.json5

# Execution layer
CMD yarn host
