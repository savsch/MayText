const http = require('http');
const WebSocket = require('ws');
const PORT = 6969;
const fs = require('fs');
const DiffMatchPatch = require('diff-match-patch');
const dmp = new DiffMatchPatch();

let clientWs = null, localWs = null;
let localText = '', clientText = '';
function setLocalText(t){
  localText=t;
  clientWs?.send('\x00'+localText);
}
function updateLocalText(diffText){
  clientWs?.send(diffText);
  localText=dmp.patch_apply(dmp.patch_fromText(diffText), localText)[0];
}
function setClientText(t){
  clientText=t;
  localWs?.send('\x00'+clientText);
}
function updateClientText(diffText){
  localWs?.send(diffText);
  clientText=dmp.patch_apply(dmp.patch_fromText(diffText), clientText)[0];
}

const SRC={
  'diff_match_patch.js' : ['text/javascript', fs.readFileSync('diff_match_patch.js')],
  'markdown.js' : ['text/javascript', fs.readFileSync('markdown.js')],
  'markdown.wasm' : ['application/wasm', fs.readFileSync('markdown.wasm')],
  'index.html' : ['text/html', fs.readFileSync('index.html')],
};

function handleSRCAndReturn(req, res){
  let request = req.url.substring(1).split('?')[0];
  if(request in SRC){
    res.writeHead(200, {'Content-Type': SRC[request][0], 'Cache-Control': 'max-age=86400'});
    res.end(SRC[request][1]);
    return true;
  }
  return false;
}

const httpServer = http.createServer((req, res) => {
  if(!handleSRCAndReturn(req,res)){
    res.writeHead(404);
    res.end("Nahi mila.");
  }
});

const wsServer = new WebSocket.Server({ server: httpServer });

wsServer.on('connection', (ws, headers) => {
  console.log('WebSocket client connected', headers.rawHeaders);
  let id=null;
  headers.rawHeaders.forEach(s=>{if(s.startsWith('id, ')) id=s.substring('id, '.length);})
  if(id==='client101'){
    if(clientWs) clientWs.close();
    clientWs = ws;
    ws.send('\x00'+localText);
    ws.on('message', (message) => {
      message = message.toString();
      if(message[0]==='\x00'){
        setClientText(message.substring(1));
      }else{
        updateClientText(message);
      }
    });

    ws.on('close', () => {
      clientWs = null;
      console.log(`WebSocket client ${id} disconnected`);
    });
  }else if(id==='local101'){
    if(localWs) localWs.close();
    localWs = ws;
    ws.send('\x00'+clientText);
    ws.on('message', (message) => {
      message = message.toString();
      if(message[0]==='\x00'){
        setLocalText(message.substring(1));
      }else{
        updateLocalText(message);
      }
    });

    ws.on('close', () => {
      localWs = null;
      console.log(`WebSocket client ${id} disconnected`);
    });
  }

});

httpServer.listen(6969, () => {
  console.log(`HTTP server running on port ${PORT}`);
});
