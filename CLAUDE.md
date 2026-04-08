# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An AWS CDK construct (npm package `@soliantconsulting/zoom-log-error-notifications`) that monitors CloudWatch Log Groups for error/fatal log entries and sends notifications to Zoom via Incoming Webhooks. Logs must be NDJSON format with a `level` property.

## Commands

- **Build**: `pnpm build` — runs `tsc` for the CDK construct, then bundles the Lambda handler via esbuild
- **Lint/Format**: `pnpm check` — runs Biome check with auto-fix (lint + format + import sorting)
- **Format only**: `pnpm format` — runs Biome format with auto-fix

There are no tests in this project.

## Architecture

The package exports a single CDK construct (`ZoomLogErrorNotifications`) and a bundled Lambda handler:

- **`src/resource.ts`** — CDK construct that creates: a CloudWatch Logs query definition, a Lambda function, and subscription filters on log groups. This is the public API of the package. The `addLogGroup()` method allows attaching multiple log groups.
- **`src/handler.ts`** — Lambda function code, bundled separately via esbuild (`build-handler.sh`) into `dist/handler/index.mjs`. It decodes CloudWatch log events, applies a report throttle, and sends formatted messages to Zoom's webhook API. This file is excluded from the TypeScript library build and bundled as a standalone asset.
- **`src/index.ts`** — barrel export of `resource.ts`.

The build produces two distinct outputs: the CDK construct library (`dist/*.js` + `dist/*.d.ts` via tsc) and the Lambda handler bundle (`dist/handler/index.mjs` via esbuild).

## Code Style

- Biome handles linting and formatting (4-space indent, 100 char line width)
- `console.log` is banned (`noConsoleLog` rule) — use `console.error` for error output in the handler
- Conventional commits enforced via commitlint (`@commitlint/config-conventional`)
- Lefthook pre-commit hook runs `biome check` on staged files
- Semantic-release handles versioning from the `main` branch
