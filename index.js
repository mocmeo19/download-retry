const url = require('url')
const http = require('http')
const https = require('https')
const ProxyAgent = require('proxy-agent')
const fs = require('fs')
const mime = require('mime-types')
const debug = require('debug')
const debugDownloadEntry = debug('download-retry')

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
function getRequestOptions(downloadUrl, proxy, proxyTimeout = 5000) {
  const parsed = url.parse(downloadUrl)
  const options = {
    protocol: parsed.protocol,
    host: parsed.host,
    pathname: parsed.pathname,
    path: parsed.path,
    query: parsed.query,
    port: parsed.port,
    hash: parsed.hash
  }
  if (proxy) {
    options.agent = new ProxyAgent(proxy)
    options.agent.timeout = proxyTimeout
  }
  return options
}

function showDownloadedInfo(total, current) {
  const percent = ((current / total) * 100).toFixed(2)
  const humanReadableTotalByte = formatBytes(total)
  const humanReadableCurrentByte = formatBytes(current)
  process.stdout.write(`Download${percent}% - ${humanReadableCurrentByte}/${humanReadableTotalByte}\r`)
}

function download(downloadUrl, options = {}) {
  const savePath = options.savePath || __dirname
  const debugEnabled = options.debug || false
  const maxRedirect = options.maxRedirect || 1
  const maxRetry = options.maxRetry || 5
  const timeoutSeconds = (options.timeoutSecond || 5) * 1000
  const showProgress = options.showProgress || false
  const proxy = options.proxy
  let redirectCount = 0
  let retryCount = 0
  if (debugEnabled) {
    debug.enable('download-retry')
  }
  return new Promise((resolve, reject) => {
    const task = function (downloadUrl) {
      
      if (redirectCount > maxRedirect) {
        return reject(Error('Maximum redirect exceeded'))
      }
      if (retryCount >= maxRetry) {
        return reject(Error('Max retry exceed'))
      }
  
      const downloadTimeout = function (request) {
        return setTimeout(function () {
          request.emit('error', Error('Timeout occurred'))
        }, timeoutSeconds)
      }
      
      const requestOptions = getRequestOptions(downloadUrl, proxy, timeoutSeconds)
      let filename = options.filename || requestOptions.pathname.split('/').pop()
      let timeout
      const handler = function (res) {
        debugDownloadEntry(res.statusCode, res.headers['content-type'])
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers['location']) {
          this.abort()
          clearTimeout(timeout)
          redirectCount++
    
          debugDownloadEntry('Redirect to ' + res.headers['location'])
    
          return task(res.headers['location'])
        }
        if (typeof options.filename === 'undefined' && filename.indexOf('.') === -1) {
          const extension = mime.extension(res.headers['content-type'])
          if (extension) {
            filename += '.'+ extension
          }
        }
        
        const fileLength = res.headers['content-length']
        let downloaded = 0
        const file = fs.createWriteStream(savePath + '/' + filename)
        
        res.on('data', (chunk) => {
          clearTimeout(timeout)
          timeout = downloadTimeout(this)
    
          downloaded += chunk.length
          file.write(chunk)
    
          if (showProgress) {
            showDownloadedInfo(fileLength, downloaded)
          }
        })
        res.on('end', function () {
          clearTimeout(timeout)
          debugDownloadEntry(request.id, 'Download completed')
          file.end(resolve)
        })
      }
      
      const downloader = downloadUrl.startsWith('https') ? https : http
      let request = downloader
        .get(requestOptions, handler)
      
      request.on('error', function (e) {
        clearTimeout(timeout)
        if (request.aborted) return
        retryCount++
        request.abort()
        debugDownloadEntry('Error: ' + request.id + ' - ' + e.message + '. Retrying...')
        task(downloadUrl)
      })
      request.on('socket', function () {
        timeout = downloadTimeout(request)
      })
      request.id = require('crypto').randomBytes(4).toString('hex')
      debugDownloadEntry('Request ID: ' + request.id)
      debugDownloadEntry('Download url: ' + downloadUrl)
      debugDownloadEntry('Redirect count: ' + redirectCount)
      debugDownloadEntry('Retry count: ' + retryCount)
    }
    task(downloadUrl)
  })
}

module.exports = download