FROM node:24-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN npm install -g pnpm && pnpm ci

COPY . .

EXPOSE 3000

CMD ["pnpm", "dev"]
