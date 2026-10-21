export class Camera {
 constructor(video,media=globalThis.navigator?.mediaDevices){this.video=video;this.media=media;this.version=0;this.stream=null;this.onended=()=>{}}
 stop(){this.version++;const stream=this.stream;this.stream=null;this.video.srcObject=null;for(const t of stream?.getTracks()??[])t.stop()}
 async authorize(){
  if(!this.media?.getUserMedia)throw Error('请使用 Edge 或 Chrome 打开本地游戏');
  const stream=await this.media.getUserMedia({audio:false,video:true});
  stream.getTracks().forEach(t=>t.stop());
 }
 async open(deviceId){
  this.stop();const version=this.version;
  if(!deviceId)throw Error('请先明确选择 USB 摄像头');
  if(!this.media?.getUserMedia)throw Error('请使用 Edge 或 Chrome 打开本地游戏');
  const video={width:{ideal:320},height:{ideal:240},frameRate:{ideal:30,max:30}};
  if(deviceId)video.deviceId={exact:deviceId};
  const stream=await this.media.getUserMedia({audio:false,video});
  if(version!==this.version){stream.getTracks().forEach(t=>t.stop());return false}
  this.stream=stream;this.video.srcObject=stream;
  for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(this.stream===stream){this.stop();this.onended()}});
  try{await this.video.play()}catch(e){if(version===this.version)this.stop();throw e}
  return version===this.version;
 }
 async devices(){return (await this.media.enumerateDevices()).filter(d=>d.kind==='videoinput')}
 settings(){return this.stream?.getVideoTracks()[0]?.getSettings()??{}}
}

export class FrameGate {
 constructor(){this.busy=false;this.generation=0}
 reset(){this.generation++;this.busy=false}
 complete(generation=this.generation){if(generation===this.generation)this.busy=false}
 async submit(makeBitmap,send){
  if(this.busy)return false;
  this.busy=true;const generation=++this.generation;let bitmap;
  try{
   bitmap=await makeBitmap();
   if(generation!==this.generation){bitmap.close();return false}
   send(bitmap,generation);return true;
  }catch(e){bitmap?.close();if(generation===this.generation)this.busy=false;throw e}
 }
}
