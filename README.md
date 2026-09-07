# Ruokapäiväkirja

Asennettava PWA, joka arvioi aterian kalorit ja proteiinin valokuvasta Clauden
vision-APIn avulla. Käyttäjä korjaa arvion ennen kirjaamista. Data pysyy
laitteella: ei backendiä, ei tiliä, ei synkronointia.

## Käyttöönotto

```bash
npm install
npm run dev
```

Tuotantoversio staattiseen hostingiin (GitHub Pages, Netlify, Cloudflare Pages):

```bash
npm run build
```

Buildi menee `dist/`-hakemistoon. `vite.config.js` asettaa `base: "./"`, joten
appi toimii myös alipolussa kuten `https://kayttaja.github.io/ruokapaivakirja/`.

## API-avain

Avain **kysytään käyttäjältä ensimmäisellä käynnistyksellä** ja tallennetaan
IndexedDB:hen. Sitä ei ole koodissa eikä ympäristömuuttujassa, koska Vite
kirjoittaisi ne lopulliseen bundleen.

Ennen käyttöä kannattaa tehdä konsolissa (console.anthropic.com) kaksi asiaa:

1. Luo tälle apille **oma workspace**.
2. Luo workspacelle oma API-avain ja aseta sille **kulutusraja**.

Avain elää puhelimen selaimessa ja on luettavissa kehitystyökaluilla. Raja on
ainoa asia, joka oikeasti rajoittaa vahinkoa, jos avain vuotaa.

## Kustannus

Kuva maksaa `⌈leveys/28⌉ × ⌈korkeus/28⌉` visuaalista tokenia. Appi skaalaa
pisimmän sivun 768 pikseliin, joten 768×576 kuva on 588 tokenia eikä sitä
skaalata alaspäin millään mallilla. Promptin kanssa yhteensä noin 750 tokenia
sisään ja 180 ulos.

| Malli | $/analyysi | Analyysiä ~5 $:lla |
|---|---|---|
| Haiku 4.5 | 0,0018 | ~2 800 |
| Sonnet 5 (oletus) | 0,0033 | ~1 500 |
| Opus 5 | 0,0090 | ~550 |

Nämä ovat arvioita. Appi tallentaa jokaisen kutsun todellisen
token-kulutuksen ateriariville, ja asetusnäkymä näyttää toteutuneen
kokonaiskulun ja keskihinnan. Muutaman kymmenen aterian jälkeen luku on
tarkempi kuin mikään arvio.

## Rakenne

```
src/
  api.js            Claude-kutsu, hinnoittelu, virheiden tulkinta
  db.js             IndexedDB: ateriat + asetukset
  image.js          Skaalaus 768 px, pikkukuva 300 px, EXIF-kierto
  dates.js          Päivämääräapurit
  ui.jsx            Väripaletti, tyylit, jaetut komponentit
  App.jsx           Näkymien vaihto, asetusten lataus
  views/
    Paiva.jsx       Päivän summat, aterialista, kuvaus
    Analyysi.jsx    Mallin arvio, korjauskentät, uudelleenyritys
    Historia.jsx    Viikko- ja kuukausikeskiarvot, CSV-vienti
    Asetukset.jsx   Avain, malli, kulutus, varmuuskopiot
public/
  manifest.webmanifest
  sw.js             Sovelluskuori välimuistiin, API ohittaa
  icon-*.png
```

### Tietomalli

Store `ateriat`, keyPath `id`, indeksi `pvm`:

| kenttä | tyyppi | |
|---|---|---|
| `id` | string | aikaleima + satunnaispääte |
| `pvm` | string | `YYYY-MM-DD`, indeksoitu |
| `aika` | string | `HH:MM` |
| `nimi` | string | |
| `kcal` | number | käyttäjän hyväksymä arvo |
| `proteiini` | number | käyttäjän hyväksymä arvo |
| `aiKcal` | number | mallin alkuperäinen arvio |
| `aiProteiini` | number | mallin alkuperäinen arvio |
| `varmuus` | string | matala / keskitaso / korkea |
| `kuva` | Blob | pikkukuva 300 px |
| `malli` | string | kutsussa käytetty malli |
| `sisaanTokenit` | number | `usage.input_tokens` |
| `ulosTokenit` | number | `usage.output_tokens` |

`aiKcal` ja `aiProteiini` tallennetaan aina erikseen korjatuista arvoista.
Historianäkymän "Arvion tarkkuus" laskee näistä, kuinka systemaattisesti arviot
heittävät ja mihin suuntaan.

Store `asetukset`, keyPath `nimi`: `apiAvain`, `malli`.

## Poikkeamat alkuperäisestä briefistä

Kolme muutosta, kaikki briefin omien tavoitteiden suuntaan:

- **Malli `claude-sonnet-5`**, ei `claude-sonnet-4-6`. Uudempi ja halvempi:
  2 $/10 $ per miljoona tokenia versus 3 $/15 $.
- **`thinking: { type: "disabled" }`.** Sonnet 5:llä parametrin pois jättäminen
  ajaisi adaptiivisen ajattelun ja laskuttaisi siitä. Tämä tehtävä ei hyödy
  siitä.
- **Rakenteinen vastaus** (`output_config.format`) vapaan JSONin sijaan. Malli
  ei voi tuottaa skeeman vastaista vastausta, joten koodilohkojen siivousta ja
  sulkeiden etsimistä ei tarvita eikä parsintavirhettä voi tulla. Skeema ei tue
  `minimum`-rajoitteita, joten lukujen siistiminen tehdään `api.js`:ssä.

## Huomioita

- Kameran avaus on `<input type="file" accept="image/*">` ilman
  `capture`-määrettä, joten kuvan voi myös valita kirjastosta.
- Virhetilanteet (verkko, 401, 429, krediitit lopussa, katkennut vastaus)
  näytetään erikseen, ja uudelleenyritys onnistuu ilman että kuva katoaa.
- Offline: appi aukeaa ja vanha data näkyy ilman verkkoa. Vain analyysi vaatii
  yhteyden.
- `Analyysi.jsx` suojaa tuplakutsulta ref-lipulla, koska React StrictMode ajaa
  efektin kehityksessä kahdesti ja jokainen kutsu maksaa oikeaa rahaa.
- Selaimen tietojen tyhjennys poistaa kirjaukset. Asetuksista saa JSON-
  varmuuskopion (ilman pikkukuvia).
