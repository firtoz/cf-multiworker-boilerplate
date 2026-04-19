#!/usr/bin/env bun
/**
 * Run before `turbo` for `bun run deploy` / `deploy:execute` so missing `.env.production`
 * fails immediately with a clear message (instead of a deep Turbo / Wrangler error).
 */
import { checkProdDeployPrereqs } from "./load-env-production";

checkProdDeployPrereqs();
