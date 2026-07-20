const path = require('path');

module.exports = {
  baseURL: 'https://nickderobertis.com',
  outputDirectory: path.join(__dirname, 'reference', 'screenshots'),
  navigationTimeout: 45_000,
  settleTimeout: 30_000,
  viewports: {
    mobile: { width: 375, height: 812 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1440, height: 1000 },
  },
};
