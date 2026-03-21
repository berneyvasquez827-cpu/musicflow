const firebaseConfig = {
    apiKey: "AIzaSyCOYRDnksd3HmiATlMUdAG_uF2MZMi7qVE",
    databaseURL: "https://musicflow-banda-default-rtdb.firebaseio.com"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const escala = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
let datosBiblioteca = [];

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// TRANSPORTE SEGURO
function motorTransporte(texto, tOrig, tCant) {
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

// FILTRO DE BÚSQUEDA
function filtrarBiblioteca() {
    const busqueda = document.getElementById('buscar-biblioteca').value.toLowerCase();
    const list = document.getElementById('lista-catalogo');
    list.innerHTML = "";
    datosBiblioteca.forEach(item => {
        if (item.titulo.toLowerCase().includes(busqueda)) {
            list.innerHTML += `<div class="item-cat"><span>${item.titulo}</span>
                <div><button onclick='db.ref("setlist").push(${JSON.stringify(item)})'>➕</button>
                <button onclick="editar('${item.key}')">✏️</button>
                <button onclick="db.ref('catalogo/${item.key}').remove()">🗑️</button></div></div>`;
        }
    });
}

// SINCRONIZACIÓN
db.ref('musica_activa').on('value', snap => {
    const d = snap.val(); if (!d || !d.cancion) return;
    const s = d.cancion;
    const tActual = d.tono !== undefined ? d.tono : s.tonoBase;
    document.getElementById('titulo-cancion').innerText = s.titulo;
    document.getElementById('info-cantante').innerText = s.cantante;
    document.getElementById('info-tono').innerText = escala[tActual] || "--";
    document.getElementById('tono-actual').innerText = escala[tActual] || "C";
    document.getElementById('letra-acordes').innerHTML = motorTransporte(s.cuerpo, s.tonoOriginalRegistrado || 0, tActual);
});

db.ref('catalogo').on('value', snap => {
    datosBiblioteca = [];
    snap.forEach(i => { let c = i.val(); c.key = i.key; datosBiblioteca.push(c); });
    filtrarBiblioteca();
});

// PDF Y GUARDADO
async function importarPDF(input) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let textoFinal = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            content.items.forEach(item => textoFinal += item.str + " ");
        }
        document.getElementById('input-cuerpo').value = textoFinal;
    };
    reader.readAsArrayBuffer(file);
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
    id ? await db.ref('catalogo/' + id).set(song) : await db.ref('catalogo').push(song);
    document.getElementById('form-registro').reset();
    document.getElementById('edit-id').value = "";
}

function editar(id) {
    db.ref('catalogo/' + id).once('value', s => {
        const d = s.val();
        document.getElementById('edit-id').value = id;
        document.getElementById('input-titulo').value = d.titulo;
        document.getElementById('input-cantante').value = d.cantante;
        document.getElementById('input-tono-original').value = d.tonoOriginalRegistrado;
        document.getElementById('input-tono-cantante').value = d.tonoBase;
        document.getElementById('input-cuerpo').value = d.cuerpo;
    });
}

function cambiarTono(v) { db.ref('musica_activa/tono').transaction(t => (t + v + 12) % 12); }
function toggleAdmin() { document.querySelectorAll('.admin-only').forEach(e => e.style.display = e.style.display === 'none' ? 'block' : 'none'); }

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
