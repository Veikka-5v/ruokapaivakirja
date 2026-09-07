// Kutsu menee selaimesta suoraan Anthropicin APIin käyttäjän omalla avaimella.
// Avain ei ole koodissa eikä ympäristömuuttujassa: se kysytään käyttäjältä ja
// tallennetaan vain tämän laitteen IndexedDB:hen.

const PAATE = "https://api.anthropic.com/v1/messages";
const API_VERSIO = "2023-06-01";

// Hinnat dollaria per miljoona tokenia.
export const MALLIT = {
  "claude-sonnet-5": { nimi: "Sonnet 5", kuvaus: "suositus", sisaan: 2, ulos: 10 },
  "claude-haiku-4-5": { nimi: "Haiku 4.5", kuvaus: "halvin", sisaan: 1, ulos: 5 },
  "claude-opus-5": { nimi: "Opus 5", kuvaus: "tarkin", sisaan: 5, ulos: 25 },
};

export const OLETUSMALLI = "claude-sonnet-5";

export function hintaDollareina(malli, sisaanTokenit, ulosTokenit) {
  const m = MALLIT[malli] || MALLIT[OLETUSMALLI];
  return ((sisaanTokenit || 0) * m.sisaan + (ulosTokenit || 0) * m.ulos) / 1e6;
}

const OHJE = `Olet ravitsemusanalyytikko. Arvioi kuvassa näkyvä ateria.

Arvioi annoskoko kuvan perusteella. Ota huomioon näkymätön rasva, kuten
paistorasva ja kastikkeet. Jos kuvassa ei ole ruokaa, palauta kcal 0 ja
kerro syy huomio-kentässä.`;

// Rakenteinen vastaus: malli ei voi tuottaa skeeman vastaista JSONia, joten
// koodilohkojen siivousta tai sulkeiden etsimistä ei tarvita. Skeema ei tue
// minimum/maximum-rajoitteita, joten lukujen siistiminen tehdään alla.
const SKEEMA = {
  type: "object",
  properties: {
    nimi: { type: "string", description: "Lyhyt kuvaus ateriasta suomeksi" },
    ainesosat: {
      type: "array",
      description: "Tunnistetut ainesosat arvioituine massoineen",
      items: {
        type: "object",
        properties: {
          aine: { type: "string" },
          maara_g: { type: "number", description: "Arvioitu määrä grammoina" },
        },
        required: ["aine", "maara_g"],
        additionalProperties: false,
      },
    },
    kcal: { type: "number", description: "Koko annoksen energiasisältö kilokaloreina" },
    proteiini_g: { type: "number", description: "Koko annoksen proteiini grammoina" },
    varmuus: { type: "string", enum: ["matala", "keskitaso", "korkea"] },
    huomio: {
      type: "string",
      description: "Yksi lyhyt lause siitä, mikä arviossa on epävarminta",
    },
  },
  required: ["nimi", "ainesosat", "kcal", "proteiini_g", "varmuus", "huomio"],
  additionalProperties: false,
};

export class ApiVirhe extends Error {
  constructor(viesti, { koodi = null, avainOngelma = false } = {}) {
    super(viesti);
    this.name = "ApiVirhe";
    this.koodi = koodi;
    this.avainOngelma = avainOngelma;
  }
}

function tulkitseVirhe(status, runko) {
  const viesti = (runko && runko.error && runko.error.message) || "";
  if (status === 401 || status === 403) {
    return new ApiVirhe("API-avain ei kelpaa. Tarkista avain asetuksista.", {
      koodi: status,
      avainOngelma: true,
    });
  }
  if (/credit balance/i.test(viesti)) {
    return new ApiVirhe(
      "Krediitit ovat loppu. Lisää saldoa Anthropicin konsolissa.",
      { koodi: status }
    );
  }
  if (status === 429) {
    return new ApiVirhe("Liikaa pyyntöjä tai kiintiö täynnä. Odota hetki ja yritä uudelleen.", {
      koodi: status,
    });
  }
  if (status >= 500) {
    return new ApiVirhe("Palvelinvirhe Anthropicin päässä. Yritä uudelleen.", { koodi: status });
  }
  if (status === 400 && viesti) {
    return new ApiVirhe(`Pyyntö hylättiin: ${viesti}`, { koodi: status });
  }
  return new ApiVirhe(`Analyysi epäonnistui (${status})`, { koodi: status });
}

function siistiLuku(arvo) {
  const n = Number(arvo);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

export async function analysoiKuva({ base64, lisatieto, avain, malli = OLETUSMALLI }) {
  if (!avain) {
    throw new ApiVirhe("API-avain puuttuu. Lisää se asetuksista.", { avainOngelma: true });
  }

  const teksti = lisatieto ? `${OHJE}\n\nKäyttäjän lisätieto: ${lisatieto}` : OHJE;

  let vastaus;
  try {
    vastaus = await fetch(PAATE, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": avain,
        "anthropic-version": API_VERSIO,
        // Avaa CORSin selainpuolen bring-your-own-key-sovelluksille.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: malli,
        max_tokens: 1000,
        // Ilman tätä Sonnet 5 ajaa adaptiivisen ajattelun ja laskuttaa siitä.
        // Tämä tehtävä ei hyödy siitä, joten se on pois päältä.
        thinking: { type: "disabled" },
        output_config: { format: { type: "json_schema", schema: SKEEMA } },
        messages: [
          {
            role: "user",
            // Kuva ennen tekstiä: malli toimii näin parhaiten.
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
              { type: "text", text: teksti },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    throw new ApiVirhe("Ei verkkoyhteyttä. Kuva säilyy, voit yrittää uudelleen.");
  }

  if (!vastaus.ok) {
    let runko = null;
    try {
      runko = await vastaus.json();
    } catch (e) {
      // virheruntoa ei aina ole
    }
    throw tulkitseVirhe(vastaus.status, runko);
  }

  const data = await vastaus.json();

  if (data.stop_reason === "max_tokens") {
    throw new ApiVirhe("Vastaus katkesi kesken. Yritä uudelleen.");
  }

  const sisalto = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  let jasennetty;
  try {
    jasennetty = JSON.parse(sisalto);
  } catch (e) {
    throw new ApiVirhe("Vastaus ei ollut odotetussa muodossa. Yritä uudelleen.");
  }

  return {
    nimi: String(jasennetty.nimi || "Ateria").trim() || "Ateria",
    ainesosat: Array.isArray(jasennetty.ainesosat)
      ? jasennetty.ainesosat
          .filter((a) => a && a.aine)
          .map((a) => ({ aine: String(a.aine), maara_g: siistiLuku(a.maara_g) }))
      : [],
    kcal: siistiLuku(jasennetty.kcal),
    proteiini: siistiLuku(jasennetty.proteiini_g),
    varmuus: ["matala", "keskitaso", "korkea"].includes(jasennetty.varmuus)
      ? jasennetty.varmuus
      : "keskitaso",
    huomio: String(jasennetty.huomio || ""),
    malli,
    sisaanTokenit: (data.usage && data.usage.input_tokens) || 0,
    ulosTokenit: (data.usage && data.usage.output_tokens) || 0,
  };
}
