import {counter} from './logic.mjs';
export class Session {
 constructor(){this.connectionId=0;this.roundId=0;this.connected=false;this.phase='idle';this.rounds=0;this.undoable=false}
 connect(){this.disconnect();this.connected=true;return this.connectionId}
 disconnect(){this.connectionId++;this.connected=false;this.cancel()}
 cancel(){this.phase='idle';this.roundId++;this.undoable=false}
 start(now){if(!this.connected||this.phase!=='idle')return null;this.phase='countdown';this.startAt=now;this.deadline=now+11000;this.undoable=false;return ++this.roundId}
 tick(now){if(this.phase==='countdown'&&now-this.startAt>=3000)this.phase='detect';if(this.phase==='detect'&&now>=this.deadline){this.cancel();return 'timeout'}return this.phase}
 acceptResult(connectionId,roundId,capturedAt=this.startAt+3000,now=capturedAt){return this.connected&&this.phase==='detect'&&this.connectionId===connectionId&&this.roundId===roundId&&capturedAt>=this.startAt+3000&&capturedAt<this.deadline&&now<this.deadline}
 settle(hand){const other=counter(hand);if(!other||this.phase!=='detect'||!this.connected)return null;this.phase='idle';this.rounds++;this.undoable=true;return other}
 undo(){if(this.phase!=='idle'||!this.undoable)return false;this.rounds--;this.undoable=false;return true}
}
