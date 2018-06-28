var dwsd = require('./')
var http = require('http')

var request = function (opts) {
  var dwsdReq = http.request(opts)
  var combineDwSd = dwsd()
  combineDwSd.setDwWritable(dwsdReq)
  dwsdReq.on('response', function (dwsdReq) {
    combineDwSd.setDwReadable(dwsdReq)
  })
  return combineDwSd
}

var dwsdReq = request({
  method: 'GET',
  host: 'www.bitshares.com',
  port: 80
})

dwsdReq.end()
dwsdReq.pipe(process.stdout)
