#download-retry
Download content from an url, support retry if connection failed or timeout
##Install
```bash
$ npm install download-retry
```
##Usage
```javascript
downloadRetry(url, options)
```
###options
* destination: the directory when file saved. *Default: process.env.cwd()*
* filename: filename of saved file. If not defined, file will be named
by url and content type
* maxRetry: The maximum attempt to download file, if download progress failed
* maxRedirect: Times of redirect. Default: 1
* timeoutSeconds: The seconds of timeout timer. Default: 5
* showProgress: Show information about download progress
* debug: Show information for debug purpose. Default: false
* proxy: Support proxy (under constructor)