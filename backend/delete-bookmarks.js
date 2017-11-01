const Home = require('./home.js')
const HTML = require('server-html')
const Redis = require('../redis.js')
const util = require('util')

module.exports = {
  get: renderPage,
  post: submitForm
}

async function renderPage (req, res, messageTemplate) {
  const doc = HTML.parse(req.route.pageHTML, __dirname)
  doc.getElementById('base-tag').setAttribute('href', process.env.SERVER_ADDRESS)  
  const bookmarks = await Home.listBookmarks(req.userid)
  if (messageTemplate) {
    doc.renderTemplate(null, messageTemplate, 'status-container')
  }
  if (bookmarks && bookmarks.length) {
    doc.renderList(bookmarks, 'bookmark-item-template', 'bookmarks-list')
  }
  res.setHeader('content-type', 'text/html')
  return res.end(doc.toString())
}

async function submitForm (req, res) {
  if (!req.body || req.body.confirm !== 'true') {
    return renderPage(req, res)
  }
  let deleted = 0
  const bookmarks = await Home.listBookmarks(req.userid)
  const deleteAsync = util.promisify(deleteBookmark)
  for (const bookmark of bookmarks) {
    if (req.body[`bookmark${bookmark.bookmarkid}`] !== 'true') {
      continue
    }
    await deleteAsync(req.userid, bookmark.bookmarkid)
    deleted++
  }
  if (!deleted) {
    return renderPage(req, res, 'no-selected-error-template')
  }
  return renderPage(req, res, 'submit-success-template')
}

function deleteBookmark (userid, bookmarkid, callback) {
  return Redis.del(`bookmark:${bookmarkid}`, () => {
    return Redis.lrem(`bookmarks:${userid}`, 0, bookmarkid, () => {
      return callback()
    })
  })
}
