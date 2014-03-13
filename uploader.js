var http = require('http');
var util = require('util');
var multiparty = require('multiparty');
var knox = require('knox');
var PORT = process.env.PORT || 27372;
var Q = require('q');

// S3Client
// TODO - move credentials
var s3Client = knox.createClient({
  secure: false,
  region: 'us-west-1',

  key: process.env.S3_KEY || 'YOUR_S3_KEY',
  secret: process.env.S3_SECRET || 'YOUR_S3_SECRET',
  bucket: process.env.S3_BUCKET || 'YOUR_S3_BUCKET'
});


var server = http.createServer(function (req, res) {
  if (req.url === '/') {
    res.writeHead(200, {'content-type': 'text/html'});
    res.end(
      '<form action="/upload" enctype="multipart/form-data" method="post">' +
        '<input type="text" name="path"><br>' +
        '<input type="file" name="upload"><br>' +
        '<input type="submit" value="Upload">' +
        '</form>'
    );
  } else if (req.url === '/upload') {

    var fields = [];
    var uploadPromises = [];

    var form = new multiparty.Form();

    form.on('field', function(name, value) {
      console.log('Field: ' + name + ', Value: ' + value);
      fields.push({
        name: name,
        value: value
      });
    });

    form.on('part', function(part) {
      if(!part.filename) return;    // If not a file, ignore
      console.log(part.filename);
      // FIXME: This really only works for one file - multiple files fail
      uploadPromises.push(uploadFileToS3(part.filename, part));
    });

    form.on('error', function(err) {
      // TODO - handle error
      console.log('Form error: ' + err);
    });

    form.on('close', function() {
      console.log('done');
//      clearInterval(logBytes);
//      console.log(fields);

      // Wait for uploads to s3 to finish
      Q.allSettled(uploadPromises)
        .then(function(done){
        console.log('done sending');
        res.end('OKIE DOKIE');
      });
    });

//    var logBytes = setInterval(function(){
//      console.log('bytes: ', form.bytesReceived);
//    }, 10);

    form.parse(req);
  }
});

function uploadFileToS3(destPath, part) {
  console.log(part.byteCount);
  var d = Q.defer();

  var headers = {
    'x-amz-acl': 'public-read',
    'Content-Length': part.byteCount
  };

  s3Client.putStream(part, destPath, headers, function (err, s3Response) {
    console.log('done put stream');
//    console.log(s3Response);
    if (!!err) {
      console.log('S3 Error:' + err);
      d.reject(err);
    }
    d.resolve(s3Response);
  });

  return d.promise;
}

// Start Server
server.listen(PORT, function () {
  console.info('Listening on http://0.0.0.0:' + PORT + '/');
});
