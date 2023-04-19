const path = require('path')

export default {
  base: '/coffee-shop/',
  build: {
    outDir: '../dist/',
    emptyOutDir: true
  },
  server: {
    port: 8080,
    hot: true
  }
}
