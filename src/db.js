// Kaikki data pysyy laitteella. Ei backendiä, ei synkronointia.

const DB_NIMI = "ruokapaivakirja";
const DB_VERSIO = 1;
const ATERIAT = "ateriat";
const ASETUKSET = "asetukset";

let dbLupaus = null;

function avaaDb() {
  if (dbLupaus) return dbLupaus;
  dbLupaus = new Promise((resolve, reject) => {
    const pyynto = indexedDB.open(DB_NIMI, DB_VERSIO);
    pyynto.onupgradeneeded = () => {
      const db = pyynto.result;
      if (!db.objectStoreNames.contains(ATERIAT)) {
        const store = db.createObjectStore(ATERIAT, { keyPath: "id" });
        store.createIndex("pvm", "pvm", { unique: false });
      }
      if (!db.objectStoreNames.contains(ASETUKSET)) {
        db.createObjectStore(ASETUKSET, { keyPath: "nimi" });
      }
    };
    pyynto.onsuccess = () => resolve(pyynto.result);
    pyynto.onerror = () => reject(pyynto.error || new Error("Tietokantaa ei voitu avata"));
    pyynto.onblocked = () => reject(new Error("Tietokanta on lukittu toisessa välilehdessä"));
  });
  // Jos avaus epäonnistuu, älä jää välimuistiin hylätyn lupauksen kanssa.
  dbLupaus.catch(() => { dbLupaus = null; });
  return dbLupaus;
}

async function suorita(store, tila, fn) {
  const db = await avaaDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, tila);
    let pyynto;
    try {
      pyynto = fn(t.objectStore(store));
    } catch (e) {
      t.abort();
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(pyynto ? pyynto.result : undefined);
    t.onerror = () => reject(t.error || new Error("Tietokantaoperaatio epäonnistui"));
    t.onabort = () => reject(t.error || new Error("Tietokantaoperaatio peruuntui"));
  });
}

function jarjesta(lista) {
  return lista.sort((a, b) => (a.pvm + a.aika).localeCompare(b.pvm + b.aika));
}

export async function aterioPaivalle(pvm) {
  const lista = await suorita(ATERIAT, "readonly", (s) => s.index("pvm").getAll(pvm));
  return jarjesta(lista || []);
}

export async function aterioValilta(alku, loppu) {
  const lista = await suorita(ATERIAT, "readonly", (s) =>
    s.index("pvm").getAll(IDBKeyRange.bound(alku, loppu))
  );
  return jarjesta(lista || []);
}

export async function kaikkiAteriat() {
  const lista = await suorita(ATERIAT, "readonly", (s) => s.getAll());
  return jarjesta(lista || []);
}

export function lisaaAteria(ateria) {
  return suorita(ATERIAT, "readwrite", (s) => s.add(ateria));
}

export function paivitaAteria(ateria) {
  return suorita(ATERIAT, "readwrite", (s) => s.put(ateria));
}

export function poistaAteria(id) {
  return suorita(ATERIAT, "readwrite", (s) => s.delete(id));
}

export async function korvaaKaikkiAteriat(lista) {
  const db = await avaaDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(ATERIAT, "readwrite");
    const store = t.objectStore(ATERIAT);
    store.clear();
    for (const a of lista) store.put(a);
    t.oncomplete = () => resolve(lista.length);
    t.onerror = () => reject(t.error || new Error("Tuonti epäonnistui"));
    t.onabort = () => reject(t.error || new Error("Tuonti peruuntui"));
  });
}

export async function haeAsetus(nimi, oletus = null) {
  const rivi = await suorita(ASETUKSET, "readonly", (s) => s.get(nimi));
  return rivi ? rivi.arvo : oletus;
}

export function tallennaAsetus(nimi, arvo) {
  return suorita(ASETUKSET, "readwrite", (s) => s.put({ nimi, arvo }));
}

export function poistaAsetus(nimi) {
  return suorita(ASETUKSET, "readwrite", (s) => s.delete(nimi));
}
