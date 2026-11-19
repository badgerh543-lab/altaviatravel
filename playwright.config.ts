import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',fullyParallel:false,workers:1,timeout:60000,retries:0,use:{baseURL:process.env.REVIEW_BASE_URL||'http://localhost:4321',channel:'msedge',headless:true,trace:'retain-on-failure',screenshot:'only-on-failure'},reporter:[['list'],['json',{outputFile:'docs/test-results.json'}]]});
