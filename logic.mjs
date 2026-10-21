export const gestures={Closed_Fist:'rock',Victory:'scissors',Open_Palm:'paper'};
export const names={rock:'石头',scissors:'剪刀',paper:'布'};
export const icons={rock:'✊',scissors:'✌️',paper:'✋'};
export const counter=player=>({rock:'paper',paper:'scissors',scissors:'rock'})[player]??null;
export function classify(result){
 if(result.gestures?.length!==1)return null;
 const g=result.gestures[0]?.[0];return g?.score>=0.65?(gestures[g.categoryName]??null):null;
}
export class StableGesture{
 constructor(){this.reset()}
 reset(){this.last=null;this.count=0;this.since=0;this.at=null}
 update(value,now){
  if(!Object.hasOwn(names,value)||!Number.isFinite(now)){this.reset();return null}
  if(this.at!==null&&(now<=this.at||now-this.at>200))this.reset();
  this.at=now;
  if(value!==this.last){this.last=value;this.count=1;this.since=now;return null}
  this.count++;return this.count>=3&&now-this.since>=250?value:null;
 }
}
