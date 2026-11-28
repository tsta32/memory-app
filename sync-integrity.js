(function(root){
'use strict';
const keys=Object.freeze(['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1']);
function ordered(key,value){
  return value && typeof value==='object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(name=>[name,value[name]]))
    : value;
}
function inspect(data){
  if(!data)throw Error('Missing snapshot');
  const values=keys.map(key=>{
    if(!Object.hasOwn(data,key)||typeof data[key]!=='string')throw Error('Missing required storage entry');
    const value=JSON.parse(data[key]);
    if(!value||typeof value!=='object')throw Error('Invalid storage entry');
    return value;
  });
  // Older Worker snapshots materialize these unused grammar defaults.
  const grammar=values[2].grammarOptions;
  if(grammar && typeof grammar==='object' && !Array.isArray(grammar)){
    for(const key of ['tense','number','modal','preposition'])if(grammar[key]===true)delete grammar[key];
  }
  if(!Array.isArray(values[0].cards)||!Array.isArray(values[1].chapters))throw Error('Invalid card or chapter structure');
  const conflictCount=['editConflicts','identityConflicts','templateConflicts'].reduce((count,key)=>{
    const items=values[0][key];
    if(items!==undefined&&!Array.isArray(items))throw Error('Invalid conflict data');
    return count+(items?.length||0);
  },0);
  return {canonical:JSON.stringify(values,ordered),conflictCount};
}
function validateUploadEvidence(evidence,snapshotSha256,checkedAt){
  if(evidence?.version!==1||evidence.scope!=='worker-stored-snapshot'||
     evidence.snapshotSha256!==snapshotSha256||!/^([a-f0-9]{64})$/.test(snapshotSha256))return null;
  const uploadTime=Date.parse(evidence.clientUploadAt),checkTime=Date.parse(checkedAt);
  if(!Number.isFinite(uploadTime)||uploadTime<=0||uploadTime>checkTime||!Number.isFinite(checkTime))return null;
  return {version:1,scope:evidence.scope,snapshotSha256,clientUploadAt:new Date(uploadTime).toISOString()};
}
const api={keys,inspect,validateUploadEvidence};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.SyncIntegrity=api;
})(typeof window==='undefined'?globalThis:window);
