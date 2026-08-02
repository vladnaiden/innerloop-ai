FROM node:22-bookworm

# General-purpose tooling; trim or extend for your project.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    zsh \
    less \
    procps \
    sudo \
    curl \
    ripgrep \
    jq \
    python3 \
    util-linux \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Passwordless sudo so post-create can fix volume ownership if needed.
RUN echo "node ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node

RUN npm install -g @anthropic-ai/claude-code

# Pre-create mount points owned by node — fresh named volumes copy the
# ownership of the image directory they mount over.
RUN mkdir -p /home/node/.claude /commandhistory \
    && touch /commandhistory/.bash_history \
    && chown -R node:node /home/node/.claude /commandhistory

USER node

# Append-on-every-prompt so history survives abrupt container shutdown.
RUN echo 'export PROMPT_COMMAND="history -a"' >> /home/node/.bashrc \
    && echo 'alias yolo="claude --dangerously-skip-permissions"' >> /home/node/.bashrc
