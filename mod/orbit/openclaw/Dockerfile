FROM node:22-bookworm

# system deps
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv curl git jq \
    && rm -rf /var/lib/apt/lists/*

# pm2 + openclaw
RUN npm install -g pm2 openclaw@latest

# pre-run onboard in non-interactive mode
RUN openclaw onboard --install-daemon --non-interactive || true

# python deps (system-wide, no venv needed in container)
RUN pip3 install --break-system-packages \
    fastapi uvicorn[standard] pydantic

# gateway log dir
RUN mkdir -p /var/log

WORKDIR /root/mod/mod/orbit/openclaw

# install app deps (cached layer)
COPY app/package.json app/package-lock.json* app/
RUN cd app && npm install

# copy the rest
COPY . .

# build the next.js app
RUN cd app && npm run build

EXPOSE 18789 50120 3120

# pm2 manages all processes
CMD ["pm2-runtime", "ecosystem.config.js"]
