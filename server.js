import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app=express();
const server=createServer(app);
const wss=new WebSocketServer({server,path:'/ws',maxPayload:32*1024});
const rooms=new Map(), files=new Map();
const MAX_BYTES=40*1024*1024, GRACE_MS=5*60*1000;
const send=(ws,obj)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));};
const broadcast=(room,obj)=>{for(const c of room.clients.values())send(c.ws,obj);};
const publicRoom=room=>({code:room.code,hostId:room.hostId,devices:[...room.clients.values()].filter(c=>c.ws?.readyState===WebSocket.OPEN).map(({id,name,joinedAt})=>({id,name,joinedAt})),track:room.track,playback:room.playback,mode:room.mode,assignments:room.assignments});
const cleanName=s=>String(s||'Phone').trim().slice(0,32)||'Phone';
const randomCode=()=>{let c;do{c=String(crypto.randomInt(0,1000000)).padStart(6,'0');}while(rooms.has(c));return c;};
function clearRoom(room){if(room.timer)clearTimeout(room.timer);rooms.delete(room.code);if(room.track?.id)files.delete(room.track.id);}
function scheduleCleanup(room){if(room.timer)clearTimeout(room.timer);room.timer=setTimeout(()=>{if([...room.clients.values()].some(c=>c.ws?.readyState===WebSocket.OPEN))return;clearRoom(room);},GRACE_MS);room.timer.unref?.();}
function updateRoom(room){broadcast(room,{type:'state',room:publicRoom(room)});}
app.use(express.static(path.dirname(fileURLToPath(import.meta.url))));
app.get('/health',(_,res)=>res.json({ok:true,rooms:rooms.size}));
app.get('/audio/:id',(req,res)=>{const item=files.get(req.params.id);if(!item)return res.sendStatus(404);res.setHeader('Content-Type',item.mime);res.setHeader('Cache-Control','no-store');res.setHeader('Accept-Ranges','bytes');const range=req.headers.range;if(range){const m=/^bytes=(\d+)-(\d*)$/.exec(range);if(m){const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),item.data.length-1):item.data.length-1;if(start>end||start>=item.data.length){res.setHeader('Content-Range',`bytes */${item.data.length}`);return res.sendStatus(416);}res.status(206);res.setHeader('Content-Range',`bytes ${start}-${end}/${item.data.length}`);res.setHeader('Content-Length',end-start+1);return res.end(item.data.subarray(start,end+1));}}res.setHeader('Content-Length',item.data.length);res.end(item.data);});
app.post('/api/rooms/:code/audio',express.raw({type:['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/x-m4a'],limit:MAX_BYTES}), (req,res)=>{const room=rooms.get(req.params.code);if(!room)return res.status(404).json({error:'Room not found'});if(req.headers.authorization!==`Bearer ${room.hostSecret}`)return res.sendStatus(403);if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'Missing audio file'});if(room.track?.id)files.delete(room.track.id);const id=crypto.randomUUID();files.set(id,{data:req.body,mime:req.headers['content-type']});room.track={id,name:String(req.headers['x-track-name']||'Uploaded track').slice(0,120),url:`/audio/${id}`};room.playback={playing:false,position:0,at:Date.now()+1500};updateRoom(room);res.json({track:room.track});});
app.use((err,req,res,next)=>{if(err.type==='entity.too.large')return res.status(413).json({error:'Audio exceeds 40 MB'});res.status(400).json({error:'Invalid upload'});});
wss.on('connection',ws=>{let room=null,id=null;ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
ws.on('message',raw=>{let msg;try{msg=JSON.parse(raw.toString());}catch{return send(ws,{type:'error',message:'Invalid message'});}if(msg.type==='clock')return send(ws,{type:'clock',clientSent:msg.clientSent,serverTime:Date.now()});
if(msg.type==='create'){if(room)return;const code=randomCode();id=crypto.randomUUID();const hostSecret=crypto.randomBytes(32).toString('hex');const token=crypto.randomBytes(24).toString('hex');room={code,hostId:id,hostSecret,clients:new Map(),track:null,playback:{playing:false,position:0,at:Date.now()},timer:null,mode:"party",assignments:{}};room.clients.set(id,{id,token,name:cleanName(msg.name),ws,joinedAt:Date.now()});rooms.set(code,room);return send(ws,{type:'created',id,code,hostSecret,token,room:publicRoom(room)});}
if(msg.type==='resume'){if(room)return;const found=rooms.get(String(msg.code||''));const client=found&&[...found.clients.values()].find(c=>c.token===msg.token);if(!client)return send(ws,{type:'resume_failed',message:'Previous room expired or server restarted'});room=found;id=client.id;if(client.ws&&client.ws!==ws){const old=client.ws;client.ws=ws;old.close();}else client.ws=ws;if(room.timer){clearTimeout(room.timer);room.timer=null;}send(ws,{type:'resumed',id,code:room.code,hostSecret:id===room.hostId?room.hostSecret:null,token:client.token,room:publicRoom(room)});return updateRoom(room);}
if(msg.type==='join'){if(room)return;const found=rooms.get(String(msg.code||''));if(!found)return send(ws,{type:'error',message:'Room not found'});if(found.clients.size>=10)return send(ws,{type:'error',message:'Room full (10 devices)'});room=found;id=crypto.randomUUID();const token=crypto.randomBytes(24).toString('hex');room.clients.set(id,{id,token,name:cleanName(msg.name),ws,joinedAt:Date.now()});if(room.timer){clearTimeout(room.timer);room.timer=null;}send(ws,{type:'joined',id,token,room:publicRoom(room)});return updateRoom(room);}
if(!room||!id)return send(ws,{type:'error',message:'Join a room first'});if(msg.type==='mode'){if(id!==room.hostId)return send(ws,{type:'error',message:'Host only'});if(!['party','stereo','surround'].includes(msg.mode))return;room.mode=msg.mode;room.playback={...room.playback,playing:false,position:0,at:Date.now()};updateRoom(room);return;}
if(msg.type==='assign'){if(id!==room.hostId)return send(ws,{type:'error',message:'Host only'});if(!room.clients.has(msg.deviceId)||!['left','right','front-left','front-right','rear-left','rear-right','center','off'].includes(msg.channel))return;room.assignments[msg.deviceId]=msg.channel;updateRoom(room);return;}
if(msg.type==='calibration_pulse'){if(id!==room.hostId)return send(ws,{type:'error',message:'Host only'});broadcast(room,{type:'calibration_pulse',at:Date.now()+2500});return;}
if(msg.type==='playback'){if(id!==room.hostId)return send(ws,{type:'error',message:'Host only'});const position=Number(msg.position);if(!Number.isFinite(position)||position<0||position>86400)return;room.playback={playing:!!msg.playing,position,at:Date.now()+1800};updateRoom(room);}});
ws.on('close',()=>{if(!room)return;const client=room.clients.get(id);if(client?.ws!==ws)return;client.ws=null;updateRoom(room);if(![...room.clients.values()].some(c=>c.ws?.readyState===WebSocket.OPEN))scheduleCleanup(room);});});
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},30000);heartbeat.unref?.();
const port=Number(process.env.PORT||3000);server.listen(port,'0.0.0.0',()=>console.log(`SyncSound running on http://localhost:${port}`));
