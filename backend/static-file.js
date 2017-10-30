const Config = require('../core/config.js')
const fs = require('fs')
const path = require('path')
const Proxy = require('../core/proxy.js')
const Response = require('../core/response.js')
const fileCache = {}

module.exports = {get}

function get (req, res) {
  if (!req.urlPath.indexOf('/public/') === 0) {
    throw new Error('Invalid file')
  }
  const blob = loadFile(req.urlPath)
  if (blob) {
    return Response.end(req, res, null, blob)
  }
  if (process.env.SERVER_ADDRESS) {
    return Proxy.pass(req, res)
  }
  return Response.throw404(req, res)
}

function loadFile (urlPath) {
  const unwound = Config.unwindPath(urlPath)
  if (!unwound) {
    return
  }
  const filePath = path.join(Config.getRoot(), unwound)
  if (!fs.existsSync(filePath)) {
    return
  }
  const stat = fs.statSync(filePath)
  if (stat.isDirectory()) {
    return
  }
  const blob = fileCache[filePath] = fileCache[filePath] || fs.readFileSync(filePath)
  return blob
}
