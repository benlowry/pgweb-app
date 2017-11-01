const fs = require('fs')
const path = require('path')
const fileCache = {}
const mimeTypes = {
  js: 'text/javascript',
  css: 'text/css',
  txt: 'text/plain',
  html: 'text/html',
  jpg: 'image/jpeg',
  png: 'image/png',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  eot: 'application/vnd.ms-fontobject',
  ttf: 'application/font-sfnt',
  woff: 'application/font-woff',
  otf: 'application/x-font-opentype'
}

module.exports = {get}

function get (req, res) {
  if (!req.urlPath.startsWith('/public/')) {
    throw new Error('Invalid file')
  }
  const filePath = path.join(__dirname, '..') + req.urlPath
  const cached = fileCache[filePath]
  if (cached) {
    res.setHeader('content-type', mimeTypes[req.extension])
    res.setHeader('content-length', cached.length)
    return res.end(cached, 'binary')
  }
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404
    return res.end()
  }
  const stat = fs.statSync(filePath)
  if (stat.isDirectory()) {
    res.statusCode = 404
    return res.end()
  }
  const blob = fileCache[filePath] = fs.readFileSync(filePath)
  res.setHeader('content-type', mimeTypes[req.extension])
  res.setHeader('content-length', blob.length)
  return res.end(blob, 'binary')
}
