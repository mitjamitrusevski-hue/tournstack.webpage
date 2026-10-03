FROM node:24-bookworm-slim
WORKDIR /app/mailbox-smtp
# Build with the integrations directory as the context to include shared templates.
COPY mailbox-smtp/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && mkdir /data && chown node:node /data
COPY --chown=node:node mailbox-smtp/server.mjs mailbox-smtp/relay.mjs mailbox-smtp/messages.mjs ./
COPY --chown=node:node email /app/email
USER node
ENV HOST=0.0.0.0 PORT=3010 QUEUE_PATH=/data/mail.sqlite
EXPOSE 3010
CMD ["node", "server.mjs"]
