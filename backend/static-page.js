module.exports = {
  get: renderPage
}

function renderPage (req, res) {
  res.setHeader('content-type', 'text/html')
  return res.end(req.route.pageHTML)
}
