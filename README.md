# Zoek een overledene — GitHub Pages

Responsive publieke zoekapp bovenop de bestaande ArcGIS Online-webmap van Stad Brugge.

## Wat zit erin?

- Pure HTML/CSS/JavaScript: **geen buildstap en geen Node.js nodig**.
- ArcGIS Maps SDK for JavaScript 5.1 via de officiële CDN.
- Bestaande webmap: `a8fcf951710043f4825127ba89d2fa1f`.
- Zoeken op voornaam/familienaam, ongeacht de volgorde van de woorden.
- Automatische detectie van relevante featurelaag/naamvelden.
- Optionele filters voor begraafplaats en overlijdensjaar.
- Resultatenlijst met automatische zoom en highlight op de kaart.
- Aparte responsive mobiele flow: **Zoeken → Resultaat → Kaart/detail**.
- Deep links via querystring, bijvoorbeeld `?q=peeters&jaar=2021`.
- Toetsenbordfocus, skip-link, live statusmeldingen en reduced-motion ondersteuning.

## Snel publiceren op GitHub Pages

1. Maak op GitHub een nieuwe repository, bijvoorbeeld `zoek-overledene`.
2. Upload **alle bestanden uit deze map** naar de root van de repository.
3. Open op GitHub: **Settings → Pages**.
4. Kies onder *Build and deployment*:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**
5. Klik **Save**.
6. De site verschijnt daarna op een adres zoals:
   `https://<gebruikersnaam>.github.io/zoek-overledene/`

Omdat alle lokale verwijzingen relatief zijn (`./app.js`, `./styles.css`) werkt de app ook vanuit een repository-subpad.

## Belangrijk: publieke ArcGIS-data

GitHub Pages is een publieke statische website. De webmap en de featurelagen die deze app gebruikt moeten dus publiek leesbaar zijn.

**Zet nooit een ArcGIS gebruikersnaam, wachtwoord, OAuth client secret of langlevend token in deze repository.**

Als de brondata niet volledig publiek mag zijn, maak dan in ArcGIS Online een afzonderlijke **Hosted Feature Layer View** met alleen de velden en records die publiek mogen worden geraadpleegd en gebruik die in de webmap.

## Configuratie

De meeste instellingen staan in `config.js`.

### Webmap wijzigen

```js
portalUrl: "https://stadbrugge.maps.arcgis.com",
webMapId: "a8fcf951710043f4825127ba89d2fa1f",
```

### Zoeklaag expliciet vastzetten

Standaard probeert de app zelf de juiste FeatureLayer(s) en velden te vinden. Voor een productieomgeving is het beter om na controle de juiste laag expliciet in te vullen.

Open de browserconsole. Bij het starten schrijft de app een groep naar de console:

`Zoek een overledene — gedetecteerde ArcGIS-configuratie`

Daar zie je bijvoorbeeld:

```text
layer: Overledenen_Publiek
layerId: Overledenen_1234
searchFields: ["ACHTERNAAM", "VOORNAAM"]
cemeteryField: BEGRAAFPLAATS
...
```

Neem die waarden vervolgens over in `config.js`:

```js
data: {
  searchLayerTitles: ["Overledenen_Publiek"],
  searchFields: ["ACHTERNAAM", "VOORNAAM"],
  firstNameFields: ["VOORNAAM"],
  lastNameFields: ["ACHTERNAAM"],
  cemeteryField: "BEGRAAFPLAATS",
  deathYearField: "OVERLIJDENSJAAR",
  graveFields: ["VAK", "RIJ", "GRAFNUMMER"],
}
```

Gebruik liever een laagtitel of webmap-layer-id dan een interne ObjectID.

## Aanbevolen publieke datalaag

Voor de beste zoekervaring is één publieke zoeklaag ideaal, bijvoorbeeld `Overledenen_Publiek`, met één record per overledene.

Aanbevolen velden:

| Veld | Doel |
| --- | --- |
| `ZOEKNAAM` | Technisch zoekveld, bijvoorbeeld `PEETERS JAN MARIA` |
| `NAAM_WEERGAVE` | Naam zoals die aan de bezoeker getoond wordt |
| `VOORNAAM` | Optioneel afzonderlijk naamveld |
| `ACHTERNAAM` | Optioneel afzonderlijk naamveld |
| `OVERLIJDENSJAAR` | Snelle jaarfilter |
| `BEGRAAFPLAATS` | Begraafplaatsfilter en resultaatweergave |
| `VAK`, `RIJ`, `GRAFNUMMER` | Locatiebeschrijving |
| geometrie | Punt of vlak van het graf |

Je hebt `ZOEKNAAM` niet verplicht nodig. De app kan ook tegelijk zoeken over aparte voornaam- en familienaamvelden.

## Zoekgedrag

De ingevoerde woorden moeten allemaal voorkomen in één van de gedetecteerde naamvelden. Daardoor leveren zowel:

- `Peeters Jan`
- `Jan Peeters`

hetzelfde resultaat op wanneer `Peeters` en `Jan` respectievelijk in de naamvelden voorkomen.

De app gebruikt een server-side FeatureLayer-query en haalt standaard maximaal 100 resultaten op. Dit is aanpasbaar in `config.js`:

```js
search: {
  minimumCharacters: 2,
  maximumResults: 100,
  zoomScale: 700,
}
```

## Responsive gedrag

### Desktop

- Vaste zoekkolom van circa 430 px links.
- Kaart vult de rest van het scherm.
- Geselecteerde grafgegevens verschijnen onder de resultaten.

### Tablet

- Zoekkolom wordt circa 40% van de schermbreedte.
- Kaart blijft permanent zichtbaar.

### Smartphone (≤ 720 px)

- Eerst uitsluitend zoeken en resultaten.
- Bij aantikken van een resultaat opent automatisch de kaart.
- Grafgegevens worden als onderpaneel op de kaart weergegeven.
- Knop **Resultaten** brengt de gebruiker terug naar de resultatenlijst.

## Lokale test

Vanwege browserbeveiliging is openen via `file://` niet aan te raden. Start lokaal een simpele webserver in deze map, bijvoorbeeld:

```bash
python -m http.server 8080
```

Open daarna:

```text
http://localhost:8080/
```

## Problemen oplossen

### “Geen geschikte publieke featurelaag met naamvelden gevonden”

Vul in `config.js` de zoeklaag en velden expliciet in:

```js
searchLayerTitles: ["Exacte laagtitel"],
searchFields: ["VELD1", "VELD2"],
```

### Kaart verschijnt, maar zoeken geeft niets terug

Controleer in de browserconsole welke `searchFields` gedetecteerd zijn. Stel die daarna expliciet in `config.js` in.

### Begraafplaatsfilter blijft uitgeschakeld

Er is dan geen veld automatisch herkend dat op `begraafplaats`, `kerkhof` of `cemetery` lijkt. Vul `cemeteryField` expliciet in.

### Private ArcGIS-laag

Een publieke GitHub Pages-site kan geen private ArcGIS-data benaderen zonder authenticatie. Publiceer bij voorkeur een privacyveilige Hosted Feature Layer View. Voeg geen geheim token toe aan client-side JavaScript.

## Bestanden

```text
index.html    hoofdscherm
styles.css    responsive layout en vormgeving
app.js        ArcGIS-map, detectie, zoeken, resultaten, kaartinteractie
config.js     instellingen die je normaal zelf aanpast
.nojekyll     voorkomt Jekyll-verwerking op GitHub Pages
README.md     deze handleiding
```
