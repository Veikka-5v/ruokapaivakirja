// Kutsu menee selaimesta suoraan Anthropicin APIin käyttäjän omalla avaimella.
// Avain ei ole koodissa eikä ympäristömuuttujassa: se kysytään käyttäjältä ja
// tallennetaan vain tämän laitteen IndexedDB:hen.

const PAATE = "https://api.anthropic.com/v1/messages";
const API_VERSIO = "2023-06-01";

// Hinnat dollaria per miljoona tokenia (platform.claude.com/docs/en/about-claude/pricing,
// tarkistettu 28.10.2026).
//
// Tässä ovat kaikki mallit, joita appi on koskaan käyttänyt, myös ne joita ei
// enää voi valita. Asetusten kulutusluku laskee vanhojen aterioiden hinnan
// niihin tallennetusta mallista, ja ilman vanhaa hintaa ne laskettaisiin
// nykyisen oletusmallin hinnalla väärin.
//
// Haiku 5.5:n hinta nousee viisinkertaiseksi yli 100 000 tokenin kehotteilla.
// Yksi ateriakuva on noin 3 000 tokenia, joten raja ei tule vastaan.
const HINNAT = {
  "claude-haiku-5-5": { sisaan: 0.1, ulos: 0.5 },
  "claude-sonnet-5-5": { sisaan: 2, ulos: 10 },
  "claude-opus-5-5": { sisaan: 4, ulos: 20 },
  // Aiemmin valittavissa olleet:
  "claude-sonnet-5": { sisaan: 2, ulos: 10 },
  "claude-haiku-4-5": { sisaan: 1, ulos: 5 },
  "claude-opus-5": { sisaan: 5, ulos: 25 },
};

// Valittavat mallit. Ajattelun saa pois päältä eri tavalla eri malleissa,
// ja väärä tapa palauttaa 400-virheen:
//   - Haiku 5.5 hyväksyy vielä { type: "disabled" } (oletusponnistus medium).
//   - Sonnet 5.5 hylkää "disabled"-arvon; ajattelu pois on
//     { type: "between_tools" }. Ilman työkaluja se tarkoittaa: ei ajattelua.
//   - Opus 5.5 ajattelee aina eikä ajattelua voi ottaa pois, joten kenttä
//     jätetään pois. Ajattelu laskutetaan ulostulotokeneina, joten
//     max_tokens on isompi ja hinta-arvioon lisätään arvioitu ajattelu.
export const MALLIT = {
  "claude-haiku-5-5": {
    nimi: "Haiku 5.5",
    kuvaus: "halvin",
    ajattelu: { type: "disabled" },
    maxTokens: 1500,
    ajatteluArvio: 0,
    ...HINNAT["claude-haiku-5-5"],
  },
  "claude-sonnet-5-5": {
    nimi: "Sonnet 5.5",
    kuvaus: "oletus",
    ajattelu: { type: "between_tools" },
    maxTokens: 1500,
    ajatteluArvio: 0,
    ...HINNAT["claude-sonnet-5-5"],
  },
  "claude-opus-5-5": {
    nimi: "Opus 5.5",
    kuvaus: "ajattelee aina, kallein",
    ajattelu: null,
    maxTokens: 8000,
    ajatteluArvio: 1500,
    ...HINNAT["claude-opus-5-5"],
  },
};

export const OLETUSMALLI = "claude-sonnet-5-5";

// Laitteelle tallennettu vanha mallivalinta siirretään saman tason uuteen
// malliin, jotta valinta ei katoa eikä appi lähetä kutsua mallille, jota ei
// enää tarjota.
const KORVAAJAT = {
  "claude-sonnet-5": "claude-sonnet-5-5",
  "claude-haiku-4-5": "claude-haiku-5-5",
  "claude-opus-5": "claude-opus-5-5",
};

export function voimassaOlevaMalli(id) {
  if (MALLIT[id]) return id;
  return KORVAAJAT[id] || OLETUSMALLI;
}

export function hintaDollareina(malli, sisaanTokenit, ulosTokenit) {
  const h = HINNAT[malli] || HINNAT[OLETUSMALLI];
  return ((sisaanTokenit || 0) * h.sisaan + (ulosTokenit || 0) * h.ulos) / 1e6;
}

// Arvio ennen kutsua, jotta hinnan näkee ennen Analysoi-painallusta.
// Kuva: ⌈leveys/28⌉ × ⌈korkeus/28⌉ tokenia. Ohje ja skeema noin 450 tokenia
// sisään, eritelty vastaus noin 350 ulos, ja Opukselle lisäksi ajattelu.
// Toteutunut hinta näkyy tuloksessa.
export function arvioiHinta(malli, leveys, korkeus) {
  const kuva = Math.ceil((leveys || 1568) / 28) * Math.ceil((korkeus || 1176) / 28);
  const m = MALLIT[malli] || MALLIT[OLETUSMALLI];
  return hintaDollareina(malli, kuva + 450, 350 + m.ajatteluArvio);
}

// Hinta luettavaksi: alle sentin summissa riittävästi desimaaleja, että
// Haikun 0,0005 $ ei näy nollana.
export function muotoileDollarit(arvo) {
  const desimaalit = arvo >= 0.01 ? 3 : arvo >= 0.001 ? 4 : 5;
  return arvo.toFixed(desimaalit).replace(".", ",");
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

  malli = voimassaOlevaMalli(malli);
  const asetus = MALLIT[malli];
  const runko = {
    model: malli,
    max_tokens: asetus.maxTokens,
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
  };
  if (asetus.ajattelu) runko.thinking = asetus.ajattelu;

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
      body: JSON.stringify(runko),
    });
  } catch (e) {
    throw new ApiVirhe("Ei verkkoyhteyttä. Kuva säilyy, voit yrittää uudelleen.");
  }

  if (!vastaus.ok) {
    let virheRunko = null;
    try {
      virheRunko = await vastaus.json();
    } catch (e) {
      // virheruntoa ei aina ole
    }
    throw tulkitseVirhe(vastaus.status, virheRunko);
  }

  const data = await vastaus.json();

  if (data.stop_reason === "max_tokens") {
    throw new ApiVirhe("Vastaus katkesi kesken. Yritä uudelleen.");
  }
  // 5.5-mallien turvaluokittimet voivat hylätä pyynnön, jolloin vastauksessa ei
  // ole JSONia. Ilman tätä tarkistusta käyttäjä näkisi harhaanjohtavan
  // "ei odotetussa muodossa" -virheen.
  if (data.stop_reason === "refusal") {
    throw new ApiVirhe("Malli kieltäytyi analysoimasta kuvaa. Kokeile toista kuvaa tai mallia.");
  }

  // Ajattelevat mallit (Opus 5.5) voivat aloittaa vastauksen thinking-
  // lohkolla, joten tekstilohkot valitaan tyypin eikä sijainnin mukaan.
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
