#!/usr/bin/env node
import { messageForRetry } from './menhera-ui.mjs';

const retryCount = Number(process.env.MENHERA_LOOP_RETRY_COUNT || 0);
console.log(messageForRetry(retryCount));
