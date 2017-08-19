const childProcess = require('child_process')
const Dashboard = require('zzzxxxyyy')
const http = require('http')
const path = require('path')
const util = require('util')
const processes = {}
let processPort = 3001

module.exports = {
  get: renderPage,
  post: renderPage
}

async function renderPage (req, res) {
  console.log('pgweb#' + req.method, req.url, req.bodyRaw)
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
    const pgwebPath = path.join(`${__dirname}/..`, 'pgweb_darwin_amd64')
    pgweb = processes[req.query.bookmarkid] = childProcess.execFile(pgwebPath, launchParams)
    // let it start
    console.log('start and wait')
    req.data = {pgweb, bookmark}
    return setTimeout(() => {
      req.url = '/'
      return proxyRequest(req, res)
    }, 2000)
  }
  req.data = {pgweb, bookmark}
  return proxyRequest(req, res)
}

function proxyRequest (req, res) {
  console.log(req.url, req.method, req.body)
  // proxy the pgweb instance
  const port = req.data.pgweb.spawnargs[req.data.pgweb.spawnargs.length - 1]
  // GET requests
  if (!req.bodyRaw) {
    const getOptions = {
      host: 'localhost',
      port: port,
      method: 'GET',
      path: req.urlPath === '/pgweb' ? '/' : req.url
    }
    const getRequest = http.request(getOptions, (getResponse) => {
      let chunks = ''
      getResponse.on('data', (chunk) => {
        chunks += chunk
      })
      getResponse.on('end', () => {
        if (getRequest.path.indexOf('/api/') > -1) {
          res.setHeader('content-type', 'application/json')
          res.statusCode = getRequest.statusCode || 200
          return res.end(chunks)
        }
        console.log('serving html', req.url, req.route)
        const doc = Dashboard.HTML.parse(req.route.pageHTML)
        doc.renderTemplate(req.data.bookmark, 'navbar-html-template', 'navbar-template')
        preSelectPageContent(req, doc)
        return Dashboard.Response.end(req, res, doc)
      })
    })
    getRequest.on('error', () => {
      res.statusCode = 500
      res.end()
    })
    return getRequest.end()
  }
  // POST requests
  const postBody = req.bodyRaw
  const postOptions = {
    host: 'localhost',
    port: port,
    path: req.urlPath === '/pgweb' ? '/' : req.url,
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'referer': `http://localhost:${port}/pgweb/`,
      'content-length': postBody.length
    }
  }
  const postRequest = http.request(postOptions, (postResponse) => {
    let chunks = ''
    postResponse.on('data', (chunk) => {
      chunks += chunk
    })
    return postResponse.on('end', () => {
      if (postRequest.path.indexOf('/api/') > -1) {
        res.setHeader('content-type', 'application/json')
        res.statusCode = postResponse.statusCode || 200
        return res.end(chunks)
      } else {
        const doc = Dashboard.HTML.parse(chunks)
        preSelectPageContent(req, doc)
        return Dashboard.Response.end(req, res, doc)
      }
    })
  })
  postRequest.write(postBody)
  return postRequest.end()
}

function loadBookmark (userid, bookmarkid, callback) {
  return Dashboard.Redis.hgetall(`bookmark:${bookmarkid}`, (_, bookmark) => {
    if (!bookmark || bookmark.userid !== userid) {
      return callback()
    }
    return callback(null, bookmark)
  })
}

function preSelectPageContent (req, doc) {
  switch (req.urlPath) {
    case '/pgweb':
    case '/pgweb/query':
      return
    case '/pgweb/rows':
    case '/pgweb/structures':
    case '/pgweb/indexes':
    case '/pgweb/constraints':
    case '/pgweb/history':
    case '/pgweb/activity':
    case 'pgweb/connection':
      const input = doc.getElementById('input')
      input.attr = input.attr || {}
      input.attr.style = 'display: none'
  }
}