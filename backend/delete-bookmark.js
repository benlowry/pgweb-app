const Dashboard = require('zzzxxxyyy')

module.exports = {
  get: renderPage
}

function renderPage (req, res) {
  const doc = Dashboard.HTML.parse(req.route.pageHTML, __dirname)
  return Dashboard.Response.end(req, res, doc)
}
