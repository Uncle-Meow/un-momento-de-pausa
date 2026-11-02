import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const fuente=fs.readFileSync(new URL('../../google-apps-script/Codigo.gs',import.meta.url),'utf8');
const encabezados=['Fecha de recepción','Código de entrega','Actividad','Versión','P01','P02','P03','P04','P05','P06','P07','P08','P09','P10','Total','Promedio','Rango'];
const ids=[1,3,4,7,8,11,13,15,16,17];
function payload(n=3,id='00000000-0000-4000-8000-000000000001') {return {id_entrega:id,actividad:'habilidades-liderazgo-2026',version:'2026-11-v2',respuestas:Object.fromEntries(ids.map(k=>[k,n]))};}
function servicio() {
  const filas=[encabezados];let bloqueado=false,liberaciones=0,cerrado=false,fallo=false;
  const hoja={getLastRow:()=>filas.length,getMaxRows:()=>1000,getRange(row,col,n,m){return {
    getValues:()=>filas.slice(row-1,row-1+n).map(r=>r.slice(col-1,col-1+m)),
    setValues(valores){assert.equal(bloqueado,true);for(let i=0;i<valores.length;i++)filas[row-1+i]=valores[i];},
    createTextFinder(id){return {matchEntireCell(){return this;},findNext(){const i=filas.findIndex((r,i)=>i>0&&r[1]===id);return i<0?null:{getRow:()=>i+1};}};}
  };}};
  const contexto=vm.createContext({console,Date,JSON,Number,Object,Array,String,Math,
    SpreadsheetApp:{openById:()=>({getSheetByName:()=>hoja}),flush(){if(fallo)throw Error('Fallo tras escritura');}},
    LockService:{getScriptLock:()=>({tryLock(){bloqueado=true;return true;},releaseLock(){bloqueado=false;liberaciones++;}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='HOJA_ID'?'hoja-simulada':cerrado?'false':null})}
  });
  vm.runInContext(fuente,contexto);
  return {registrar:p=>contexto.registrarEntrega(p),filas,liberaciones:()=>liberaciones,cerrar(){cerrado=true;},fallar(v){fallo=v;}};
}
test('guarda fecha, diez respuestas y cálculo correcto bajo bloqueo',()=>{
  const s=servicio();const r=s.registrar(payload());assert.equal(r.status,201);
  assert.equal(s.filas.length,2);assert.equal(s.filas[1][14],30);assert.equal(s.filas[1][15],3);assert.equal(s.filas[1][16],3);
  assert.equal(s.liberaciones(),1);assert.ok(s.filas[1][0] instanceof Date);
});
test('los 41 totales conservan los cinco rangos acordados en el servidor',()=>{
  const s=servicio();
  for(let total=10;total<=50;total++) {
    const p=payload(1,'00000000-0000-4000-8000-'+String(total).padStart(12,'0'));let extra=total-10;
    for(const id of ids){const n=Math.min(4,extra);p.respuestas[id]+=n;extra-=n;}
    const r=s.registrar(p);assert.equal(r.body.total,total);assert.equal(r.body.rango,Math.round(total/10));
  }
});
test('reintentar la misma entrega no crea otra fila y cambiarla produce conflicto',()=>{
  const s=servicio();s.registrar(payload());assert.equal(s.registrar(payload()).body.duplicado,true);assert.equal(s.filas.length,2);
  assert.equal(s.registrar(payload(4)).status,409);assert.equal(s.filas.length,2);
});
test('rechaza respuestas incompletas, fuera de escala, con texto y campos personales',()=>{
  for(const editar of [p=>delete p.respuestas[1],p=>p.respuestas[1]=6,p=>p.respuestas[1]='=IMPORTXML("x")',p=>p.nombre='Persona',p=>p.version='otra',p=>{p.respuestas[2]=3;delete p.respuestas[1];}]){
    const s=servicio(),p=payload();editar(p);assert.equal(s.registrar(p).status,400);assert.equal(s.filas.length,1);
  }
});
test('una actividad cerrada no recibe nuevas entregas, pero permite confirmar un reintento previo',()=>{
  const s=servicio();s.registrar(payload());s.cerrar();assert.equal(s.registrar(payload()).body.duplicado,true);
  assert.equal(s.registrar(payload(3,'00000000-0000-4000-8000-000000000002')).status,403);assert.equal(s.filas.length,2);
});
test('si falla la confirmación después de escribir, reintentar recupera la fila sin duplicarla',()=>{
  const s=servicio();s.fallar(true);assert.equal(s.registrar(payload()).status,503);assert.equal(s.filas.length,2);
  s.fallar(false);assert.equal(s.registrar(payload()).body.duplicado,true);assert.equal(s.filas.length,2);
});
