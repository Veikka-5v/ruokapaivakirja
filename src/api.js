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

Lue ensin kaikki kuvassa näkyvä teksti: pakkausmerkinnät, ravintosisältötaulukot,
tuotenimet ja annoskoot. Pakkauksessa lukeva arvo on mittaustulos, oma arviosi ei.

Käytä tietolähteitä tässä järjestyksessä:
1. Kuvassa näkyvä pakkausmerkintä tai ravintosisältötaulukko
2. Käyttäjän antama lisätieto
3. Oma arviosi ruoan ulkonäöstä

Jos ravintosisältö on luettavissa pakkauksesta, käytä sitä sellaisenaan. Älä
korvaa sitä yleistiedollasi vastaavista tuotteista, vaikka lukema poikkeaisi
odottamastasi.

Tarkista, mitä lukema koskee: 100 grammaa, yhtä annosta vai koko pakkausta.
Tarkista erikseen, paljonko tuotetta todella syödään — koko pakkaus, osa siitä
vai lautaselle otettu annos.

Erittele jokainen ainesosa omaksi rivikseen ja anna sille massa, energia ja
proteiini. Laske arvot massasta äläkä päättele kokonaislukua suoraan.
Kokonaissummat lasketaan ainesosista, joten älä laske niitä itse.

Ota huomioon näkymätön rasva, kuten paistorasva ja kastikkeet.
Jos kuvassa ei ole ruokaa, palauta tyhjä ainesosalista ja kerro syy
huomio-kentässä.`;

// Rakenteinen vastaus: malli ei voi tuottaa skeeman vastaista JSONia, joten
// koodilohkojen siivousta tai sulkeiden etsimistä ei tarvita. Skeema ei tue
// minimum/maximum-rajoitteita, joten lukujen siistiminen tehdään alla.
//
// Kentät ovat generointijärjestyksessä: ainesosat tulevat ennen kokonaisuutta,
// joten malli joutuu erittelemään ennen kuin mitään summataan. Kokonaisarvoja
// ei kysytä mallilta lainkaan — ne lasketaan ainesosista täällä. Näin summa ei
// voi olla ristiriidassa osiensa kanssa, ja virheellinen rivi näkyy käyttäjälle
// sellaisenaan.
const SKEEMA = {
  type: "object",
  properties: {
    nimi: { type: "string", description: "Lyhyt kuvaus ateriasta suomeksi" },
    ainesosat: {
      type: "array",
      description: "Jokainen ainesosa erikseen, massoineen ja ravintoarvoineen",
      items: {
        type: "object",
        properties: {
          aine: { type: "string" },
          maara_g: { type: "number", description: "Syöty määrä grammoina" },
          peruste: {
            type: "string",
            description:
              "Mistä määrä ja ravintoarvot on saatu: mitä pakkauksessa luki, " +
              "mitä käyttäjä kertoi, tai mihin silmämääräinen arvio perustuu",
          },
          lahde: {
            type: "string",
            enum: ["pakkausmerkintä", "käyttäjän tieto", "arvio"],
            description: "Vahvin käytetty tietolähde tälle ainesosalle",
          },
          kcal: { type: "number", description: "Tämän ainesosan energia kilokaloreina" },
          proteiini_g: { type: "number", description: "Tämän ainesosan proteiini grammoina" },
        },
        required: ["aine", "maara_g", "peruste", "lahde", "kcal", "proteiini_g"],
        additionalProperties: false,
      },
    },
    varmuus: { type: "string", enum: ["matala", "keskitaso", "korkea"] },
    huomio: {
      type: "string",
      description:
        "Yksi lyhyt lause siitä, mikä arviossa on epävarminta. Jos kuvassa näkyi " +
        "pakkausmerkintä jota ei saanut luettua, kerro se tässä.",
    },
  },
  required: ["nimi", "ainesosat", "varmuus", "huomio"],
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

  const ainesosat = Array.isArray(jasennetty.ainesosat)
    ? jasennetty.ainesosat
        .filter((a) => a && a.aine)
        .map((a) => ({
          aine: String(a.aine),
          maara_g: siistiLuku(a.maara_g),
          peruste: String(a.peruste || ""),
          lahde: ["pakkausmerkintä", "käyttäjän tieto", "arvio"].includes(a.lahde)
            ? a.lahde
            : "arvio",
          kcal: siistiLuku(a.kcal),
          proteiini: siistiLuku(a.proteiini_g),
        }))
    : [];

  // Kokonaisarvot summataan ainesosista, ei kysytä mallilta. Yhteenlasku on
  // asia, jonka koodi tekee oikein ja kielimalli ei välttämättä.
  const summa = (kentta) => ainesosat.reduce((s, a) => s + a[kentta], 0);

  return {
    nimi: String(jasennetty.nimi || "Ateria").trim() || "Ateria",
    ainesosat,
    kcal: summa("kcal"),
    proteiini: summa("proteiini"),
    varmuus: ["matala", "keskitaso", "korkea"].includes(jasennetty.varmuus)
      ? jasennetty.varmuus
      : "keskitaso",
    huomio: String(jasennetty.huomio || ""),
    malli,
    sisaanTokenit: (data.usage && data.usage.input_tokens) || 0,
    ulosTokenit: (data.usage && data.usage.output_tokens) || 0,
  };
}
