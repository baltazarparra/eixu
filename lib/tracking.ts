/**
 * Script de atribuição embutido no site do tenant.
 * Sem dependências, sem requisição extra, roda antes de qualquer interação.
 * Guarda primeiro e último toque e alimenta o campo oculto dos formulários.
 */
export function attributionScript(tenantSlug: string, pagePath: string): string {
  return `(function(){
try{
var P=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','ttclid','msclkid'];
var q=new URLSearchParams(location.search);var cur={};
P.forEach(function(k){var v=q.get(k);if(v)cur[k]=v;});
if(document.referrer&&location.hostname!==new URL(document.referrer).hostname)cur.referrer=document.referrer;
var LS=window.localStorage;
var first=null;try{first=JSON.parse(LS.getItem('eixu_first')||'null');}catch(e){}
var PATH=${JSON.stringify(pagePath)};
if(!first&&Object.keys(cur).length){cur.landing=PATH;LS.setItem('eixu_first',JSON.stringify(cur));first=cur;}
var last=Object.keys(cur).length?cur:null;
if(last){last.landing=PATH;LS.setItem('eixu_last',JSON.stringify(last));}
else{try{last=JSON.parse(LS.getItem('eixu_last')||'null');}catch(e){}}
var sid=LS.getItem('eixu_sid');
if(!sid){sid=Math.random().toString(36).slice(2)+Date.now().toString(36);LS.setItem('eixu_sid',sid);}
var attr=Object.assign({},last||{},{first:first||undefined});
var payload=JSON.stringify(attr);
document.querySelectorAll('input[data-attribution]').forEach(function(i){i.value=payload;});
function send(type,extra){
  try{
    var body=JSON.stringify({tenant:${JSON.stringify(tenantSlug)},type:type,path:PATH,session:sid,source:attr,extra:extra||null});
    if(navigator.sendBeacon)navigator.sendBeacon('/api/e',new Blob([body],{type:'application/json'}));
    else fetch('/api/e',{method:'POST',body:body,headers:{'content-type':'application/json'},keepalive:true});
  }catch(e){}
}
send('page_view');
document.addEventListener('click',function(e){
  var a=e.target&&e.target.closest?e.target.closest('a'):null;if(!a)return;
  var t=a.getAttribute('data-track');
  if(t==='whatsapp')send('whatsapp_click',{href:a.getAttribute('href')});
  else if((a.getAttribute('href')||'').indexOf('tel:')===0)send('phone_click');
},true);
}catch(e){}
})();`;
}
