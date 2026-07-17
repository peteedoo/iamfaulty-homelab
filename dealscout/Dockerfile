FROM python:3.12-alpine

WORKDIR /app
COPY server.py mock_data.json ./
COPY static ./static

ENV DEALSCOUT_CACHE_DIR=/data
VOLUME /data
EXPOSE 8420

CMD ["python", "server.py"]
