const Dashboard = require('zzzxxxyyy')
const Home = require('./home.js')
const util = require('util')

module.exports = {
  get: renderPage,
  post: submitForm
}

async function renderPage (req, res, messageTemplate) {
  console.log('render delete bookmarks')
  const doc = Dashboard.HTML.parse(req.route.pageHTML, __dirname)
  const bookmarks = await Home.listBookmarks(req.userid)
  if (messageTemplate) {
    doc.renderTemplate(null, messageTemplate, 'status-container')
  }
  console.log(bookmarks)
  if (bookmarks && bookmarks.length) {
    doc.renderList(bookmarks, 'bookmark-item-template', 'bookmarks-list')
  }
  return Dashboard.Response.end(req, res, doc)
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
  return Dashboard.Redis.del(`bookmark:${bookmarkid}`, () => {
    return Dashboard.Redis.lrem(`bookmarks:${userid}`, 0, bookmarkid, () => {
      return callback()
    })
  })
}
