import {protocol} from 'electron'
import http from 'http'
import through2 from 'through2'
import bs58 from 'bs58'
import {ProtocolSetupError} from 'beaker-error-constants'
import multibase from 'multibase'

var ipfsDaemonHttpPort = 8080
const IPFS_NURI_REGEX = /\/ipfs\/([^\/"]*)/g

// exported api
// =

export function setup () {
  // setup the protocol handler
  protocol.registerStreamProtocol('ipfs', ipfsProtocol, err => {
    if (err) throw ProtocolSetupError(err, 'Failed to create protocol: ipfs')
  })
}

async function ipfsProtocol (request, respond) {
  http.get({
    port: ipfsDaemonHttpPort,
    path: '/ipfs/' + request.url.slice('ipfs://'.length),
    headers: request.headers
  }, (res) => {
    var resStream = res
    if (res.headers['content-type'].indexOf('text/html') !== -1) {
      // HTML response
      res.setEncoding('utf8')
      resStream = res.pipe(through2((chunk, enc, cb) => {
        if (enc === 'buffer') {
          chunk = chunk.toString('utf8')
          enc = 'utf8'
        }
        if (enc === 'utf8')  {
          // convert base58 NURIs to base32 ipfs:// urls
          chunk = chunk.replace(IPFS_NURI_REGEX, (match, group1) => {
            try {
              return `ipfs://${multibase.encode('base32', bs58.decode(group1))}`
            } catch (e) {
              return `ipfs://${group1}`
            }
          })
        }
        cb(null, chunk)
      }))
    }

    respond({
      statusCode: res.statusCode,
      headers: res.headers,
      data: resStream
    })
  })
}