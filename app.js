/* «Elif · Aktifleş 90 Özel Danışmanlık» (OTO1 de Yogurt Bariatrico IT). Clonado de Lucas IA (Ayuno 2.0 AR).
   Clonado de Profe Martín 24/7: sin framework, fotos, cupo diario y conversación guardada en el celular.
   El servidor es la Edge Function «elif-ai-tr» de Supabase (meta-surfeo).
   Extra: guarda la última «📋 Mi ficha» en el celular para seguir en una charla nueva. */

const API = 'https://mrspggszwtvndlatsmxv.supabase.co/functions/v1/elif-ai-tr';
const LIMIT = 10;

const hilo        = document.getElementById('hilo');
const bienvenida  = document.getElementById('bienvenida');
const compositor  = document.getElementById('compositor');
const entrada     = document.getElementById('entrada');
const botonEnviar = document.getElementById('enviar');
const contador    = document.getElementById('contador');
const botonNuevo  = document.getElementById('nuevo');
const botonFoto   = document.getElementById('foto');
const archivo     = document.getElementById('archivo');
const adjunto     = document.getElementById('adjunto');
const adjuntoImg  = document.getElementById('adjunto-img');
const quitarFoto  = document.getElementById('quitar-foto');

let conversacion = [];      // [{ rol: 'usuario'|'asistente', texto, conFoto? }]
let respondiendo = false;
let fotoPendiente = null;   // { datos (base64), vista (dataURL) }

/* ── Tarayıcı Hafızası (try/catch ile: gizli modda bulunmayabilir) ── */
const CLAVE_GUARDADO = 'elif-ai-tr-chat-v1';
const CLAVE_CLIENTE  = 'elif-ai-tr-client-id';
const CLAVE_FICHA    = 'elif-ai-tr-scheda-v1';

function guardar() {
  try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(conversacion)); } catch {}
}
function recuperar() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_GUARDADO) || '[]');
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}
function idCliente() {
  let id = null;
  try { id = localStorage.getItem(CLAVE_CLIENTE); } catch {}
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    id = 'c' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(CLAVE_CLIENTE, id); } catch {}
  }
  return id;
}
const CLIENTE = idCliente();

/* ── Güvenli Metin: HTML'e girmeden önce her şeyi dönüştürün ── */
const escapar = (t) => t.replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function ocultarMarcadorSuelto(t) {
  for (const marca of ['**', '`']) {
    if ((t.split(marca).length - 1) % 2 === 1) {
      const i = t.lastIndexOf(marca);
      t = t.slice(0, i) + t.slice(i + marca.length);
    }
  }
  return t.replace(/\*$/, '');
}

function enLinea(t) {
  return t
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
}

function aHtml(texto, enCurso) {
  let t = escapar(texto);
  if (enCurso) t = ocultarMarcadorSuelto(t);

  let html = '', lista = null, parrafo = [];
  const cerrarParrafo = () => {
    if (parrafo.length) { html += '<p>' + parrafo.join('<br>') + '</p>'; parrafo = []; }
  };
  const cerrarLista = () => { if (lista) { html += `</${lista}>`; lista = null; } };

  for (const linea of t.split('\n')) {
    const titulo = linea.match(/^\s*#{1,6}\s+(.*)$/);
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(linea)) { cerrarParrafo(); cerrarLista(); continue; }
    if (titulo) {
      cerrarParrafo(); cerrarLista();
      html += `<p><strong>${enLinea(titulo[1].replace(/\*\*/g, ''))}</strong></p>`;
      continue;
    }
    const numerada = linea.match(/^\s*\d+[.)]\s+(.*)$/);
    const vineta   = linea.match(/^\s*[-*•]\s+(.*)$/);
    if (numerada) {
      cerrarParrafo();
      if (lista !== 'ol') { cerrarLista(); html += '<ol>'; lista = 'ol'; }
      html += `<li>${enLinea(numerada[1])}</li>`;
    } else if (vineta) {
      cerrarParrafo();
      if (lista !== 'ul') { cerrarLista(); html += '<ul>'; lista = 'ul'; }
      html += `<li>${enLinea(vineta[1])}</li>`;
    } else if (!linea.trim()) {
      cerrarParrafo(); cerrarLista();
    } else {
      cerrarLista(); parrafo.push(enLinea(linea));
    }
  }
  cerrarParrafo(); cerrarLista();
  return html;
}

/* ── Mesajları Oluşturma ── */
function agregarMensaje(quien, texto, clase) {
  const fila = document.createElement('div');
  fila.className = `mensaje de-${quien}` + (clase ? ` ${clase}` : '');
  const caja = document.createElement('div');
  caja.className = 'texto';
  caja.innerHTML = texto ? aHtml(texto, false) : '';
  fila.appendChild(caja);
  hilo.appendChild(fila);
  bajar();
  return caja;
}

function agregarMensajeConFoto(texto, vista) {
  const caja = agregarMensaje('usuario', '');
  if (vista) {
    const img = document.createElement('img');
    img.className = 'foto-enviada';
    img.alt = 'Fotoğrafınız';
    img.src = vista;
    img.addEventListener('load', bajar);
    caja.appendChild(img);
  } else {
    const nota = document.createElement('div');
    nota.className = 'foto-nota';
    nota.textContent = '📷 Fotoğraf gönderildi';
    caja.appendChild(nota);
  }
  if (texto) caja.insertAdjacentHTML('beforeend', aHtml(texto, false));
  bajar();
}

function puntitos(caja) {
  caja.innerHTML = '<span class="puntitos"><i></i><i></i><i></i></span>';
}

let pegadoAbajo = true;
hilo.addEventListener('scroll', () => {
  pegadoAbajo = hilo.scrollHeight - hilo.scrollTop - hilo.clientHeight < 80;
});
const bajar = () => { if (pegadoAbajo) hilo.scrollTop = hilo.scrollHeight; };

/* ── Günlük Sayaç ── */
function pintarContador(restantes, limite) {
  if (restantes === null || restantes === undefined) { contador.textContent = ''; return; }
  contador.textContent = restantes === 0
    ? 'Bugünlük mesaj hakkınız bitti'
    : `Bugün ${limite} mesajdan ${restantes} hakkınız kaldı`;
  contador.classList.toggle('pocas', restantes <= 2);
  entrada.disabled = restantes === 0;
  entrada.placeholder = restantes === 0 ? 'Yarın gece yarısı devam edeceğiz…' : 'Elif\'e yazın…';
}

async function cargarEstado() {
  try {
    const r = await fetch(`${API}?clientId=${encodeURIComponent(CLIENTE)}`);
    const d = await r.json();
    pintarContador(d.restantes, d.limite || LIMIT);
  } catch { pintarContador(null); }
}

/* ── Mesaj hakkı her gün 00:00'da yenilenir (Türkiye saati ile) ──
   Chat telefonda dünden açık kaldıysa, geri dönüldüğünde sunucuya tekrar sorulur;
   böylece giriş kutusu «Yarın gece yarısı devam edeceğiz…» şeklinde takılı kalmaz. */
const diaAR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
let diaVisto = diaAR();
function revisarDia() {
  if (respondiendo) return;
  diaVisto = diaAR();
  cargarEstado();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarDia(); });
window.addEventListener('focus', revisarDia);
window.addEventListener('pageshow', (e) => { if (e.persisted) revisarDia(); });
compositor.addEventListener('click', () => { if (entrada.disabled) revisarDia(); });
setInterval(() => { if (!document.hidden && (entrada.disabled || diaAR() !== diaVisto)) revisarDia(); }, 60_000);

/* ── Bilgi Formu: Elif bunu «📋 Bilgi formum: …» satırına yazar; telefona kaydederiz
   ve yeni sohbet başlatıldığında öneririz («Kaldığımız yerden devam et») + kopyalama butonu. ── */
const botonSeguir = document.getElementById('seguir-ficha');
const fichaVista  = document.getElementById('ficha-vista');

function extraerFicha(texto) {
  const m = texto.match(/📋\s*\**\s*Bilgi formum\s*:?\**\s*:?\s*([^\n]+)/i);
  return m ? ('📋 Bilgi formum: ' + m[1].replace(/\*\*/g, '').trim()) : null;
}
function fichaGuardada() {
  try { return localStorage.getItem(CLAVE_FICHA) || ''; } catch { return ''; }
}
function guardarFicha(f) {
  try { localStorage.setItem(CLAVE_FICHA, f); } catch {}
}
function mostrarSeguir() {
  const f = fichaGuardada();
  botonSeguir.hidden = !f;
  fichaVista.textContent = f.replace(/^📋 Bilgi formum:\s*/, '');
}
botonSeguir.addEventListener('click', () => {
  const f = fichaGuardada();
  if (f) enviar(f + '\nBuradan devam edelim.');
});

async function copiarTexto(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {}
  try {
    const a = document.createElement('textarea');
    a.value = t; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0';
    document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok;
  } catch { return false; }
}
function botonCopiarFicha(caja, ficha) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'copiar-ficha'; b.textContent = '📋 Bilgi formumu kopyala';
  b.addEventListener('click', async () => {
    b.textContent = (await copiarTexto(ficha)) ? '✓ Kopyalandı. Notlarınıza kaydedin' : 'Kopyalamak için metne basılı tutun';
  });
  caja.appendChild(b);
}

/* ── Fotoğraflar: Telefonda küçültme (maks. 1024 px, JPEG) ── */
const LADO_MAXIMO = 1024;

function cargarImagen(file) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('okunamıyor')); };
    img.src = url;
  });
}

async function prepararFoto(file) {
  const img = await cargarImagen(file);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(img.naturalWidth * escala);
  lienzo.height = Math.round(img.naturalHeight * escala);
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#fff';                       // şeffaf PNG'ler: beyaz arka plan
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  const vista = lienzo.toDataURL('image/jpeg', 0.85);
  return { datos: vista.split(',')[1], vista };
}

function mostrarAdjunto() {
  adjunto.hidden = !fotoPendiente;
  adjuntoImg.src = fotoPendiente ? fotoPendiente.vista : '';
}

botonFoto.addEventListener('click', () => archivo.click());

archivo.addEventListener('change', async () => {
  const file = archivo.files && archivo.files[0];
  archivo.value = '';
  if (!file) return;
  try {
    fotoPendiente = await prepararFoto(file);
    mostrarAdjunto();
    entrada.focus();
  } catch {
    fotoPendiente = null;
    mostrarAdjunto();
    agregarMensaje('asistente',
      'Bu fotoğrafı açamıyorum. Lütfen başka bir fotoğraf deneyin ' +
      'veya ekran görüntüsü alıp onu gönderin.', 'es-error');
  }
});

quitarFoto.addEventListener('click', () => { fotoPendiente = null; mostrarAdjunto(); });

/* ── Gönderme ve Alma ── */
async function enviar(pregunta) {
  const foto = fotoPendiente;
  if (respondiendo || entrada.disabled || (!pregunta.trim() && !foto)) return;
  respondiendo = true;
  botonEnviar.disabled = true;
  botonFoto.disabled = true;
  bienvenida.hidden = true;
  botonNuevo.hidden = false;
  fotoPendiente = null;
  mostrarAdjunto();

  const texto = pregunta.trim() || 'Bu fotoğrafa bak Elif.';
  if (foto) agregarMensajeConFoto(pregunta, foto.vista);
  else agregarMensaje('usuario', pregunta);

  const mensaje = { rol: 'usuario', texto };
  if (foto) mensaje.conFoto = true;
  conversacion.push(mensaje);

  const paraMandar = conversacion.map((m) => ({
    role: m.rol === 'usuario' ? 'user' : 'assistant',
    content: m.conFoto && m !== mensaje ? `[Fotoğraf gönderildi] ${m.texto}` : m.texto,
  }));

  const caja = agregarMensaje('asistente', '');
  puntitos(caja);

  let acumulado = '';
  let fallo = false;
  const mostrarError = (msg) => {
    fallo = true;
    caja.parentElement.classList.add('es-error');
    caja.innerHTML = aHtml(msg, false);
    acumulado = '';
    bajar();
  };

  try {
    const respuesta = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: paraMandar, image: foto ? foto.datos : undefined, clientId: CLIENTE }),
    });

    const tipo = respuesta.headers.get('content-type') || '';
    if (!respuesta.ok || !tipo.includes('text/event-stream')) {
      let d = {};
      try { d = await respuesta.json(); } catch {}
      mostrarError(d.error || 'Bir şeyler ters gitti. Lütfen birazdan tekrar deneyin.');
      if (d.sin_cupo) pintarContador(0, LIMIT);
    } else {
      const lector = respuesta.body.getReader();
      const decodificador = new TextDecoder();
      let resto = '';
      while (true) {
        const { done, value } = await lector.read();
        if (done) break;
        resto += decodificador.decode(value, { stream: true });
        const trozos = resto.split('\n\n');
        resto = trozos.pop();
        for (const trozo of trozos) {
          if (!trozo.startsWith('data: ')) continue;
          let dato;
          try { dato = JSON.parse(trozo.slice(6)); } catch { continue; }
          if (dato.tipo === 'delta') {
            acumulado += dato.texto;
            caja.innerHTML = aHtml(acumulado, true);
            bajar();
          } else if (dato.tipo === 'error') {
            mostrarError(dato.mensaje);
          } else if (dato.tipo === 'fin') {
            pintarContador(dato.restantes, dato.limite || LIMIT);
          }
        }
      }
    }
  } catch {
    mostrarError('Bağlantı tamamlanmadan kesildi. ' +
      'İnternet bağlantınızı kontrol edip tekrar deneyin.');
  }

  if (acumulado) {
    caja.innerHTML = aHtml(acumulado, false);
    conversacion.push({ rol: 'asistente', texto: acumulado });
    const ficha = extraerFicha(acumulado);
    if (ficha) { guardarFicha(ficha); botonCopiarFicha(caja, ficha); }
  } else if (fallo) {
    // Cevap alınamadığında soru listeden çıkarılır: böylece bir sonraki denemede üst üste iki soru yer almaz.
    conversacion.pop();
    if (foto) { fotoPendiente = foto; mostrarAdjunto(); }
  }
  guardar();

  respondiendo = false;
  botonEnviar.disabled = false;
  botonFoto.disabled = false;
  if (!entrada.disabled) entrada.focus();
}

/* ── Yeni Sohbet ── */
botonNuevo.addEventListener('click', () => {
  if (respondiendo) return;
  if (conversacion.length &&
      !confirm('Yeni bir sohbet başlatılsın mı? Bu konuşma telefonunuzdan silinecektir (bilgi formunuz kayıtlı kalır).')) return;
  conversacion = [];
  guardar();
  hilo.querySelectorAll('.mensaje').forEach((m) => m.remove());
  bienvenida.hidden = false;
  botonNuevo.hidden = true;
  mostrarSeguir();
  fotoPendiente = null;
  mostrarAdjunto();
  if (!entrada.disabled) entrada.focus();
});

/* ── Giriş Alanı ── */
function acomodarAlto() {
  entrada.style.height = 'auto';
  entrada.style.height = Math.min(entrada.scrollHeight, 160) + 'px';
}
entrada.addEventListener('input', acomodarAlto);

/* Enter gönderir, Shift+Enter yeni satır ekler. */
entrada.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); compositor.requestSubmit(); }
});

compositor.addEventListener('submit', (e) => {
  e.preventDefault();
  const pregunta = entrada.value.trim();
  if (!pregunta && !fotoPendiente) return;
  entrada.value = '';
  acomodarAlto();
  enviar(pregunta);
});

document.querySelectorAll('.sugerencia').forEach((b) => {
  b.addEventListener('click', () => enviar(b.textContent.trim()));
});

/* ── Açılışta: Kaydedilen konuşmayı tekrar ekrana çiz ── */
conversacion = recuperar().filter((m) => m && typeof m.texto === 'string');
if (conversacion.length) {
  bienvenida.hidden = true;
  botonNuevo.hidden = false;
  for (const m of conversacion) {
    if (m.rol === 'usuario' && m.conFoto) agregarMensajeConFoto(m.texto, null);
    else {
      const caja = agregarMensaje(m.rol === 'usuario' ? 'usuario' : 'asistente', m.texto);
      const ficha = m.rol !== 'usuario' && extraerFicha(m.texto);
      if (ficha) botonCopiarFicha(caja, ficha);
    }
  }
  hilo.scrollTop = hilo.scrollHeight;
}

mostrarSeguir();
cargarEstado();