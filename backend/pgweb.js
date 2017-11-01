const childProcess = require('child_process')
const HTML = require('server-html')
const http = require('http')
const path = require('path')
const Redis = require('../redis.js')
const util = require('util')
const processes = {}
const processList = []
let processPort = 3001
setInterval(killIdleProcesses, 60)

module.exports = {
  get: renderPage,
  post: renderPage
}

function killIdleProcesses () {
  const timestamp = new Date().getTime() / 1000
  for (const pgweb of processList) {
    if (timestamp - pgweb.lastRequest > 240) {
      pgweb.kill()
      processList.splice(processList.indexOf(pgweb), 1)
      delete (processes[pgweb.bookmarkid])
    }
  }
}

async function renderPage (req, res) {
  if (!req.query || !req.query.bookmarkid) {
    res.statusCode = 500
    return res.end()
  }
  // check user has a pgweb instance
  let pgweb = processes[req.query.bookmarkid]
  const loadBookmarkAsync = util.promisify(loadBookmark)
  const bookmark = await loadBookmarkAsync(req.userid, req.query.bookmarkid)
  if (!pgweb) {
    const launchParams = ['--skip-open', '--lock-session']
    for (const property in bookmark) {
      if (property === 'bookmarkid' || property === 'name' || property === 'userid' ||
          property === 'created' || property === 'deleted') {
        continue
      }
      launchParams.push(`--${property}`, bookmark[property])
    }
    launchParams.push('--listen', processPort++)
    const pgwebPath = path.join(`${__dirname}/..`, process.env.PGWEB_EXECUTABLE || 'pgweb_darwin_amd64')
    pgweb = processes[req.query.bookmarkid] = childProcess.execFile(pgwebPath, launchParams)
    pgweb.bookmarkid = req.query.bookmarkid
    processList.push(pgweb)
    // let it start
    req.data = {pgweb, bookmark}
    return setTimeout(() => {
      req.url = '/'
      const port = pgweb.spawnargs[pgweb.spawnargs.length - 1]
      return passRequest(req, res, port)
    }, 2000)
  }
  req.data = {pgweb, bookmark}
  const port = req.data.pgweb.spawnargs[req.data.pgweb.spawnargs.length - 1]
  if (req.url.startsWith('/pgweb/')) {
    req.url = '/?' + req.url.split('?')[1]
  }
  pgweb.lastRequest = new Date().getTime() / 1000
  return passRequest(req, res, port)
}

function loadBookmark (userid, bookmarkid, callback) {
  return Redis.hgetall(`bookmark:${bookmarkid}`, (_, bookmark) => {
    if (!bookmark || bookmark.userid !== userid) {
      return callback()
    }
    return callback(null, bookmark)
  })
}

function preSelectPageContent (req, doc) {
  switch (req.urlPath) {
    case '/pgweb/rows':
    case '/pgweb/structures':
    case '/pgweb/indexes':
    case '/pgweb/constraints':
    case '/pgweb/history':
    case '/pgweb/activity':
    case '/pgweb/connection':
      const input = doc.getElementById('input')
      input.attr = input.attr || {}
      input.attr.style = 'display: none'
  }
}

function passRequest (req, res, port) {
  const requestOptions = {
    host: 'localhost',
    port: port,
    path: req.url,
    method: req.method,
    headers: {
      'x-sessionid': req.sessionid
    }
  }
  for (const header in req.headers) {
    requestOptions.headers[header] = req.headers[header]
  }
  if (requestOptions.method === 'post' && req.bodyRaw) {
    requestOptions.headers['content-length'] = req.bodyRaw.length
    requestOptions.headers['content-type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
  }
  const proxyRequest = http.request(requestOptions)
  proxyRequest.addListener('response', (proxyResponse) => {
    const chunks = []
    proxyResponse.addListener('data', (chunk) => {
      chunks.push(chunk)
    })
    return proxyResponse.addListener('end', () => {
      if (proxyResponse.statusCode === 404) {
        res.statusCode = 404
        return res.end()
      }
      res.statusCode = proxyResponse.statusCode
      res.headers = proxyResponse.headers
      if (proxyResponse.statusCode === 200) {
        const contentType = proxyResponse.headers['content-type'] || 'text/html'
        if (contentType.split(';')[0] === 'text/html') {
          // note: discarding pgweb's output due to modifications
          const doc = HTML.parse(req.route.pageHTML)
          doc.renderTemplate(req.data.bookmark, 'navbar-html-template', 'navbar-template')
          preSelectPageContent(req, doc)
          doc.getElementById('base-tag').setAttribute('href', process.env.SERVER_ADDRESS)
          res.setHeader('content-type', 'text/html')
          return res.end(doc.toString())
        }
      }
      if (chunks && chunks.length) {
        if (requestOptions.path.indexOf('/api/') > -1) {
          res.setHeader('content-type', 'application/json')
        }
        return res.end(Buffer.concat(chunks))
      }
      return res.end()
    })
  })
  proxyRequest.on('error', () => {
    res.statusCode = 500
    return res.end()
  })
  if (req.bodyRaw) {
    proxyRequest.write(req.bodyRaw)
  }
  return proxyRequest.end()
}

