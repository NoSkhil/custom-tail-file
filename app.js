const app = require('http').createServer(handler),
	io = require('socket.io')(app);
	fs = require('fs');
	readline = require('readline');

app.listen(8081);

var maxBuffer = 100000;

function handler (req, res) {
	fs.readFile(__dirname + '/html/index.html',
		function (err, data) {
			if (err) {
				res.writeHead(500);
				return res.end('Error loading index.html');
			}
			res.writeHead(200);
			res.end(data);
		});
}


io.sockets.on('connection', function (socket) {
	var watcher;
	var fileSize;

	socket.emit('connected');

	socket.on('openFile', function (data) {
		fs.stat(data.filename, function(err, stat){

			if(watcher)
				watcher.close();

			if(err) {
				console.log(err);
				socket.emit('error', err.toString());
				return;
			}

			fileSize = stat.size;

			var start = (stat.size > maxBuffer)?(stat.size - maxBuffer):0;
			var stream = fs.createReadStream(data.filename,{start:start, end:stat.size});
			stream.addListener("error",function(err){
				socket.emit('error', err.toString());
			});
			stream.addListener("data", function(filedata){
				filedata = filedata.toString('utf-8');
				var lines;
				if(filedata.length >= maxBuffer){
					lines = filedata.slice(filedata.indexOf("\n")+1).split("\n");
					if (lines.length > 10) lines = lines.slice(-10);
				} else {
					lines = filedata.split("\n");
					if (lines.length > 10) lines = lines.slice(-10);
				}
				socket.emit('initialTextData',{ text : lines, filename: data.filename});
				startWatching(data.filename, socket);
			});
		});
	});


	function startWatching(filename, socket) {
		watcher = fs.watch(filename, function(event){
			fs.stat(filename, function(err,stat){
				if(err) {
					console.log(err);
					socket.emit('Error reading file: ', err.toString());
					return;
				}
				if(fileSize > stat.size) {
					socket.emit('fileReset',{filename:filename});
					fileSize = stat.size;
					return;
				}
				var stream = fs.createReadStream(filename, { start: fileSize, end: stat.size});
				stream.addListener("error",function(err){
					socket.emit('error', err.toString());
				});
				stream.addListener("data", function(filedata) {
					socket.emit('textData',{ text : filedata.toString('utf-8').split("\n") });
					fileSize = stat.size;
				});
			});
		});
	}

});
