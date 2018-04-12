import {protocol} from 'electron'
import {parse as parseURL} from 'url'
import http from 'http'
import {ProtocolSetupError} from 'beaker-error-constants'
import multibase from 'multibase'

// exported api
// =

export function setup () {
  var ipfsDaemonHttpPort = 8080

  // setup the protocol handler
  protocol.registerHttpProtocol('ipfs',
    (request, cb) => {
      var urlp = parseURL(request.url)
      try {
        var hostname = multibase.encode('base58btc', multibase.decode(urlp.hostname))
        hostname = hostname.slice(1) // remove the multibase encoding char
      } catch (e) {
        hostname = urlp.hostname
      }
      var url = 'http://localhost:' + ipfsDaemonHttpPort + '/ipfs/' + hostname + urlp.pathname
      cb({method: request.method, url})
    }, err => {
      if (err) throw ProtocolSetupError(err, 'Failed to create protocol: ipfs')
    }
  )
}
