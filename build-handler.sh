#!/usr/bin/env bash

pnpm ./node_modules/esbuild/bin/esbuild src/handler.ts \
  --bundle \
  --minify \
  --platform=node \
  --target=es2022 \
  --format=esm \
  --external:@aws-sdk/* \
  --outfile=dist/handler/index.mjs \
  --sourcemap
