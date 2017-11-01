const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const qs = require('querystring')
const StaticFile = require('./backend/static-file.js')
const StaticPage = require('./backend/static-page.js')
const url = require('url')
const util = require('util')

const port = process.env.PORT || 3000
http.createServer(receiveRequest).listen(port)

const appjson = fs.readFileSync(`${__dirname}/app.json`).toString('utf-8').split('${SERVER_ADDRESS}').join(process.env.SERVER_ADDRESS)

async function receiveRequest (req, res) {
  res.statusCode = 200
  req.query = url.parse(req.url, true).query
  req.urlPath = req.url.split('?')[0]
  if (req.urlPath === '/app.json') {
    res.setHeader('content-type', 'application/json')
    return res.end(appjson)
  }
  req.extension = req.urlPath.indexOf('.') > -1 ? req.urlPath.split('.').pop().toLowerCase() : null
  if (req.urlPath.startsWith('/public/')) {
    return StaticFile.get(req, res)
  }
  req.route = matchRoute(req.urlPath)
  console.log('route', req.route)
  if (!req.route) {
    res.statusCode = 404
    return res.end()
  }
  if (req.headers && req.headers.userid && req.headers.sessionid) {
    try {
      const validate = util.promisify(validateUserSession)
      await validate(req)
      req.userid = req.headers.userid
      req.sessionid = req.headers.sessionid
    } catch (error) {
      res.statusCode = 511
      return res.end()
    }
  }
  return handleRequest(req, res)
}

function parsePostData (req, res, callback) {
  const contentType = req.headers['content-type']
  if (contentType && contentType.indexOf('multipart/form-data') > -1) {
    return callback()
  }
  const bodyParts = []
  req.on('data', (data) => {
    bodyParts.push(data)
  })
  return req.on('end', () => {
    const body = Buffer.concat(bodyParts).toString('utf-8')
    req.body = qs.parse(body)
    req.bodyRaw = body
    return callback()
  })
}

async function handleRequest (req, res) {
  if (!req.route) {
    res.statusCode = 404
    return res.end()
  }
  const methodHandler = req.route.api ? req.route.api[req.method.toLowerCase()] : null
  if (!methodHandler) {
    res.statusCode = 500
    return res.end()
  }
  if (req.method === 'POST') {
    const parsePostDataAsync = util.promisify(parsePostData)
    await parsePostDataAsync(req, res)
  }
  if (req.route.pageHTML) {
    res.setHeader('content-type', 'text/html')
  }
  if (req.route.api.before) {
    try {
      await req.route.api.before(req)
    } catch (error) {
      res.statusCode = 500
      return res.end()
    }
  }
  try {
    methodHandler(req, res)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      throw error
    }
    res.statusCode = 500
    return res.end()
  }
}

function validateUserSession (req, callback) {
  if (!req.headers || !req.headers.userid || !req.headers.sessionid) {
    return callback(new Error())
  }
  const target = `${process.env.FRONT_ADDRESS}/api/verify-session?userid=${req.headers.userid}&sessionid=${req.headers.sessionid}`
  const urlInfo = url.parse(target)
  const getOptions = {
    host: urlInfo.host.split(':')[0],
    port: urlInfo.port,
    path: urlInfo.path,
    query: urlInfo.query,
    method: 'HEAD'
  }
  const protocol = target.startsWith('https') ? https : http
  const getRequest = protocol.request(getOptions, (getResponse) => {
    getResponse.on('data', (chunk) => {})
    return getResponse.on('end', () => {
      if (getResponse.statusCode === 200) {
        return callback()
      }
      return callback(new Error())
    })
  })
  return getRequest.end()
}

function matchRoute (urlPath) {
  const fullPath = path.join(`${__dirname}/backend`, urlPath)
  console.log('fullPath', fullPath)
  const htmlFile = `${fullPath}.html`
  const htmlExists = fs.existsSync(htmlFile)
  console.log('htmlFile', htmlExists, htmlFile)
  const jsFile = `${fullPath}.js`
  const jsExists = fs.existsSync(jsFile)
  console.log('jsFile', jsExists, jsFile)
  const route = {}
  if (htmlExists) {
    route.pageHTML = fs.readFileSync(htmlFile).toString('utf-8')
  }
  if (jsExists) {
    route.api = require(jsFile)
  } else if (htmlExists) {
    route.api = StaticPage
  }
  if (route.api) {
    return route
  }
  return null
}
