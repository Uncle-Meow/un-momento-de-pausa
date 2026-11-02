import test from 'node:test';
import assert from 'node:assert/strict';
import { esEndpointGoogle, esOrigenPuente, enviarAGoogle } from '../../js/google-sheets.js';

const endpoint='https://script.google.com/macros/s/PROYECTO_DE_PRUEBA/exec';
const origen='https://n-prueba-script.googleusercontent.com';
function entorno() {
  const listeners=new Set();
  const iframe={hidden:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},
    addEventListener(){},remove(){this.removido=true;},contentWindow:{}};
  const ventana={addEventListener(t,fn){listeners.add(fn);},removeEventListener(t,fn){listeners.delete(fn);}};
  const documento={createElement:()=>iframe,body:{appendChild(){}}};
  const cryptoImpl={getRandomValues(a){a.fill(7);return a;}};
  const emit=(e)=>[...listeners].forEach(fn=>fn(e));
  const fuente={parent:iframe.contentWindow,mensajes:[],postMessage(data,target){this.mensajes.push({data,target});}};
  const mensaje=(tipo,datos,extras={})=>emit({origin:origen,source:fuente,data:{app:'pausa-sheets-v1',canal:new URL(iframe.src).searchParams.get('canal'),tipo,datos},...extras});
  return {iframe,ventana,documento,cryptoImpl,fuente,mensaje,listeners};
}

test('solo admite despliegues HTTPS de Apps Script y dominios exactos del puente',()=>{
  assert.equal(esEndpointGoogle(endpoint),true);
  for(const u of ['https://script.google.com.attacker.tld/macros/s/x/exec','https://script.google.com/macros/s/x/dev','http://script.google.com/macros/s/x/exec',endpoint+'?x=1']) assert.equal(esEndpointGoogle(u),false);
  assert.equal(esOrigenPuente(origen),true);
  for(const u of ['https://script.googleusercontent.com.attacker.tld','http://script.google.com','null']) assert.equal(esOrigenPuente(u),false);
});

test('el puente espera una confirmación y elimina iframe y escuchas al terminar',async()=>{
  const e=entorno();let terminado=false;
  const p=enviarAGoogle({id_entrega:'id'}, {endpoint,...e}).then(r=>{terminado=true;return r;});
  e.mensaje('listo');
  assert.equal(terminado,false);
  assert.equal(e.fuente.mensajes.length,1);
  assert.equal(e.fuente.mensajes[0].target,origen);
  e.mensaje('respuesta',{status:201,body:{ok:true,id_entrega:'id'}});
  const r=await p;
  assert.equal(r.ok,true);
  assert.equal((await r.json()).id_entrega,'id');
  assert.equal(e.iframe.removido,true);
  assert.equal(e.listeners.size,0);
});

test('rechaza avisos de otro origen, canal o marco',async()=>{
  const e=entorno();
  const p=enviarAGoogle({}, {endpoint,...e,tiempoMaximoMs:20});
  e.mensaje('listo',null,{origin:'https://otro.example'});
  e.mensaje('listo',null,{source:{parent:{},postMessage(){throw Error('No debe enviar');}}});
  assert.equal(e.fuente.mensajes.length,0);
  await assert.rejects(p,/Tiempo de espera/);
  assert.equal(e.iframe.removido,true);
});

test('conserva los errores del servidor para que la interfaz no afirme un guardado',async()=>{
  const e=entorno();
  const p=enviarAGoogle({}, {endpoint,...e});
  e.mensaje('listo');e.mensaje('respuesta',{status:403,body:{ok:false,codigo:'actividad_no_disponible'}});
  const r=await p;assert.equal(r.ok,false);assert.equal(r.status,403);
});
