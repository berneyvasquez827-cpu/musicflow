const firebaseConfig = {
    apiKey: "AIzaSyCOYRDnksd3HmiATlMUdAG_uF2MZMi7qVE",
    databaseURL: "https://musicflow-banda-default-rtdb.firebaseio.com"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const escala = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
let cancionesLocales = [];
let zoomActual = 1.15;

function ajustarZoom(v) {
    zoomActual += v;
    if (zoomActual < 0.5) zoomActual = 0.5;
    const visor = document.getElementById('letra-acordes');
    if(visor) visor.style.fontSize = zoomActual + "rem";
}

function motorTransporte(texto, tOrig, tCant) {
    if (!texto) return "";
    const diff = (parseInt(tCant) - parseInt(tOrig) + 12) % 12;
    if (diff === 0 || isNaN(diff)) return texto;
    const regex = /\b([A-G][#b]?)(m?7?M?4?2?v?(\/[A-G][#b]?)?)\b/g;
    return texto.replace(regex, (match, nota, resto) => {
        let i = escala.indexOf(nota.toUpperCase());
        if (i === -1) return match;
        let n = escala[(i + diff) % 12];
        let b = resto.replace(/\/([A-G][#b]?)/g, (m, baj) => {
            let bi = escala.indexOf(baj.toUpperCase());
            return "/" + (bi === -1 ? baj : escala[(bi + diff) % 12]);
        });
        return `<span class="chord">${n}${b}</span>`;
    });
}

db.ref('musica_activa').on('value', snap => {
    const d = snap.val(); if (!d || !d.cancion) return;
    const s = d.cancion;
    const tActual = d.tono !== undefined ? d.tono : (s.tonoBase || 0);
    document.getElementById('titulo-cancion').innerText = s.titulo;
    document.getElementById('info-cantante').innerText = s.cantante || "--";
    document.getElementById('info-tono').innerText = escala[tActual] || "--";
    document.getElementById('tono-actual').innerText = escala[tActual] || "C";
    const visor = document.getElementById('letra-acordes');
    visor.innerHTML = motorTransporte(s.cuerpo, s.tonoOriginalRegistrado || 0, tActual);
    visor.style.fontSize = zoomActual + "rem";
});

async function importarPDF(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let textoFinal = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const items = content.items.sort((a, b) => (b.transform[5] - a.transform[5]) || (a.transform[4] - b.transform[4]));
            let lastY = items[0]?.transform[5];
            for (let item of items) {
                if (Math.abs(lastY - item.transform[5]) > 5) textoFinal += "\n";
                textoFinal += item.str + " ";
                lastY = item.transform[5];
            }
        }
        document.getElementById('input-cuerpo').value = textoFinal.trim();
    };
    reader.readAsArrayBuffer(file);
}

// BIBLIOTECA: RECUPERANDO EDITAR Y ELIMINAR
db.ref('catalogo').on('value', snap => {
    cancionesLocales = [];
    snap.forEach(i => { let c = i.val(); c.id = i.key; cancionesLocales.push(c); });
    filtrarBiblioteca();
});

function filtrarBiblioteca() {
    const txt = document.getElementById('buscar-biblioteca').value.toLowerCase();
    const list = document.getElementById('lista-catalogo');
    list.innerHTML = "";
    
    cancionesLocales.forEach(s => {
        if (s.titulo.toLowerCase().includes(txt)) {
            const item = document.createElement('div');
            // Estilo de fila profesional
            item.style = "display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #333; background: #1a1a1a; margin-bottom: 4px; border-radius: 4px;";
            
            item.innerHTML = `
                <span style="font-weight: bold; flex-grow: 1;">${s.titulo}</span>
                <div style="display: flex; gap: 8px;">
                    <button onclick='agregarAlSetlist("${s.id}")' style="background:none; border:1px solid #444; color:white; cursor:pointer; padding: 5px;">➕</button>
                    <button onclick='editarCancion("${s.id}")' style="background:none; border:1px solid #444; color:white; cursor:pointer; padding: 5px;">✏️</button>
                    <button onclick='eliminarCancion("${s.id}")' style="background:none; border:1px solid #444; color:white; cursor:pointer; padding: 5px;">🗑️</button>
                </div>`;
            list.appendChild(item);
        }
    });
}

function agregarAlSetlist(id) {
    const cancion = cancionesLocales.find(c => c.id === id);
    if(cancion) db.ref("setlist").push(cancion);
}

function editarCancion(id) {
    const s = cancionesLocales.find(c => c.id === id);
    if(s) {
        document.getElementById('edit-id').value = s.id;
        document.getElementById('input-titulo').value = s.titulo;
        document.getElementById('input-cantante').value = s.cantante || "";
        document.getElementById('input-tono-original').value = s.tonoOriginalRegistrado || 0;
        document.getElementById('input-tono-cantante').value = s.tonoBase || 0;
        document.getElementById('input-cuerpo').value = s.cuerpo;
        window.scrollTo(0, 0);
    }
}

function eliminarCancion(id) {
    if(confirm("¿Seguro que quieres eliminar esta canción de la biblioteca?")) {
        db.ref('catalogo/' + id).remove();
    }
}

async function handleGuardar() {
    const id = document.getElementById('edit-id').value;
    const song = {
        titulo: document.getElementById('input-titulo').value,
        cantante: document.getElementById('input-cantante').value,
        tonoOriginalRegistrado: parseInt(document.getElementById('input-tono-original').value),
        tonoBase: parseInt(document.getElementById('input-tono-cantante').value),
        cuerpo: document.getElementById('input-cuerpo').value
    };
    
    if(id) {
        await db.ref('catalogo/' + id).set(song);
    } else {
        await db.ref('catalogo').push(song);
    }
    
    document.getElementById('form-registro').reset();
    document.getElementById('edit-id').value = "";
}

function toggleAdmin() { document.querySelectorAll('.admin-only').forEach(e => e.style.display = e.style.display === 'none' ? 'block' : 'none'); }
function cambiarTono(v) { db.ref('musica_activa/tono').transaction(t => (t + v + 12) % 12); }

db.ref('setlist').on('value', snap => {
    const cont = document.getElementById('setlist-items');
    cont.innerHTML = "";
    snap.forEach(i => {
        const s = i.val();
        const div = document.createElement('div');
        div.className = "item-setlist";
        div.innerHTML = `<b>${s.titulo}</b> <button onclick="db.ref('setlist/${i.key}').remove()">✖</button>`;
        div.onclick = (e) => { if(e.target.tagName !== 'BUTTON') db.ref('musica_activa').set({ cancion: s, tono: s.tonoBase }); };
        cont.appendChild(div);
    });
});

window.onload = () => {
    const s1 = document.getElementById('input-tono-original');
    const s2 = document.getElementById('input-tono-cantante');
    escala.forEach((n, i) => {
        s1.innerHTML += `<option value="${i}">${n}</option>`;
        s2.innerHTML += `<option value="${i}">${n}</option>`;
    });
};
