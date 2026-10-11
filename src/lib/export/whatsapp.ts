/**
 * WhatsApp order mode for static exports — no server at all.
 *
 * The landing runtime is reused as is (validation, packs, variants, totals, thank-you hand-off): its
 * order endpoint is a sentinel URL that a tiny export-only bridge intercepts in window.fetch. The
 * bridge composes the order message from the validated payload, opens wa.me (new tab / the app) and
 * answers the runtime like a successful order, so the shopper lands on the thank-you page — where a
 * floating glass card keeps a one-tap "open WhatsApp again" until the message is sent.
 *
 * Everything the bridge needs is public page data (#lp-config) plus #lp-wa (number + localized
 * labels). Text is inserted with textContent only.
 */
import type { Locale } from "@/lib/page/schema";

/** Order endpoint of WhatsApp exports (never fetched: the bridge answers it). */
export const WA_ENDPOINT = "whatsapp:order";

export interface WaLabels {
  order: string;
  ref: string;
  product: string;
  pack: string;
  options: string;
  extra: string;
  total: string;
  cod: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  note: string;
  email: string;
  /** thank-you card: after WhatsApp opened / when it could not open by itself */
  cardTitle: string;
  cardTitleNow: string;
  cardText: string;
  cardButton: string;
}

export interface WaCopy {
  labels: WaLabels;
  /** order button of the form */
  submit: string;
  /** thank-you page heading & lead in WhatsApp mode */
  thanksTitle: string;
  thanksMessage: string;
}

const COPY: Record<Locale, WaCopy> = {
  ar: {
    labels: {
      order: "طلب جديد",
      ref: "المرجع",
      product: "المنتج",
      pack: "العرض",
      options: "الاختيارات",
      extra: "إضافة",
      total: "المجموع",
      cod: "الدفع عند الاستلام",
      name: "الاسم",
      phone: "الهاتف",
      city: "المدينة",
      address: "العنوان",
      note: "ملاحظة",
      email: "البريد الإلكتروني",
      cardTitle: "لم ترسل الرسالة بعد؟",
      cardTitleNow: "أرسل طلبك عبر واتساب",
      cardText: "طلبك يصلنا فقط بعد إرسال رسالة واتساب.",
      cardButton: "افتح واتساب",
    },
    submit: "اطلب عبر واتساب",
    thanksTitle: "خطوة أخيرة: أرسل لنا الرسالة",
    thanksMessage: "رسالة طلبك جاهزة في واتساب — اضغط على «إرسال» لنؤكد طلبك ونشحنه إليك. الدفع عند الاستلام.",
  },
  fr: {
    labels: {
      order: "Nouvelle commande",
      ref: "Réf.",
      product: "Produit",
      pack: "Pack",
      options: "Options",
      extra: "En plus",
      total: "Total",
      cod: "paiement à la livraison",
      name: "Nom",
      phone: "Téléphone",
      city: "Ville",
      address: "Adresse",
      note: "Note",
      email: "E-mail",
      cardTitle: "Message pas encore envoyé ?",
      cardTitleNow: "Envoyez votre commande sur WhatsApp",
      cardText: "Votre commande nous parvient uniquement une fois le message WhatsApp envoyé.",
      cardButton: "Ouvrir WhatsApp",
    },
    submit: "Commander via WhatsApp",
    thanksTitle: "Plus qu’une étape : envoyez le message",
    thanksMessage: "Votre message de commande est prêt dans WhatsApp — appuyez sur « Envoyer » pour que nous puissions la confirmer et l’expédier. Paiement à la livraison.",
  },
  en: {
    labels: {
      order: "New order",
      ref: "Ref.",
      product: "Product",
      pack: "Pack",
      options: "Options",
      extra: "Add-on",
      total: "Total",
      cod: "cash on delivery",
      name: "Name",
      phone: "Phone",
      city: "City",
      address: "Address",
      note: "Note",
      email: "Email",
      cardTitle: "Haven’t sent it yet?",
      cardTitleNow: "Send your order on WhatsApp",
      cardText: "Your order reaches us only once the WhatsApp message is sent.",
      cardButton: "Open WhatsApp",
    },
    submit: "Order via WhatsApp",
    thanksTitle: "One last step: send the message",
    thanksMessage: "Your order message is ready in WhatsApp — tap send so we can confirm and ship it. You pay on delivery.",
  },
  es: {
    labels: {
      order: "Nuevo pedido",
      ref: "Ref.",
      product: "Producto",
      pack: "Pack",
      options: "Opciones",
      extra: "Extra",
      total: "Total",
      cod: "pago contra reembolso",
      name: "Nombre",
      phone: "Teléfono",
      city: "Ciudad",
      address: "Dirección",
      note: "Nota",
      email: "Email",
      cardTitle: "¿Aún no lo enviaste?",
      cardTitleNow: "Envía tu pedido por WhatsApp",
      cardText: "Tu pedido nos llega solo cuando envías el mensaje de WhatsApp.",
      cardButton: "Abrir WhatsApp",
    },
    submit: "Pedir por WhatsApp",
    thanksTitle: "Último paso: envía el mensaje",
    thanksMessage: "Tu mensaje de pedido está listo en WhatsApp — pulsa enviar para que podamos confirmarlo y enviarlo. Pagas a la entrega.",
  },
  de: {
    labels: {
      order: "Neue Bestellung",
      ref: "Ref.",
      product: "Produkt",
      pack: "Paket",
      options: "Optionen",
      extra: "Extra",
      total: "Gesamt",
      cod: "Zahlung bei Lieferung",
      name: "Name",
      phone: "Telefon",
      city: "Stadt",
      address: "Adresse",
      note: "Notiz",
      email: "E-Mail",
      cardTitle: "Noch nicht gesendet?",
      cardTitleNow: "Sende deine Bestellung per WhatsApp",
      cardText: "Deine Bestellung erreicht uns erst, wenn die WhatsApp-Nachricht gesendet ist.",
      cardButton: "WhatsApp öffnen",
    },
    submit: "Per WhatsApp bestellen",
    thanksTitle: "Letzter Schritt: Nachricht senden",
    thanksMessage: "Deine Bestellnachricht ist in WhatsApp bereit — tippe auf Senden, damit wir bestätigen und verschicken können. Du zahlst bei Lieferung.",
  },
  it: {
    labels: {
      order: "Nuovo ordine",
      ref: "Rif.",
      product: "Prodotto",
      pack: "Pacchetto",
      options: "Opzioni",
      extra: "Extra",
      total: "Totale",
      cod: "pagamento alla consegna",
      name: "Nome",
      phone: "Telefono",
      city: "Città",
      address: "Indirizzo",
      note: "Nota",
      email: "Email",
      cardTitle: "Non l’hai ancora inviato?",
      cardTitleNow: "Invia il tuo ordine su WhatsApp",
      cardText: "Il tuo ordine ci arriva solo quando invii il messaggio WhatsApp.",
      cardButton: "Apri WhatsApp",
    },
    submit: "Ordina su WhatsApp",
    thanksTitle: "Ultimo passo: invia il messaggio",
    thanksMessage: "Il messaggio del tuo ordine è pronto su WhatsApp — tocca invia così possiamo confermarlo e spedirlo. Paghi alla consegna.",
  },
  nl: {
    labels: {
      order: "Nieuwe bestelling",
      ref: "Ref.",
      product: "Product",
      pack: "Pakket",
      options: "Opties",
      extra: "Extra",
      total: "Totaal",
      cod: "betalen bij levering",
      name: "Naam",
      phone: "Telefoon",
      city: "Plaats",
      address: "Adres",
      note: "Notitie",
      email: "E-mail",
      cardTitle: "Nog niet verstuurd?",
      cardTitleNow: "Verstuur je bestelling via WhatsApp",
      cardText: "Je bestelling komt pas bij ons aan als het WhatsApp-bericht is verstuurd.",
      cardButton: "WhatsApp openen",
    },
    submit: "Bestel via WhatsApp",
    thanksTitle: "Laatste stap: verstuur het bericht",
    thanksMessage: "Je bestelbericht staat klaar in WhatsApp — tik op verzenden zodat we kunnen bevestigen en versturen. Je betaalt bij levering.",
  },
  pt: {
    labels: {
      order: "Nova encomenda",
      ref: "Ref.",
      product: "Produto",
      pack: "Pack",
      options: "Opções",
      extra: "Extra",
      total: "Total",
      cod: "pagamento na entrega",
      name: "Nome",
      phone: "Telefone",
      city: "Cidade",
      address: "Morada",
      note: "Nota",
      email: "Email",
      cardTitle: "Ainda não enviou?",
      cardTitleNow: "Envie a sua encomenda pelo WhatsApp",
      cardText: "O seu pedido só nos chega depois de enviar a mensagem do WhatsApp.",
      cardButton: "Abrir WhatsApp",
    },
    submit: "Encomendar pelo WhatsApp",
    thanksTitle: "Último passo: envie a mensagem",
    thanksMessage: "A mensagem da sua encomenda está pronta no WhatsApp — toque em enviar para podermos confirmar e enviar. Paga na entrega.",
  },
};

export function waCopy(locale: Locale): WaCopy {
  return COPY[locale] ?? COPY.en;
}

/** #lp-wa data (public): the number orders go to, the intercepted endpoint and the labels. */
export function waData(number: string, locale: Locale): { v: 1; endpoint: string; number: string; labels: WaLabels } {
  if (!/^[1-9][0-9]{7,14}$/.test(number)) throw new Error("export: invalid WhatsApp number");
  return { v: 1, endpoint: WA_ENDPOINT, number, labels: waCopy(locale).labels };
}

/**
 * The bridge (ES2017, no dependencies, ~2.5 KB). Landing page: intercepts the order POST, opens
 * WhatsApp with the composed message and answers { ok, orderId, total, currency }. Thank-you page:
 * shows the floating "open WhatsApp again" card for the order that was just placed.
 */
export const WA_BRIDGE_JS = String.raw`(function(){"use strict";
var d=document,w=window,KEY="lp-wa",NB=String.fromCharCode(160);
function data(id){var el=d.getElementById(id);if(!el)return null;try{return JSON.parse(el.textContent||"")}catch(e){return null}}
var wa=data("lp-wa"),cfg=data("lp-config");
if(!wa||wa.v!==1||!cfg||!wa.labels)return;
var L=wa.labels;
function clean(v,max){return String(v==null?"":v).replace(/[\u0000-\u001f\u007f]+/g," ").replace(/\s+/g," ").trim().slice(0,max)}
function r2(n){return Math.round(n*100)/100}
function money(n){var m=cfg.money||{},v=r2(isFinite(n)?n:0),dd=Math.max(0,Math.min(3,Math.floor(m.decimals)||0));if(dd===0&&Math.round(v*100)%100!==0)dd=2;var o={minimumFractionDigits:dd,maximumFractionDigits:dd},s;if(String(m.locale||"").indexOf("-nu-")<0)o.numberingSystem="latn";try{s=new Intl.NumberFormat(m.locale||"en",o).format(v)}catch(e){s=v.toFixed(dd)}var y=m.symbol||"";if(!y)return s;if(m.position==="before")return y+(y.length>1?NB:"")+s;return s+NB+y}
function find(list,id){for(var i=0;list&&i<list.length;i++)if(list[i].id===id)return list[i];return null}
function unitText(choice,shared){var out=[];for(var i=0;i<(cfg.variants||[]).length;i++){var g=cfg.variants[i],src=g.perUnit?choice:shared,o=find(g.options,src&&src[g.id]);if(o)out.push(o.label)}return out.join("/")}
function variantText(list){if(!list||!list.length)return"";var u=[];for(var i=0;i<list.length;i++){var t=unitText(list[i],list[0]);if(t)u.push(t)}if(!u.length)return"";for(var j=1;j<u.length;j++)if(u[j]!==u[0]){var x=[];for(var k=0;k<u.length;k++)x.push((k+1)+": "+u[k]);return x.join(" · ")}return u.length>1?u[0]+" ×"+u.length:u[0]}
function shown(name,value){var f=d.getElementById("order-form"),el=f&&f.querySelector('select[name="'+name+'"]');if(el&&el.selectedIndex>=0&&el.options[el.selectedIndex].value===value)return clean(el.options[el.selectedIndex].text,80);return clean(value,240)}
function newId(){var A="0123456789ABCDEFGHJKMNPQRSTVWXYZ",b=new Uint8Array(6),s="";if(w.crypto&&w.crypto.getRandomValues)w.crypto.getRandomValues(b);else for(var i=0;i<6;i++)b[i]=Math.floor(Math.random()*256);for(var j=0;j<6;j++)s+=A.charAt(b[j]%32);return"WA-"+s}
function line(label,value){return value?label+": "+value:""}
function compose(p,id){var b=find(cfg.bundles,p.bundleId);if(!b)return null;var bump=!!(p.bump&&cfg.bump),total=r2(r2(b.total+(bump?cfg.bump.price:0))+(cfg.shippingFee||0));
var top=["*"+L.order+"* · "+L.ref+" "+id,line(L.product,clean(cfg.product&&cfg.product.name,120)),line(L.pack,clean(b.label,120)),line(L.options,variantText(p.variants)),bump?line(L.extra,clean(cfg.bump.title,80)):"","*"+L.total+": "+money(total)+"* ("+L.cod+")"];
var who=[line(L.name,clean(p.name,80)),line(L.phone,clean(p.phone,24)),line(L.city,p.city?shown("city",p.city):""),line(L.address,clean(p.address,240)),line(L.note,clean(p.note,300)),line(L.email,clean(p.email,120))];
function keep(a){var o=[];for(var i=0;i<a.length;i++)if(a[i])o.push(a[i]);return o.join("\n")}
return{text:keep(top)+"\n\n"+keep(who),total:total}}
var IAB=/FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Bytedance|Snapchat|; wv\)/i;
function openWa(href){try{var t=w.open("","_blank");if(!t)return false;try{t.opener=null}catch(e){}t.location.href=href;return true}catch(e){return false}}
if(cfg.page==="landing"){
var native=w.fetch;if(typeof native!=="function"||typeof w.Response!=="function")return;
w.fetch=function(input,init){var url=typeof input==="string"?input:input&&input.url;if(url!==wa.endpoint)return native.apply(w,arguments);
try{var p=JSON.parse(String(init&&init.body||"{}")),id=newId(),m=compose(p,id);if(!m)return Promise.resolve(new w.Response(JSON.stringify({ok:false,error:"invalid",fields:{bundleId:"invalid"}}),{status:422,headers:{"content-type":"application/json"}}));
var href="https://wa.me/"+wa.number+"?text="+encodeURIComponent(m.text),opened=IAB.test(navigator.userAgent||"")?false:openWa(href),stored=false;
try{w.sessionStorage.setItem(KEY,JSON.stringify({orderId:id,href:href,opened:opened,ts:Date.now()}));stored=true}catch(e){}
if(!opened&&!stored){w.location.href=href;return new Promise(function(){})}
return Promise.resolve(new w.Response(JSON.stringify({ok:true,orderId:id,total:m.total,currency:cfg.currency}),{status:200,headers:{"content-type":"application/json"}}))}catch(e){return Promise.reject(e)}};
return}
if(cfg.page!=="thanks")return;
var rec=null;try{rec=JSON.parse(w.sessionStorage.getItem(KEY)||"null")}catch(e){}
var q=/[?&]o=([A-Za-z0-9-]{4,40})/.exec(w.location.search);
if(!rec||!q||rec.orderId!==q[1]||typeof rec.href!=="string"||rec.href.indexOf("https://wa.me/"+wa.number+"?text=")!==0)return;
function el(tag,cls,text){var e=d.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e}
var title=rec.opened?L.cardTitle:L.cardTitleNow,box=el("aside","lp-wa-cta");box.setAttribute("aria-label",title);if(!rec.opened)box.setAttribute("data-attention","");
var body=el("div","lp-wa-cta__body");body.appendChild(el("p","lp-wa-cta__title",title));body.appendChild(el("p","lp-wa-cta__text",L.cardText));
var a=el("a","lp-wa-cta__btn");a.href=rec.href;a.target="_blank";a.rel="noopener noreferrer";
var NS="http://www.w3.org/2000/svg",svg=d.createElementNS(NS,"svg"),path=d.createElementNS(NS,"path");svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");svg.setAttribute("class","lp-wa-cta__icon");
path.setAttribute("d","M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2Zm0 1.8a7.9 7.9 0 1 1-4.1 14.7l-.3-.2-2.9.8.8-2.8-.2-.3A7.9 7.9 0 0 1 12 4Zm-3.3 4.2c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.7s1.2 3.1 1.3 3.4c.2.2 2.3 3.6 5.6 4.9 2.8 1.1 3.3.9 3.9.8.6-.1 2-.8 2.2-1.6.3-.8.3-1.4.2-1.6-.1-.1-.3-.2-.6-.4l-2-1c-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.6-.7-.6h-.6Z");
svg.appendChild(path);a.appendChild(svg);a.appendChild(el("span","",L.cardButton));
a.addEventListener("click",function(){box.removeAttribute("data-attention");try{rec.opened=true;w.sessionStorage.setItem(KEY,JSON.stringify(rec))}catch(e){}});
box.appendChild(body);box.appendChild(a);d.body.appendChild(box);
})();`;

/** Floating glass card of the thank-you page (theme tokens, logical properties, reduced motion). */
export const WA_CARD_CSS = [
  ".lp-wa-cta{position:fixed;z-index:60;inset-inline:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));",
  "display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;max-inline-size:36rem;margin-inline:auto;padding:14px;padding-inline-start:20px;",
  "border-radius:calc(var(--lp-radius-l,20px) + 6px);border:1px solid var(--lp-line,rgba(0,0,0,.08));background:var(--lp-surface,#fff);color:var(--lp-ink,#111);",
  "box-shadow:0 1px 0 rgba(255,255,255,.55) inset,0 24px 60px -24px rgba(0,0,0,.38),0 8px 18px -10px rgba(0,0,0,.2);",
  "animation:lp-wa-in .8s var(--lp-ease-spring,cubic-bezier(.2,1.2,.3,1)) .35s both}",
  "@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){.lp-wa-cta{background:color-mix(in srgb,var(--lp-surface,#fff) 78%,transparent);",
  "-webkit-backdrop-filter:blur(20px) saturate(1.7);backdrop-filter:blur(20px) saturate(1.7)}}",
  ".lp-wa-cta__body{flex:1 1 14rem;min-inline-size:0}",
  ".lp-wa-cta__title{margin:0;font-family:var(--lp-font-body,system-ui);font-weight:650;font-size:.98rem;line-height:1.3}",
  ".lp-wa-cta__text{margin:.2rem 0 0;font-family:var(--lp-font-body,system-ui);font-size:.84rem;line-height:1.45;color:var(--lp-ink-soft,#555)}",
  ".lp-wa-cta__btn{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:.55rem;min-block-size:48px;padding-inline:1.15rem 1.35rem;",
  "border-radius:999px;background:var(--lp-accent,#1f8f4e);color:var(--lp-accent-ink,#fff);font-family:var(--lp-font-body,system-ui);font-weight:650;font-size:.95rem;",
  "text-decoration:none;box-shadow:0 10px 24px -12px var(--lp-accent,#1f8f4e);transition:transform .35s var(--lp-ease-spring,ease),box-shadow .35s ease}",
  ".lp-wa-cta__btn:hover{transform:translateY(-2px);box-shadow:0 16px 30px -14px var(--lp-accent,#1f8f4e)}",
  ".lp-wa-cta__btn:active{transform:scale(.97)}",
  ".lp-wa-cta__btn:focus-visible{outline:3px solid var(--lp-accent,#1f8f4e);outline-offset:3px}",
  ".lp-wa-cta__icon{inline-size:1.25em;block-size:1.25em;fill:currentColor}",
  ".lp-wa-cta[data-attention] .lp-wa-cta__btn{animation:lp-wa-pulse 2.2s ease-out 1.2s infinite}",
  "@keyframes lp-wa-in{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:none}}",
  "@keyframes lp-wa-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--lp-accent,#1f8f4e) 45%,transparent)}70%,100%{box-shadow:0 0 0 14px transparent}}",
  "@media (max-width:30rem){.lp-wa-cta__btn{flex:1 1 100%}}",
  "@media (prefers-reduced-motion:reduce){.lp-wa-cta,.lp-wa-cta[data-attention] .lp-wa-cta__btn{animation:none}.lp-wa-cta__btn{transition:none}}",
  "body.lp-body{padding-block-end:7.5rem}",
].join("");
