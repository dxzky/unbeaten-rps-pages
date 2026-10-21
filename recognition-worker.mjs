let model;
let classify;
self.onmessage=async({data})=>{
 if(data.type==='init'){
  try{
   const {FilesetResolver,GestureRecognizer}=await import('./vendor/vision_bundle.mjs');
   ({classify}=await import('./logic.mjs'));
   const files=await FilesetResolver.forVisionTasks(new URL('./vendor/wasm',self.location.href).href);
   model=await GestureRecognizer.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/gesture_recognizer.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:0.6,minHandPresenceConfidence:0.6});
   postMessage({type:'ready'});
  }catch(e){postMessage({type:'error',error:e.message})}
  return;
 }
 if(data.type!=='frame')return;
 const {bitmap,connectionId,roundId,timestamp,requestId}=data,started=performance.now();
 try{
  if(!model)throw Error('手势模型尚未就绪');
  const result=model.recognizeForVideo(bitmap,timestamp);
  postMessage({type:'result',connectionId,roundId,timestamp,requestId,hand:classify(result),hands:result.gestures?.length??0,landmarks:result.landmarks??[],elapsed:performance.now()-started});
 }catch(e){postMessage({type:'error',connectionId,roundId,requestId,error:e.message})}
 finally{bitmap.close()}
};
