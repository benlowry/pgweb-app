const childProcess = require('child_process')
childProcess.execSync('./pgweb_darwin_amd64 --listen 21664 --skip-open', (error) => {
  if (error) {
    throw error
  }
})
