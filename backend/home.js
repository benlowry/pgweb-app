const HTML = require('server-html')
const Redis = require('../core/redis.js')
const util = require('util')
const characters = process.env.UUID_ENCODING_CHARACTERS
const charactersLength = characters.length

module.exports = {
  get: renderPage,
  post: submitForm,
  listBookmarks,
  loadBookmark,
  deleteStaleBookmark
}

async function renderPage (req, res, messageTemplate) {
  const sessionHTML = req.route.pageHTML.replace('$' + '{sessionid}', req.sessionid)
  const doc = HTML.parse(sessionHTML, __dirname)
  if (messageTemplate) {
    doc.renderTemplate(null, messageTemplate, 'status-container')
  }
  const bookmarks = await listBookmarks(req.userid)
  if (bookmarks && bookmarks.length) {
    doc.renderList(bookmarks, 'bookmark-item-template', 'bookmarks-list')
    doc.removeElementById('no-bookmarks')
  } else {
    doc.removeElementsById(['delete-bookmarks', 'create-title'])
    const createForms = doc.getElementById('create-forms')
    createForms.classList.add('no-bookmarks')
  }
  doc.getElementById('base-tag').setAttribute('href', process.env.SERVER_ADDRESS)
  res.setHeader('content-type', 'text/html')
  return res.end(doc.toString())
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
  const uuidAsync = util.promisify(generateUnique)
  bookmark.bookmarkid = await uuidAsync()
  const lpushAsync = util.promisify(Redis.lpush)
  await lpushAsync(`bookmarks:${req.userid}`, bookmark.bookmarkid)
  const hsetAsync = util.promisify(Redis.hset)
  for (const property in bookmark) {
    if (bookmark[property]) {
      await hsetAsync(`bookmark:${bookmark.bookmarkid}`, property, bookmark[property])
    }
  }
  const timestamp = new Date().getTime() / 1000
  await hsetAsync(`bookmark:${bookmark.bookmarkid}`, 'created', timestamp)
  res.statusCode = 303
  res.setHeader('location', `/pgweb?bookmarkid=${bookmark.bookmarkid}`)
  return res.end()
}

async function listBookmarks (userid) {
  const lrangeAsync = util.promisify(Redis.lrange)
  const deleteStaleAsync = util.promisify(deleteStaleBookmark)
  const loadBookmarkAsync = util.promisify(loadBookmark)
  const bookmarkids = await lrangeAsync(`bookmarks:${userid}`, 0, -1)
  const bookmarks = []
  for (const bookmarkid of bookmarkids) {
    const bookmark = await loadBookmarkAsync(userid, bookmarkid)
    if (!bookmark) {
      await deleteStaleAsync(`bookmarks:${userid}`, bookmarkid)
    } else {
      bookmarks.push(bookmark)
    }
  }
  return bookmarks
}

function loadBookmark (userid, bookmarkid, callback) {
  return Redis.hgetall(`bookmark:${bookmarkid}`, (_, bookmark) => {
    if (!bookmark) {
      return callback()
    }
    if (bookmark.userid !== userid) {
      return callback(new Error())
    }
    return callback(null, bookmark)
  })
}

function deleteStaleBookmark (userid, bookmarkid, callback) {
  return Redis.lrem(`bookmarks:${userid}`, 0, bookmarkid, () => {
    return callback()
  })
}

function generateUnique (callback) {
  return Redis.incrby(`bookmarkid`, 1, (_, number) => {
    let encoded = ''
    let num = number
    while (num) {
      const remainder = num % charactersLength
      num = Math.floor(num / charactersLength)
      encoded = characters[remainder].toString() + encoded
    }
    return callback(null, encoded)
  })
}
