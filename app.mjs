import {names,icons,StableGesture} from './logic.mjs';
import {Session} from './session.mjs';
import {Camera,FrameGate} from './camera.mjs';
import {Metrics} from './metrics.mjs';
const $=id=>document.getElementById(id),video=$('video'),canvas=$('camera'),ctx=canvas.getContext('2d');
const session=new Session(),camera=new Camera(video),gate=new FrameGate(),stable=new StableGesture();
let worker,workerInitTimer,ready=false,latestAt=0,startedAt=0,callback=null,lastMedia=-1,busySince=0,metrics=new Metrics(performance.now()),statsAt=0;
let windowFrames=0,windowInferences=0,connecting=false,connectAttempt=0;
const fresh=()=>session.connected&&latestAt>0&&performance.now()-latestAt<1500;
function controls(){
 $('play').disabled=!ready||!fresh()||session.phase!=='idle';
 $('play').textContent=!ready?'等待识别模型…':!fresh()?'等待 USB 视频…':session.phase==='idle'?'开始挑战':'挑战进行中…';
 $('connect').disabled=connecting||!$('devices').value;$('authorize').disabled=connecting;$('devices').disabled=connecting;$('undo').hidden=!session.undoable;$('exportMetrics').disabled=!metrics.frames;
 $('rounds').textContent=session.rounds;$('wins').textContent=session.rounds;
}
function message(text){$('status').textContent=text}
function cancelRound(text){session.cancel();stable.reset();$('countdown').textContent='';$('headline').textContent=text;controls()}
function stop(text,reload=true){
 if(session.connected)metrics.finish(performance.now(),text||'reconnect');
 clearTimeout(workerInitTimer);worker?.terminate();worker=null;ready=false;
 connectAttempt++;connecting=false;
 if(callback!==null){if(video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(callback);else cancelAnimationFrame(callback)}
 callback=null;camera.stop();session.disconnect();gate.reset();stable.reset();latestAt=0;lastMedia=-1;ctx.clearRect(0,0,canvas.width,canvas.height);
 $('countdown').textContent='';$('detected').textContent='等待 USB 摄像头';
 if(text){message(text);$('headline').textContent='连接恢复后可重新挑战'}
 if(reload)startWorker();controls();
}
camera.onended=()=>stop('USB 摄像头已断开，请重新连接');
function startWorker(){
 ready=false;gate.reset();clearTimeout(workerInitTimer);worker?.terminate();const current=new Worker(new URL('./recognition-worker.mjs',import.meta.url));worker=current;
 const initTimeout=workerInitTimer=setTimeout(()=>{if(worker===current&&!ready){current.terminate();message('模型加载超时，请点击重新加载识别');document.body.dataset.model='error'}},30000);
 current.onerror=e=>{if(worker!==current)return;e.preventDefault();clearTimeout(initTimeout);ready=false;current.terminate();gate.reset();cancelRound('识别中断，本轮不计分');message('识别启动失败：'+e.message+'。点击重新加载识别。');document.body.dataset.model='error'};
 current.onmessage=({data})=>{
  if(worker!==current)return;
  if(data.type==='ready'){clearTimeout(initTimeout);ready=true;document.body.dataset.model='ready';if(!session.connected)message('模型已就绪，请授权并选择摄像头');controls();return}
  if(data.type==='error'){if(data.connectionId!==undefined&&(data.connectionId!==session.connectionId||data.requestId!==gate.generation))return;clearTimeout(initTimeout);ready=false;gate.reset();current.terminate();cancelRound('识别中断，本轮不计分');message('识别失败：'+data.error+'。点击重新加载识别。');document.body.dataset.model='error';return}
  if(data.type!=='result')return;
  gate.complete(data.requestId);
  if(data.connectionId!==session.connectionId||!fresh())return;
  metrics.inference(data.elapsed);windowInferences++;document.body.dataset.inferences=metrics.inferences;
  if(performance.now()-data.timestamp>500){stable.reset();return}
  $('detected').textContent=data.hand?'识别到：'+names[data.hand]:data.hands>1?'只伸出一只手':'请出石头、剪刀或布';
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#c7f66a';
  for(const hand of data.landmarks)for(const p of hand){ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,2,0,Math.PI*2);ctx.fill()}
  if(session.acceptResult(data.connectionId,data.roundId,data.timestamp,performance.now())){
   const hand=stable.update(data.hand,data.timestamp);
   if(hand){const other=session.settle(hand);if(other){$('countdown').textContent='';$('player').textContent=icons[hand];$('robot').textContent=icons[other];$('playerName').textContent=names[hand];$('robotName').textContent=names[other];$('headline').textContent='电脑获胜！再来一次？';$('history').textContent=`第 ${session.rounds} 回合：你出${names[hand]}，电脑出${names[other]}。`;stable.reset();controls()}}
  }
 };
 current.postMessage({type:'init'});controls();
}
function schedule(connectionId){
 const tick=(now,meta)=>{
  if(connectionId!==session.connectionId||!session.connected)return;
  const mediaTime=meta?.mediaTime??video.currentTime;
  if(video.readyState>=2&&mediaTime!==lastMedia){
   lastMedia=mediaTime;latestAt=performance.now();metrics.frame(latestAt);windowFrames++;document.body.dataset.frames=metrics.frames;
   if(ready&&!gate.busy){
    const roundId=session.roundId,timestamp=performance.now();busySince=timestamp;
    gate.submit(()=>createImageBitmap(video),(bitmap,requestId)=>worker.postMessage({type:'frame',bitmap,connectionId,roundId,timestamp,requestId},[bitmap])).catch(e=>{if(connectionId===session.connectionId)stop('视频帧读取失败：'+e.message)});
   }
  }
  if(connectionId===session.connectionId&&session.connected)callback=video.requestVideoFrameCallback?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);
 };
 callback=video.requestVideoFrameCallback?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);
}
async function listDevices(selected){
 const devices=await camera.devices();$('devices').replaceChildren();
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='请选择摄像头（USB 或内置）';$('devices').append(placeholder);
 for(const d of devices){const option=document.createElement('option');option.value=d.deviceId;option.textContent=d.label||'摄像头（授权后显示名称）';$('devices').append(option)}
 if(selected&&devices.some(d=>d.deviceId===selected))$('devices').value=selected;
 controls();
 return devices;
}
$('connect').onclick=async()=>{
 const id=$('devices').value;stop();const attempt=++connectAttempt;connecting=true;controls();message('正在请求 USB 摄像头权限…');
 try{
  if(!await camera.open(id||undefined)||attempt!==connectAttempt)return;
  const settings=camera.settings();await listDevices(settings.deviceId);if(attempt!==connectAttempt)return;
  session.connect();latestAt=0;startedAt=performance.now();statsAt=startedAt;windowFrames=windowInferences=0;metrics=new Metrics(startedAt);
  canvas.width=video.videoWidth||320;canvas.height=video.videoHeight||240;
  $('deviceName').textContent=camera.stream.getVideoTracks()[0].label||'所选摄像头';
  message('已连接所选摄像头；使用开发板时请确认设备名为 UVC CAM1');schedule(session.connectionId);
 }catch(e){if(attempt===connectAttempt){stop();const reasons={NotAllowedError:'摄像头权限被拒绝，请在浏览器允许访问后重试',NotFoundError:'未找到摄像头，请检查 USB 固件与数据线',OverconstrainedError:'所选摄像头已不可用，请刷新设备列表',NotReadableError:'摄像头无法打开，请关闭占用它的其他程序'};message(reasons[e.name]||e.message)}}
 finally{if(attempt===connectAttempt){connecting=false;controls()}}
};
$('authorize').onclick=async()=>{
 stop();const attempt=++connectAttempt;connecting=true;controls();message('请允许摄像头权限，随后选择摄像头');
 try{await camera.authorize();if(attempt!==connectAttempt)return;await listDevices();if(attempt!==connectAttempt)return;message('已授权。请选择摄像头（USB 或内置），再点击连接；临时默认摄像头已关闭')}
 catch(e){if(attempt===connectAttempt)message('授权未完成：'+e.message)}
 finally{if(attempt===connectAttempt){connecting=false;controls()}}
};
$('devices').onchange=()=>stop('已更换选择，请点击连接 USB 摄像头');
$('disconnect').onclick=()=>stop('已断开视频连接');
$('reloadModel').onclick=()=>{cancelRound('识别模型正在重新加载');startWorker()};
$('refreshDevices').onclick=()=>listDevices($('devices').value).catch(e=>message(e.message));
$('play').onclick=()=>{if(!ready||!fresh())return;if(session.start(performance.now())===null)return;stable.reset();$('player').textContent='❔';$('robot').textContent='🤖';$('playerName').textContent='等待出拳';$('robotName').textContent='正在观察';$('headline').textContent='准备，石头、剪刀、布！';controls()};
$('undo').onclick=()=>{if(session.undo()){$('headline').textContent='本轮已作废';$('history').textContent='调整光线和手的位置后重新挑战。';controls()}};
$('exportMetrics').onclick=()=>{const data={capturedAt:new Date().toISOString(),device:$('deviceName').textContent,settings:camera.settings(),...metrics.report(performance.now()),note:'浏览器帧回调统计；不等同于摄像头到屏幕的端到端延迟或真人识别准确率。'};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='usb-rps-performance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
setInterval(()=>{
 const now=performance.now(),before=session.phase;
 if(session.connected&&now-(latestAt||startedAt)>1500){stop('超过 1.5 秒没有新画面，请检查 USB 并重新连接');return}
 if(ready&&gate.busy&&now-busySince>5000){ready=false;worker?.terminate();gate.reset();cancelRound('识别超时，本轮不计分');message('识别超时，请点击重新加载识别');document.body.dataset.model='error'}
 const phase=session.tick(now);
 if(phase==='timeout'){$('countdown').textContent='';stable.reset();$('headline').textContent='没看清，这次不计分'}
 else if(session.phase==='countdown')$('countdown').textContent=Math.max(1,3-Math.floor((now-session.startAt)/1000));
 else if(before==='countdown'&&session.phase==='detect'){stable.reset();$('countdown').textContent='出拳！';$('headline').textContent='保持手势约四分之一秒…'}
 if(session.connected&&now-statsAt>=1000){const seconds=(now-statsAt)/1000;const fps=windowFrames/seconds,rate=windowInferences/seconds;windowFrames=windowInferences=0;statsAt=now;$('performance').textContent=`${video.videoWidth} × ${video.videoHeight} · 视频 ${fps.toFixed(1)} 帧/秒 · 识别 ${rate.toFixed(1)} 次/秒 · 已运行 ${Math.floor((now-startedAt)/1000)} 秒`;document.body.dataset.fps=fps.toFixed(1)}
 controls();
},100);
window.addEventListener('pagehide',()=>stop(undefined,false));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&session.connected)stop('页面进入后台，已暂停；返回后请重新连接')});
startWorker();listDevices().catch(()=>{});
