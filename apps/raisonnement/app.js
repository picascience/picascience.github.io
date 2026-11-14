(function(){
'use strict';
var D=window.DATA,K='raisonnement:';
function get(k,d){try{var v=localStorage.getItem(K+k);return v==null?d:JSON.parse(v)}catch(e){return d}}
function set(k,v){try{localStorage.setItem(K+k,JSON.stringify(v))}catch(e){}}
function $(id){return document.getElementById(id)}
function all(el,s){return [].slice.call(el.querySelectorAll(s))}
var MATH={delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],throwOnError:false};
function tex(el){if(window.renderMathInElement){try{renderMathInElement(el,MATH)}catch(e){}}}
function put(el,h){el.innerHTML=h;tex(el)}
function fmt(p){return String(p).replace('.',',')}
/* mélange stable (même ordre à chaque visite) */
function seeded(arr,seed){var h=0,i;for(i=0;i<seed.length;i++)h=(h*31+seed.charCodeAt(i))|0;
 var a=arr.slice();for(i=a.length-1;i>0;i--){h=(h*1103515245+12345)|0;var j=Math.abs(h)%(i+1),t=a[i];a[i]=a[j];a[j]=t}return a}
function shuf(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}

/* ---------- Onglets ---------- */
function tab(t){all(document,'nav button').forEach(function(b){b.classList.toggle('on',b.dataset.t===t)});
 all(document,'main section').forEach(function(s){s.classList.toggle('on',s.id===t)});set('tab',t);window.scrollTo(0,0)}
$('nav').addEventListener('click',function(e){var b=e.target.closest('button');if(b)tab(b.dataset.t)});

/* ================= 1. DÉCODEUR ================= */
var decMode=get('decMode','see');
function drawDec(){var el=$('dec'),h='';
 h+='<div class="seg" id="decSeg"><button data-m="see"'+(decMode==='see'?' class="on"':'')+'>Si je vois → je fais</button><button data-m="not"'+(decMode==='not'?' class="on"':'')+'>Notions en 3 lignes</button><button data-m="plan"'+(decMode==='plan'?' class="on"':'')+'>Plan</button></div>';
 if(decMode==='plan'){D.plan.forEach(function(x){h+='<div class="card"><h2>'+x.t+'</h2>'+x.h+'</div>'})}
 else if(decMode==='see'){
  h+='<p class="small mut" style="margin:0 0 10px">Lis l\'énoncé, dis la méthode <b>à voix haute</b>, puis touche la carte pour vérifier. <a href="#" id="decAll" style="color:var(--acc)">Tout ouvrir</a></p>';
  D.decodeur.forEach(function(x,i){h+='<div class="card dec" data-i="'+i+'"><span class="tag">'+x.ex+'</span><div class="see">'+x.see+'</div><div class="hintx">Touche pour voir la méthode</div><div class="ans"><div><span class="lbl">Je fais</span>'+x.do+'</div><span class="first"><span class="lbl" style="color:var(--gold)">1ʳᵉ ligne</span>'+x.first+'</span></div></div>'});
 } else {
  D.notions.forEach(function(x){h+='<div class="card"><h2>'+x.t+'</h2><div>'+x.h+'</div><span class="ana"><span class="lbl" style="color:var(--gold)">Image</span>'+x.a+'</span></div>'});
 }
 put(el,h);
 $('decSeg').onclick=function(e){var b=e.target.closest('button');if(!b)return;decMode=b.dataset.m;set('decMode',decMode);drawDec()};
 all(el,'.dec').forEach(function(c){c.onclick=function(){c.classList.toggle('open')}});
 var a=$('decAll');if(a)a.onclick=function(e){e.preventDefault();var cs=all(el,'.dec'),open=cs.some(function(c){return !c.classList.contains('open')});cs.forEach(function(c){c.classList.toggle('open',open)});a.textContent=open?'Tout fermer':'Tout ouvrir'};
}

/* ================= 2. RÉDACTIONS À TROUS ================= */
var holes=get('holes',false);
function kw(s){return s.replace(/\[\[(.+?)\]\]/g,'<span class="kw">$1</span>')}
function rdCard(x,i,pre){return '<div class="card rd" data-i="'+pre+i+'"><div class="head"><div><h2>'+x.t+'</h2><div class="small mut">'+x.w+'</div></div><svg class="i chev" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="body">'+
 x.L.map(function(l,k){return '<div class="ln"><span class="n">'+(k+1)+'</span><div>'+kw(l)+'</div></div>'}).join('')+'<div class="srcl">Source : '+x.src+'</div></div></div>'}
function drawRed(){var el=$('red'),h='';
 h+='<div class="seg" id="rdSeg"><button data-h="0"'+(!holes?' class="on"':'')+'>Mots-clés surlignés</button><button data-h="1"'+(holes?' class="on"':'')+'>Mode trous</button></div>';
 h+='<p class="small mut" style="margin:0 0 10px">'+(holes?'Récite chaque trou de tête, puis touche-le pour vérifier.':'En <span class="kw">doré</span> : les mots qui déclenchent les points au barème. Ouvre une carte, lis, passe en mode trous.')+'</p>';
 h+='<div id="rdList"'+(holes?' class="holes"':'')+'>'+D.redac.map(function(x,i){return rdCard(x,i,'')}).join('');
 h+='<div class="h3">Hors annales · squelettes de secours</div>'+D.redacBonus.map(function(x,i){return rdCard(x,i,'b')}).join('')+'</div>';
 var open=all(el,'.rd.open').map(function(c){return c.dataset.i});
 put(el,h);
 all(el,'.rd').forEach(function(c){if(open.indexOf(c.dataset.i)>=0)c.classList.add('open');c.querySelector('.head').onclick=function(){c.classList.toggle('open')}});
 all(el,'.kw').forEach(function(k){k.onclick=function(e){if(holes){e.stopPropagation();k.classList.add('shown')}}});
 $('rdSeg').onclick=function(e){var b=e.target.closest('button');if(!b)return;holes=b.dataset.h==='1';set('holes',holes);drawRed()};
}

/* ================= 3. SPEEDRUN ================= */
var EX=D.exos,byId={};EX.forEach(function(x){byId[x.id]=x});
var S=get('sr',{ans:{},rev:[],f:'all',cur:null,show:{}});
if(!S.ans)S.ans={};if(!S.rev)S.rev=[];if(!S.show)S.show={};
function save(){set('sr',S)}
function isRev(id){return S.rev.indexOf(id)>=0}
function setRev(id,on){var i=S.rev.indexOf(id);if(on&&i<0)S.rev.push(id);if(!on&&i>=0)S.rev.splice(i,1)}
function state(id){var a=S.ans[id];if(!a||a.m==null)return 'new';if(a.l==null)return 'half';return(a.m===0&&a.l===0)?'ok':'ko'}
function list(){var f=S.f;return EX.filter(function(x){
 if(f==='rev')return isRev(x.id);if(f==='a')return x.k==='a';if(f==='v')return x.k==='v';if(f==='todo')return state(x.id)!=='ok';return true}).map(function(x){return x.id})}
function drawSr(){var el=$('sr'),L=list(),nOk=EX.filter(function(x){return state(x.id)==='ok'}).length,h='';
 var F=[['all','Tout',EX.length],['rev','À revoir',S.rev.length],['todo','Pas réussis',EX.length-nOk],['a','Annales',EX.filter(function(x){return x.k==='a'}).length],['v','Inédits',EX.filter(function(x){return x.k==='v'}).length]];
 h+='<div class="chips" id="srF">'+F.map(function(f){return '<button class="chip'+(S.f===f[0]?' on':'')+'" data-f="'+f[0]+'">'+f[1]+' · '+f[2]+'</button>'}).join('')+'</div>';
 h+='<div class="meta"><span>'+nOk+' / '+EX.length+' réussis du premier coup</span><a href="#" id="srReset" style="color:var(--mut)">Remettre à zéro</a></div><div class="prog"><i style="width:'+(100*nOk/EX.length)+'%"></i></div>';
 if(!L.length){h+='<div class="empty">'+(S.f==='rev'?'Rien à revoir pour l\'instant.<br>Les exos ratés arrivent ici automatiquement.':'Aucun exercice ici.')+'</div>';put(el,h);bindSrTop();return}
 if(L.indexOf(S.cur)<0)S.cur=L[0];
 var i=L.indexOf(S.cur),x=byId[S.cur],a=S.ans[x.id]||{},sh=S.show[x.id]||{};
 h+='<div class="row3"><button class="navb" id="pv" aria-label="Précédent">‹</button><div class="center small mut">Exo '+(i+1)+' / '+L.length+' · <a href="#" id="mix" style="color:var(--acc)">mélanger</a></div><button class="navb" id="nx" aria-label="Suivant">›</button></div>';
 h+='<div class="card"><span class="tag'+(x.k==='v'?' v':'')+'">'+x.src+'</span><span class="tag g">≈ '+fmt(x.pts)+' pt'+(x.pts>1?'s':'')+'</span><div class="big" style="margin-top:4px">'+x.q+'</div></div>';
 /* étape 1 : méthode */
 var mo=seeded([0,1,2,3],x.id+'m');
 h+='<div class="card"><div class="step">① Quelle méthode ?</div>';
 mo.forEach(function(c,k){var cl='ch';if(a.m!=null){if(c===0)cl+=' ok';else if(c===a.m)cl+=' ko'}
  h+='<button class="'+cl+'" data-s="m" data-c="'+c+'"'+(a.m!=null?' disabled':'')+'><b>'+'ABCD'[k]+'</b>'+D.M[x.m[c]]+'</button>'});
 if(a.m!=null)h+='<div class="fb '+(a.m===0?'ok':'ko')+'"><b>'+(a.m===0?'Oui.':'Non.')+'</b> '+x.mw+'</div>';
 h+='</div>';
 /* étape 2 : première ligne */
 if(a.m!=null){var lo=seeded([0,1,2],x.id+'l');
  h+='<div class="card"><div class="step">② Toute première ligne à écrire ?</div>';
  lo.forEach(function(c,k){var cl='ch';if(a.l!=null){if(c===0)cl+=' ok';else if(c===a.l)cl+=' ko'}
   h+='<button class="'+cl+'" data-s="l" data-c="'+c+'"'+(a.l!=null?' disabled':'')+'><b>'+'ABC'[k]+'</b>'+x.l[c]+'</button>'});
  if(a.l!=null)h+='<div class="fb '+(a.l===0?'ok':'ko')+'"><b>'+(a.l===0?'Oui, c\'est la ligne qui ouvre les points.':'Non.')+'</b>'+(x.lw?' '+x.lw:'')+'</div>';
  h+='</div>'}
 /* indice + corrigé */
 h+='<div class="row"><button class="btn alt sm" id="bH">'+(sh.h?'Masquer l\'indice':'Indice minimal')+'</button><button class="btn alt sm" id="bS">'+(sh.s?'Masquer le corrigé':'Corrigé + points')+'</button></div>';
 if(sh.h)h+='<div class="reveal"><span class="lbl" style="color:var(--gold)">Indice</span>'+x.hint+'</div>';
 if(sh.s)h+='<div class="reveal bar"><span class="lbl">Corrigé</span><div>'+x.sol+'</div><table>'+x.bar.map(function(b){return '<tr><td class="p">'+fmt(b[0])+' pt</td><td>'+b[1]+'</td></tr>'}).join('')+'</table><div class="srcl">'+(x.k==='a'?'Total de la question estimé à partir du barème officiel de l\'exercice ; découpage indicatif.':'Variante inédite : barème indicatif, style CC.')+'</div></div>';
 h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:4px 0 12px"><button class="rev'+(isRev(x.id)?' on':'')+'" id="bR"><svg class="i" viewBox="0 0 16 16"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="'+(isRev(x.id)?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>À revoir</button><button class="rev" id="bZ">Refaire cet exo</button></div>';
 if(a.l!=null)h+='<button class="btn" id="bN">'+(i+1<L.length?'Exo suivant':'Revenir au premier')+'</button>';
 put(el,h);bindSrTop();
 function go(d){var j=(i+d+L.length)%L.length;S.cur=L[j];save();drawSr();window.scrollTo(0,0)}
 $('pv').onclick=function(){go(-1)};$('nx').onclick=function(){go(1)};
 $('mix').onclick=function(e){e.preventDefault();S.cur=shuf(L)[0];save();drawSr()};
 all(el,'.ch[data-s]').forEach(function(b){b.onclick=function(){var s=b.dataset.s,c=+b.dataset.c,A=S.ans[x.id]||(S.ans[x.id]={});
  if(A[s]!=null)return;A[s]=c;if(c!==0)setRev(x.id,true);save();drawSr();
  if(s==='m'){var cards=all($('sr'),'.card');var t=cards[cards.length-1];if(t&&t.scrollIntoView)t.scrollIntoView({behavior:'smooth',block:'nearest'})}}});
 $('bH').onclick=function(){sh.h=!sh.h;S.show[x.id]=sh;save();drawSr()};
 $('bS').onclick=function(){sh.s=!sh.s;S.show[x.id]=sh;save();drawSr()};
 $('bR').onclick=function(){setRev(x.id,!isRev(x.id));save();drawSr()};
 $('bZ').onclick=function(){delete S.ans[x.id];delete S.show[x.id];save();drawSr()};
 var bn=$('bN');if(bn)bn.onclick=function(){go(1)};
}
function bindSrTop(){
 $('srF').onclick=function(e){var b=e.target.closest('button');if(!b)return;S.f=b.dataset.f;save();drawSr()};
 $('srReset').onclick=function(e){e.preventDefault();if(confirm('Effacer toutes tes réponses du Speedrun (la liste « À revoir » est gardée) ?')){S.ans={};S.show={};save();drawSr()}};
}

/* ================= 4. RADAR À PIÈGES ================= */
var P=get('pg',{mode:'vf',vf:{},er:{},only:false,i:{vf:0,er:0}});
if(!P.i)P.i={vf:0,er:0};
function psave(){set('pg',P)}
function pIds(kind){var src=kind==='vf'?D.vf:D.err,res=P[kind];return src.map(function(_,i){return i}).filter(function(i){return !P.only||res[i]===0})}
function drawPg(){var el=$('pg'),m=P.mode,src=m==='vf'?D.vf:D.err,res=P[m],ids=pIds(m),h='';
 var done=Object.keys(res).length,ok=Object.keys(res).filter(function(k){return res[k]===1}).length,bad=Object.keys(res).filter(function(k){return res[k]===0}).length;
 h+='<div class="seg" id="pgSeg"><button data-m="vf"'+(m==='vf'?' class="on"':'')+'>Vrai ou faux</button><button data-m="er"'+(m==='er'?' class="on"':'')+'>Trouve l\'erreur</button></div>';
 h+='<div class="chips"><button class="chip'+(!P.only?' on':'')+'" data-o="0">Tout · '+src.length+'</button><button class="chip'+(P.only?' on':'')+'" data-o="1">Mes ratés · '+bad+'</button></div>';
 h+='<div class="meta"><span>'+ok+' juste(s) sur '+done+' tenté(s)</span><a href="#" id="pgReset" style="color:var(--mut)">Remettre à zéro</a></div><div class="prog"><i style="width:'+(100*ok/src.length)+'%"></i></div>';
 if(!ids.length){h+='<div class="empty">'+(P.only?'Aucun raté. Propre.':'Rien ici.')+'</div>';put(el,h);bindPg();return}
 var pos=P.i[m]%ids.length,id=ids[pos],it=src[id],r=res[id],answered=P.cur===m+id&&r!=null;
 h+='<div class="row3"><button class="navb" id="ppv">‹</button><div class="center small mut">'+(pos+1)+' / '+ids.length+'</div><button class="navb" id="pnx">›</button></div>';
 if(m==='vf'){
  h+='<div class="card"><div class="big">'+it.s+'</div></div>';
  if(!answered)h+='<div class="row"><button class="btn" data-v="1" style="background:var(--ok)">Vrai</button><button class="btn" data-v="0" style="background:var(--ko)">Faux</button></div>';
  else h+='<div class="fb '+(r?'ok':'ko')+'"><b>'+(r?'Bien vu':'Raté')+' : c\'est '+(it.a?'VRAI':'FAUX')+'.</b> '+it.e+'</div>';
 } else {
  h+='<div class="card"><span class="tag g">Copie à corriger</span><div class="big" style="margin-top:4px">'+it.t+'</div><p class="small mut" style="margin:6px 0 0">Touche la ligne fautive.</p></div><div class="copy">';
  it.L.forEach(function(l,k){var cl='ch';if(answered){if(k===it.w)cl+=' ok';else if(k===P.pick)cl+=' ko'}
   h+='<button class="'+cl+'" data-k="'+k+'"'+(answered?' disabled':'')+'><b>'+(k+1)+'</b>'+l+'</button>'});
  h+='</div>';
  if(answered)h+='<div class="fb '+(r?'ok':'ko')+'"><b>'+(r?'Trouvé.':'Non : c\'est la ligne '+(it.w+1)+'.')+'</b> '+it.e+'</div>';
 }
 if(answered)h+='<button class="btn" id="pN" style="margin-top:8px">Suivant</button>';
 put(el,h);bindPg();
 function go(d){P.i[m]=(pos+d+ids.length)%ids.length;P.cur=null;psave();drawPg();window.scrollTo(0,0)}
 $('ppv').onclick=function(){go(-1)};$('pnx').onclick=function(){go(1)};
 all(el,'[data-v]').forEach(function(b){b.onclick=function(){res[id]=(+b.dataset.v===it.a)?1:0;P.cur=m+id;psave();drawPg()}});
 all(el,'[data-k]').forEach(function(b){b.onclick=function(){var k=+b.dataset.k;P.pick=k;res[id]=k===it.w?1:0;P.cur=m+id;psave();drawPg()}});
 var n=$('pN');if(n)n.onclick=function(){var wasOnly=P.only&&res[id]===1;if(wasOnly){P.cur=null;psave();drawPg()}else go(1)};
}
function bindPg(){var el=$('pg');
 $('pgSeg').onclick=function(e){var b=e.target.closest('button');if(!b)return;P.mode=b.dataset.m;P.cur=null;psave();drawPg()};
 all(el,'[data-o]').forEach(function(b){b.onclick=function(){P.only=b.dataset.o==='1';P.i[P.mode]=0;P.cur=null;psave();drawPg()}});
 $('pgReset').onclick=function(e){e.preventDefault();if(confirm('Effacer tes réponses de cet onglet ?')){P[P.mode]={};P.i[P.mode]=0;P.cur=null;psave();drawPg()}};
}

/* ---------- Démarrage ---------- */
drawDec();drawRed();drawSr();drawPg();
tab(get('tab','dec'));
})();
