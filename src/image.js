// Puhelimen täysikokoinen kuva on turhaa kaistaa ja tokeneita: pisin sivu
// 768 pikseliin ennen lähetystä. Kuvan hinta on ⌈leveys/28⌉ × ⌈korkeus/28⌉
// visuaalista tokenia, eli 768×576 maksaa 588 tokenia eikä sitä skaalata
// alaspäin millään mallilla.

const LAHETYS_SIVU = 768;
const PIKKUKUVA_SIVU = 300;
const LAATU = 0.8;

async function lataaKuva(tiedosto) {
  // createImageBitmap huomioi EXIF-kierron; kyljellään oleva kuva
  // heikentäisi arviota selvästi.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(tiedosto, { imageOrientation: "from-image" });
    } catch (e) {
      // vanhempi selain tai tuntematon muoto: pudotaan alle
    }
  }
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Kuvan luku epäonnistui"));
    r.readAsDataURL(tiedosto);
  });
  return await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Kuvaa ei voitu avata"));
    i.src = dataUrl;
  });
}

function piirra(kuva, maxSivu) {
  const skaala = Math.min(1, maxSivu / Math.max(kuva.width, kuva.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(kuva.width * skaala));
  canvas.height = Math.max(1, Math.round(kuva.height * skaala));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(kuva, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function blobiksi(canvas, laatu) {
  return new Promise((res) => canvas.toBlob(res, "image/jpeg", laatu));
}

export async function kasitteleKuva(tiedosto) {
  const kuva = await lataaKuva(tiedosto);
  const iso = piirra(kuva, LAHETYS_SIVU);
  const pikku = piirra(kuva, PIKKUKUVA_SIVU);
  if (typeof kuva.close === "function") kuva.close();

  return {
    base64: iso.toDataURL("image/jpeg", LAATU).split(",")[1],
    esikatselu: pikku.toDataURL("image/jpeg", LAATU),
    pikkukuva: await blobiksi(pikku, LAATU),
    leveys: iso.width,
    korkeus: iso.height,
  };
}
