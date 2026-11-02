// Servicio de guardado de «Un momento de pausa». Solo conserva respuestas sin nombres.
// Las funciones con sufijo _ son administrativas y no se exponen a google.script.run.
var PAUSA = Object.freeze({
  origen: 'https://uncle-meow.github.io',
  actividad: 'habilidades-liderazgo-2026',
  version: '2026-11-v2',
  ids: [1,3,4,7,8,11,13,15,16,17],
  encabezados: ['Fecha de recepción','Código de entrega','Actividad','Versión',
    'P01','P02','P03','P04','P05','P06','P07','P08','P09','P10','Total','Promedio','Rango']
});

function doGet(e) {
  var canal = e && e.parameter && e.parameter.canal;
  if (typeof canal !== 'string' || !/^[a-f0-9]{32}$/.test(canal)) {
    return HtmlService.createHtmlOutput('Servicio de recepción de la actividad Un momento de pausa.');
  }
  var html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>' +
    '"use strict";var canal=' + JSON.stringify(canal) + ',origen=' + JSON.stringify(PAUSA.origen) + ';' +
    'var ocupado=false,terminado=false;function avisar(tipo,datos){window.top.postMessage({app:"pausa-sheets-v1",canal:canal,tipo:tipo,datos:datos},origen);}' +
    'window.addEventListener("message",function(e){var m=e.data;' +
    'if(e.origin!==origen||e.source!==window.top||!m||m.app!=="pausa-sheets-v1"||m.canal!==canal||m.tipo!=="guardar"||ocupado||terminado)return;' +
    'ocupado=true;google.script.run.withSuccessHandler(function(r){terminado=true;avisar("respuesta",r);})' +
    '.withFailureHandler(function(){terminado=true;avisar("respuesta",{status:503,body:{ok:false,codigo:"servicio_no_disponible"}});})' +
    '.registrarEntrega(m.payload);});avisar("listo",null);' +
    '</script></body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function error_(status,codigo) { return {status:status,body:{ok:false,codigo:codigo}}; }

function validar_(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'cuerpo_no_valido';
  var campos=['id_entrega','actividad','version','respuestas'];
  if (Object.keys(p).length!==campos.length || !campos.every(function(k){return Object.prototype.hasOwnProperty.call(p,k);})) return 'campos_no_validos';
  if (typeof p.id_entrega!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.id_entrega)) return 'id_entrega_no_valido';
  if (p.actividad!==PAUSA.actividad) return 'actividad_no_valida';
  if (p.version!==PAUSA.version) return 'version_no_corresponde';
  if (!p.respuestas || typeof p.respuestas!=='object' || Array.isArray(p.respuestas)) return 'respuestas_no_validas';
  var claves=Object.keys(p.respuestas);
  if (claves.length!==PAUSA.ids.length) return 'respuestas_incompletas';
  for (var i=0;i<PAUSA.ids.length;i++) {
    var id=String(PAUSA.ids[i]);
    if (!Object.prototype.hasOwnProperty.call(p.respuestas,id)) return 'id_pregunta_no_valido';
    var valor=p.respuestas[id];
    if (typeof valor!=='number' || !Number.isInteger(valor) || valor<1 || valor>5) return 'valor_no_valido';
  }
  return null;
}

function registrarEntrega(p) {
  var codigo=validar_(p);
  if(codigo) return error_(400,codigo);
  var bloqueo=LockService.getScriptLock();
  if(!bloqueo.tryLock(20000)) return error_(503,'servicio_ocupado');
  try {
    var propiedades=PropertiesService.getScriptProperties();
    var hojaId=propiedades.getProperty('HOJA_ID');
    if(!hojaId) return error_(503,'configuracion_no_valida');
    var libro=SpreadsheetApp.openById(hojaId);
    var hoja=libro.getSheetByName('Respuestas');
    if(!hoja || JSON.stringify(hoja.getRange(1,1,1,17).getValues()[0])!==JSON.stringify(PAUSA.encabezados)) return error_(503,'configuracion_no_valida');
    var id=p.id_entrega.toLowerCase();
    var valores=PAUSA.ids.map(function(n){return p.respuestas[String(n)];});
    var total=valores.reduce(function(a,b){return a+b;},0);
    var promedio=total/valores.length;
    var rango=Math.round(promedio);
    var ultima=hoja.getLastRow();
    var previa=null;
    if(ultima>1) previa=hoja.getRange(2,2,ultima-1,1).createTextFinder(id).matchEntireCell(true).findNext();
    if(previa) {
      var fila=hoja.getRange(previa.getRow(),1,1,17).getValues()[0];
      if(fila[2]!==p.actividad || fila[3]!==p.version || !valores.every(function(v,i){return fila[i+4]===v;})) return error_(409,'conflicto_id_entrega');
      return {status:200,body:{ok:true,duplicado:true,id_entrega:id,total:total,promedio:promedio,rango:rango}};
    }
    if(propiedades.getProperty('RECEPCION_ABIERTA')==='false') return error_(403,'actividad_no_disponible');
    if(ultima>=hoja.getMaxRows()) {
      hoja.insertRowsAfter(hoja.getMaxRows(),500);
      actualizarResumen_(libro,hoja.getMaxRows());
    }
    var ahora=new Date();
    hoja.getRange(ultima+1,1,1,17).setValues([[ahora,id,p.actividad,p.version].concat(valores,[total,promedio,rango])]);
    SpreadsheetApp.flush();
    return {status:201,body:{ok:true,duplicado:false,id_entrega:id,recibida_en:ahora.toISOString(),total:total,promedio:promedio,rango:rango}};
  } catch(error) {
    // El reintento usa el mismo UUID; si la fila se creó antes de un fallo, no se duplica.
    return error_(503,'servicio_no_disponible');
  } finally {
    bloqueo.releaseLock();
  }
}

function actualizarResumen_(libro,limite) {
  var r=libro.getSheetByName('Resumen');
  r.getRange('C4').setFormula("=COUNT('Respuestas'!$O$2:$O$"+limite+")");
  r.getRange('F4').setFormula("=IF(C4=0,\"\",AVERAGE('Respuestas'!$P$2:$P$"+limite+"))");
  r.getRange('E8:F12').setFormulas([8,9,10,11,12].map(function(fila){return [
    "=COUNTIFS('Respuestas'!$Q$2:$Q$"+limite+",B"+fila+")",
    '=IF($C$4=0,"",E'+fila+'/$C$4)'
  ];}));
  r.getRange('D17:D26').setFormulas(PAUSA.ids.map(function(id,i){
    var col=String.fromCharCode(69+i);
    return ["=IF($C$4=0,\"\",AVERAGE('Respuestas'!$"+col+'$2:$'+col+'$'+limite+'))'];
  }));
}

// Ejecutar una vez desde el editor antes de desplegar. No borra registros.
function preparar_() {
  var libro=SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('HOJA_ID',libro.getId());
  libro.setSpreadsheetTimeZone('America/Costa_Rica');
  var hoja=libro.getSheetByName('Respuestas');
  var filas=hoja.getMaxRows()-1;
  hoja.getRange(2,1,filas,17).setFontFamily('Arial').setFontSize(10);
  hoja.getRange(2,1,filas,1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  hoja.getRange(2,5,filas,11).setNumberFormat('0');
  hoja.getRange(2,16,filas,1).setNumberFormat('0.0');
  hoja.getRange(2,17,filas,1).setNumberFormat('0');
  actualizarResumen_(libro,hoja.getMaxRows());
  SpreadsheetApp.flush();
}

function cerrarRecepcion_() { PropertiesService.getScriptProperties().setProperty('RECEPCION_ABIERTA','false'); }
function abrirRecepcion_() { PropertiesService.getScriptProperties().setProperty('RECEPCION_ABIERTA','true'); }

// Menú disponible únicamente dentro de la hoja privada para sus editores.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Actividad')
    .addItem('Preparar hoja','preparar_')
    .addItem('Abrir recepción','abrirRecepcion_')
    .addItem('Cerrar recepción','cerrarRecepcion_')
    .addToUi();
}
