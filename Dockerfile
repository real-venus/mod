FROM python:3.12-slim
ARG DEBIAN_FRONTEND=noninteractive

# All system deps in one layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl build-essential nodejs npm \
    && npm install -g pm2 \
    && curl https://sh.rustup.rs -sSf | sh -s -- -y \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.cargo/bin:$PATH"

# Upgrade pip
RUN pip install --upgrade pip setuptools wheel

WORKDIR /root/mod
COPY . .

# Install mod
RUN pip install -e ./

CMD ["bash", "scripts/start.sh"]
