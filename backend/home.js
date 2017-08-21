const Dashboard = require('zzzxxxyyy')
const Pgweb = require('./pgweb.js')
const util = require('util')

module.exports = {
  get: renderPage,
  post: submitForm
}

async function renderPage (req, res, messageTemplate) {
  const sessionHTML = req.route.pageHTML.replace('$' + '{sessionid}', req.sessionid)
  const doc = Dashboard.HTML.parse(sessionHTML, __dirname)
  if (messageTemplate) {
    doc.renderTemplate(null, messageTemplate, 'status-container')
  }
  const bookmarks = await listBookmarks(req.userid)
  if (bookmarks && bookmarks.length) {
    doc.renderList(bookmarks, 'bookmark-item-template', 'bookmarks-list')
  }
  return Dashboard.Response.end(req, res, doc)
}

async function submitForm (req, res) {
  if (!req.body || req.body.confirm !== 'true') {
    return renderPage(req, res)
  }
  const bookmark = {}
  switch (req.body.form) {
    case 'scheme':
      bookmark.url = req.body.url
      break
    case 'standard':
      bookmark.host = req.body.host
      bookmark.username = req.body.username
      bookmark.password = req.body.password
      bookmark.database = req.body.database
      bookmark.port = req.body.port
      bookmark.ssl = req.body.ssl
      break
    case 'ssh':
      bookmark.host = req.body.host
      bookmark.username = req.body.username
      bookmark.password = req.body.password
      bookmark.database = req.body.database
      bookmark.port = req.body.port
      bookmark.ssl = req.body.ssl
      bookmark.ssh_host = req.body.ssh_host
      bookmark.ssh_username = req.body.ssh_username
      bookmark.ssh_password = req.body.ssh_password
      bookmark.ssh_port = req.body.ssh_port
      break
  }
  for (const property in bookmark) {
    if (!bookmark[property]) {
      return renderPage(req, res, `missing-${property}-error-template`)
    }
  }
  if (!req.body.name) {
    return renderPage(req, res, 'missing-bookmark-name-error-template')
  }
  bookmark.name = req.body.name
  bookmark.userid = req.userid
  const uuidAsync = util.promisify(Dashboard.UUID.generateUnique)
  bookmark.bookmarkid = await uuidAsync()
  const lpushAsync = util.promisify(Dashboard.Redis.lpush)
  await lpushAsync(`bookmarks:${req.userid}`, bookmark.bookmarkid)
  const hsetAsync = util.promisify(Dashboard.Redis.hset)
  for (const property in bookmark) {
    if (bookmark[property]) {
      await hsetAsync(`bookmark:${bookmark.bookmarkid}`, property, bookmark[property])
    }
  }
  await hsetAsync(`bookmark:${bookmark.bookmarkid}`, 'created', Dashboard.Timestamp.now)
  res.statusCode = 303
  res.setHeader('location', `/pgweb?bookmarkid=${bookmark.bookmarkid}`)
  return res.end()
}

async function listBookmarks (userid) {
  const lrangeAsync = util.promisify(Dashboard.Redis.lrange)
  const deleteBookmarkAsync = util.promisify(deleteBookmark)
  const loadBookmarkAsync = util.promisify(loadBookmark)
  const bookmarkids = await lrangeAsync(`bookmarks:${userid}`, 0, -1)
  const bookmarks = []
  for (const bookmarkid of bookmarkids) {
    console.log('bookmarkid', bookmarkid)
    const bookmark = await loadBookmarkAsync(userid, bookmarkid)
    if (!bookmark) {
      await deleteBookmarkAsync(`bookmarks:${userid}`, bookmarkid)
    } else {
      bookmarks.push(bookmark)
    }
  }
  return bookmarks
}

function loadBookmark (userid, bookmarkid, callback) {
  return Dashboard.Redis.hgetall(`bookmark:${bookmarkid}`, (_, bookmark) => {
    if (!bookmark) {
      return callback()
    }
    if (bookmark.userid !== userid) {
      return callback(new Error())
    }
    return callback(null, bookmark)
  })
}

function deleteBookmark (userid, bookmarkid, callback) {
  return Dashboard.Redis.lrem(`bookmarks:${userid}`, 0, bookmarkid, () => {
    return callback()
  })
}
