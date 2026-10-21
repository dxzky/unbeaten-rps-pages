export class Metrics {
 constructor(now){this.started=now;this.frames=0;this.previous=null;this.stalls=0;this.maxIntervalMs=0;this.inferences=0;this.totalInferenceMs=0;this.windows=[];this.windowStart=now;this.windowFrames=0}
 frame(now){
  if(this.previous!==null){const gap=now-this.previous;this.maxIntervalMs=Math.max(this.maxIntervalMs,gap);if(gap>200)this.stalls++}
  this.previous=now;this.frames++;this.windowFrames++;
  if(now-this.windowStart>=1000){this.windows.push({atMs:now-this.started,durationMs:now-this.windowStart,frames:this.windowFrames,fps:this.windowFrames*1000/(now-this.windowStart)});this.windowStart=now;this.windowFrames=0}
 }
 inference(ms){this.inferences++;this.totalInferenceMs+=ms}
 finish(now,reason='stopped'){
  if(this.ended!==undefined)return;
  this.ended=now;this.terminationReason=reason;
  if(this.previous!==null){const gap=now-this.previous;this.maxIntervalMs=Math.max(this.maxIntervalMs,gap);if(gap>200)this.stalls++}
  if(now>this.windowStart)this.windows.push({atMs:now-this.started,durationMs:now-this.windowStart,frames:this.windowFrames,fps:this.windowFrames*1000/(now-this.windowStart)});
 }
 report(now){const durationMs=Math.max(0,(this.ended??now)-this.started),seconds=durationMs/1000;return {durationMs,frames:this.frames,fps:seconds?this.frames/seconds:0,stalls:this.stalls,maxIntervalMs:this.maxIntervalMs,inferences:this.inferences,inferenceFps:seconds?this.inferences/seconds:0,meanInferenceMs:this.inferences?this.totalInferenceMs/this.inferences:0,tenMinuteSample:durationMs>=600000,terminationReason:this.terminationReason??null,windows:this.windows}}
}
