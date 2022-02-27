# node with version 16.13 on debian bullseye
FROM node:16-bullseye

# Chromium Dependencies
RUN apt-get update \
    ; apt-get install -y wget gnupg \
    ; wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    ; sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    ; apt-get update \
    ; apt-get install -y google-chrome-stable fonts-freefont-ttf libxss1 --no-install-recommends \
    ; rm -rf /var/lib/apt/lists/*


# add typescript node
RUN yarn global add ts-node

# make WORKDIR for app
RUN mkdir -p /app
WORKDIR /app

COPY package.json /app
COPY yarn.lock /app
RUN yarn install

COPY . /app

CMD ["yarn", "start"]
