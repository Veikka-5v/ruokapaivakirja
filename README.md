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
pisimmän sivun 1568 pikseliin, joten 1568×1176 kuva on 2352 tokenia eikä sitä
skaalata alaspäin millään mallilla. Promptin kanssa yhteensä noin 2 800 tokenia
sisään ja 350 ulos. Opus 5.5 ajattelee aina, ja ajattelu laskutetaan
ulostulona; arviossa sille on lisätty noin 1 500 tokenia.

Hinnat tarkistettu 28.10.2026 ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)):

| Malli | $ / M tokenia (sisään / ulos) | $/analyysi | Vuodessa, 3 ateriaa/pv |
|---|---|---|---|
| Haiku 5.5 | 0,10 / 0,50 | 0,0005 | ~0,50 $ |
| Sonnet 5.5 (oletus) | 2 / 10 | 0,009 | ~10 $ |
| Opus 5.5 | 4 / 20 | ~0,05 | ~50 $ |

Haiku 5.5:n hinta viisinkertaistuu yli 100 000 tokenin kehotteilla; yksi
ateriakuva on noin 3 000 tokenia, joten raja ei tule vastaan.

Kuvaa lähetettiin aiemmin 768 pikselin levyisenä, jolloin analyysi maksoi noin
kolmanneksen tästä. Se ei riittänyt lukemaan pakkauksen ravintosisältötaulukkoa,
ja juuri se lukema on tarkin saatavilla oleva tieto — halvempi väärä luku ei ole
säästö.

### Mallit ja ajattelu

Ajattelun saa pois eri tavalla eri malleissa, ja väärä arvo palauttaa
400-virheen. Asetukset ovat `api.js`:n `MALLIT`-taulukossa:

| Malli | `thinking` | `max_tokens` |
|---|---|---|
| Haiku 5.5 | `{ type: "disabled" }` | 1 500 |
| Sonnet 5.5 | `{ type: "between_tools" }` — `disabled` palauttaa 400 | 1 500 |
| Opus 5.5 | kenttä jätetään pois, ajattelu on aina päällä | 8 000 |

`HINNAT`-taulukossa ovat myös aiemmin valittavissa olleet mallit (Sonnet 5,
Haiku 4.5, Opus 5), koska asetusten kulutusluku laskee vanhojen aterioiden
hinnan niihin tallennetusta mallista. Laitteelle tallennettu vanha valinta
siirretään käynnistyksessä saman tason uuteen malliin (`voimassaOlevaMalli`).

Nämä ovat arvioita. Appi tallentaa jokaisen kutsun todellisen
token-kulutuksen ateriariville, ja asetusnäkymä näyttää toteutuneen
kokonaiskulun ja keskihinnan. Muutaman kymmenen aterian jälkeen luku on
tarkempi kuin mikään arvio.

## Rakenne

```
src/
  api.js            Claude-kutsu, hinnoittelu, virheiden tulkinta
  db.js             IndexedDB: ateriat + asetukset
  image.js          Skaalaus 1568 px, pikkukuva 300 px, EXIF-kierto
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
| `lahde` | string | `kuva` tai `kasin`; puuttuu vanhoilta riveiltä (= kuva) |
| `aiKcal` | number | mallin alkuperäinen arvio, vain kuvasta |
| `aiProteiini` | number | mallin alkuperäinen arvio, vain kuvasta |
| `varmuus` | string | matala / keskitaso / korkea, vain kuvasta |
| `kuva` | Blob | pikkukuva 300 px, vain kuvasta |
| `malli` | string | kutsussa käytetty malli, vain kuvasta |
| `sisaanTokenit` | number | `usage.input_tokens`, vain kuvasta |
| `ulosTokenit` | number | `usage.output_tokens`, vain kuvasta |

`aiKcal` ja `aiProteiini` tallennetaan aina erikseen korjatuista arvoista.
Historianäkymän "Arvion tarkkuus" laskee näistä, kuinka systemaattisesti arviot
heittävät ja mihin suuntaan. Käsin kirjatuilla riveillä kenttiä ei ole, joten
laskenta ohittaa ne — käsin kirjattu luku ei ole arvio.

Store `asetukset`, keyPath `nimi`: `apiAvain`, `malli`.

## Poikkeamat alkuperäisestä briefistä

Kolme muutosta, kaikki briefin omien tavoitteiden suuntaan:

- **Malli `claude-sonnet-5`**, ei `claude-sonnet-4-6`. Uudempi ja halvempi:
  2 $/10 $ per miljoona tokenia versus 3 $/15 $. (Lokakuussa 2026 vaihdettu
  5.5-malleihin, ks. Kustannus.)
- **Ajattelu pois päältä.** Parametrin pois jättäminen ajaisi adaptiivisen
  ajattelun ja laskuttaisi siitä. Tapa vaihtelee mallin mukaan, ks. Mallit ja
  ajattelu.
- **Rakenteinen vastaus** (`output_config.format`) vapaan JSONin sijaan. Malli
  ei voi tuottaa skeeman vastaista vastausta, joten koodilohkojen siivousta ja
  sulkeiden etsimistä ei tarvita eikä parsintavirhettä voi tulla. Skeema ei tue
  `minimum`-rajoitteita, joten lukujen siistiminen tehdään `api.js`:ssä.

## Miten arvion tarkkuutta parannettiin

Ensimmäinen versio arvioi rahkapurkin proteiinimääräksi 67 g, vaikka kannessa
luki 25 g. Vian löytäminen ei vaatinut mallin vaihtoa — Opus 5 arvioi yhtä
huonosti, koska vika oli ohjeessa, kuvassa ja skeemassa.

- **Prompti antaa todistehierarkian.** Vanha ohje sanoi "arvioi annoskoko kuvan
  perusteella" eikä maininnut tekstiä lainkaan, joten malli teki juuri niin ja
  ohitti pakkausmerkinnän. Uusi ohje käskee lukea kuvan tekstin ensin ja asettaa
  järjestyksen pakkausmerkintä → käyttäjän lisätieto → silmämääräinen arvio. Se
  myös käskee tarkistaa erikseen, koskeeko lukema 100 g:aa, annosta vai koko
  pakkausta, ja paljonko tuotetta todella syödään.
- **Kuva lähetetään 1568 pikselin levyisenä**, koska 768 px ei riitä lukemaan
  ravintosisältötaulukkoa. Parannettu ohje ei auta, jos teksti ei erotu.
- **Skeema pakottaa erittelyyn.** Ainesosakohtaiset `kcal` ja `proteiini_g`
  tulevat generointijärjestyksessä ennen kokonaisuutta, ja kokonaisarvot
  lasketaan `api.js`:ssä summaamalla — niitä ei kysytä mallilta lainkaan.
  Aiemmin malli tuotti yhden kokonaisluvun ilman välivaiheita, ja koska
  `thinking` on pois päältä, välivaiheelle ei ollut muuta tilaa kuin skeema.
  Summa ei voi enää olla ristiriidassa osiensa kanssa.
- **`peruste` ja `lahde` näkyvät käyttöliittymässä.** Jokainen rivi kertoo,
  mihin luku perustuu, ja pakkauksesta luetut on merkitty. Väärä luku on
  paikannettavissa yhteen ainesosaan sen sijaan että koko arvio olisi vain
  väärässä.

## Kirjauksen kulku

Kirjauskortissa on kaksi tilaa: **Kuvasta** ja **Käsin**.

Kuvasta kulkee kolmessa vaiheessa. Kuvan valinta näyttää esikatselun ja
lisätietokentän, mutta ei kutsu APIa. Esikatselussa näkyy arvioitu hinta
(`arvioiHinta` api.js:ssä). Vasta **Analysoi** liittää `Analyysi`-komponentin,
ja kutsu lähtee silloin. Tuloksesta **Takaisin** palaa esikatseluun eikä
tyhjään, joten saman kuvan voi analysoida uudelleen tarkemmalla lisätiedolla.

Käsin-tilassa annetaan nimi, kcal ja proteiini. Kirjaus vaatii nimen ja
vähintään yhden luvun. Ei API-kutsua.

Aterialistassa rivin napautus avaa muokkauksen. Poisto on muokkauksen sisällä
ja kaksivaiheinen, koska rivin napautus on helppo tehdä vahingossa.

## Huomioita

- Kameran avaus on `<input type="file" accept="image/*">` ilman
  `capture`-määrettä, joten kuvan voi myös valita kirjastosta.
- Virhetilanteet (verkko, 401, 429, krediitit lopussa, katkennut vastaus)
  näytetään erikseen, ja uudelleenyritys onnistuu ilman että kuva katoaa.
- Offline: appi aukeaa ja vanha data näkyy ilman verkkoa. Vain analyysi vaatii
  yhteyden.
- Asetusnäkymä näyttää käytössä olevan version (lyhyt commit-hash ja
  käännösaika) ja osaa verrata sitä palvelimen `versio.json`-tiedostoon.
  Service worker tarjoilee vanhan version välimuistista ja hakee uuden vasta
  taustalla, joten julkaisu näkyy muuten vasta seuraavalla avauksella; "Ota
  uusi versio käyttöön" tyhjentää Cache Storagen ja lataa sivun uudelleen.
  Kirjaukset ovat IndexedDB:ssä eivätkä katoa.
- `Analyysi.jsx` suojaa tuplakutsulta ref-lipulla, koska React StrictMode ajaa
  efektin kehityksessä kahdesti ja jokainen kutsu maksaa oikeaa rahaa.
- Selaimen tietojen tyhjennys poistaa kirjaukset. Asetuksista saa JSON-
  varmuuskopion (ilman pikkukuvia).
