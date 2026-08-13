// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// jsPDF's package.json exports map has a "node" condition that points to an
// AMD-based bundle (jspdf.node.min.js). Metro's SSR static-render phase runs
// in Node.js without a "web" platform flag, so it resolves the "node"
// condition and then fails to transform the AMD require(["html2canvas"]) call.
// Override resolution for jspdf so it always uses the browser UMD bundle,
// which Metro can transform correctly in all contexts.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jspdf') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'node_modules/jspdf/dist/jspdf.es.min.js'),
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
