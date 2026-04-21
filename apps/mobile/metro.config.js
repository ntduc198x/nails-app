/* eslint-disable @typescript-eslint/no-require-imports */
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// In restricted Windows environments Metro worker child-processes can fail to spawn.
// Running with a single worker keeps transforms in-process and unblocks local AVD verification.
config.maxWorkers = 1;

module.exports = config;
