const HTML = require('../core/html.js')
const Response = require('../core/response.js')

module.exports = {
  get: renderPage
}

function renderPage (req, res) {
  return Response.end(req, res, HTML.parse(req.route.pageHTML, __dirname))
}
