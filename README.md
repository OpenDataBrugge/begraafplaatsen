# Zoek een overledene — GitHub Pages

Responsive publieke zoekapp bovenop de bestaande ArcGIS Online-webmap van Stad Brugge.

## Wat zit erin?

- Pure HTML/CSS/JavaScript: **geen buildstap en geen Node.js nodig**.
- ArcGIS Maps SDK for JavaScript via de officiële CDN.
- Publieke webmap: `a8fcf951710043f4825127ba89d2fa1f`.
- Zoekbron: `BZ_0000_Begraafplaats_Search`.
- Ondersteuning voor de sublaag `0000_LABELS` wanneer de zoekbron als Group Layer of Map Image Layer in de webmap staat.
- Zoeken op volledige naam, familienaam en voornaam, ongeacht de volgorde van de ingevoerde woorden.
- Filters voor begraafplaats en overlijdensjaar.
- Resultatenlijst met automatische zoom en markering van de grafplaats.
- Responsive mobiele flow: **Zoeken → Resultaat → Kaart/detail**.
- Deep links via querystring, bijvoorbeeld `?q=peeters&jaar=2021`.
- Toetsenbordfocus, skip-link, live statusmeldingen en reduced-motion ondersteuning.

## Exacte veldmapping

De app gebruikt de veldnamen uit `0000_LABELS` expliciet en doet voor deze productieconfiguratie geen gokwerk meer voor de belangrijkste velden.

| Functie | Veldnaam | Alias |
| --- | --- | --- |
| Object-ID | `OID` | OID |
| Code | `CODE` | Code |
| Begraafplaats | `BEGRAAFPLAATS` | Begraafplaats |
| Blok | `BLOKNR` | Bloknummer |
| Grafnummer | `GRAFNUMMER` | Grafnummer |
| Einddatum concessie | `EINDDATUM` | Einddatum concessie |
| Duur concessie | `DUUR` | Duur concessie |
| Familienaam | `NAAM` | Achternaam |
| Voornaam | `VOORNAAM` | Voornaam |
| Volledige naam | `VOLNAAM` | Volledige naam |
| Overlijdensdatum | `OVERLIJDENSDATUM` | Overlijdensdatum |

Technische auditvelden (`DATE_CREATED`, `USERID_CREATED`, `DATE_UPDATED`, `USERID_UPDATED`, `Shape__Area`, `Shape__Length`, `GlobalID`) worden niet aan de bezoeker getoond.

## Zoekgedrag

De zoekopdracht wordt in woorden gesplitst. Elk woord mag voorkomen in één van deze velden:

```text
VOLNAAM
NAAM
VOORNAAM
```

Daardoor kunnen bijvoorbeeld zowel `Jan Peeters` als `Peeters Jan` hetzelfde record vinden.

Het jaarfilter gebruikt `OVERLIJDENSDATUM`. De applicatie bouwt daarvoor een datumbereik van 1 januari van het gekozen jaar tot 1 januari van het volgende jaar, zodat het jaar al op de ArcGIS-server wordt gefilterd.

## Responsief gedrag

### Desktop

- Zoekkolom links.
- Kaart vult de resterende ruimte.
- Details van de geselecteerde grafplaats verschijnen in het zoekpaneel.

### Tablet

- Zoekpaneel en kaart blijven naast elkaar staan zolang er voldoende ruimte is.
- Breedtes schalen mee met het scherm.

### Smartphone (≤ 720 px)

- Eerst zoeken en resultaten.
- Bij aantikken van een resultaat opent automatisch de kaart.
- Grafgegevens verschijnen als onderpaneel op de kaart.
- De knop **Resultaten** brengt de gebruiker terug naar de resultatenlijst.

## Snel publiceren op GitHub Pages

1. Maak op GitHub een nieuwe repository, bijvoorbeeld `zoek-overledene`.
2. Upload **alle bestanden uit deze map** naar de root van de repository.
3. Open **Settings → Pages**.
4. Kies onder *Build and deployment*:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**
5. Klik **Save**.
6. De site verschijnt daarna op een adres zoals `https://<gebruikersnaam>.github.io/zoek-overledene/`.

Alle lokale verwijzingen zijn relatief, dus de app werkt ook vanuit een GitHub Pages-repositorysubpad.

## Publieke ArcGIS-data

GitHub Pages is een publieke statische website. De webmap en de gebruikte ArcGIS-laag/sublayer moeten dus publiek leesbaar zijn.

**Zet nooit een ArcGIS-gebruikersnaam, wachtwoord, OAuth client secret of langlevend token in deze repository.**

Als bepaalde bronvelden of records niet publiek mogen zijn, scherm die dan af in ArcGIS Online via een aparte publieke Hosted Feature Layer View of een andere publiek veilige serviceconfiguratie. Alleen velden verbergen in JavaScript is geen beveiliging.

## Configuratie

De vaste productie-instellingen staan in `config.js`:

```js
portalUrl: "https://stadbrugge.maps.arcgis.com",
webMapId: "a8fcf951710043f4825127ba89d2fa1f",

data: {
  searchLayerTitles: ["BZ_0000_Begraafplaats_Search"],
  searchSublayerTitles: ["0000_LABELS"],
  searchFields: ["VOLNAAM", "NAAM", "VOORNAAM"],
  fullNameFields: ["VOLNAAM"],
  firstNameFields: ["VOORNAAM"],
  lastNameFields: ["NAAM"],
  cemeteryField: "BEGRAAFPLAATS",
  deathDateField: "OVERLIJDENSDATUM",
  concessionEndField: "EINDDATUM",
  concessionDurationField: "DUUR",
  graveFields: ["BLOKNR", "GRAFNUMMER"],
}
```

## Lokale test

Open de bestanden niet rechtstreeks via `file://`. Start in de projectmap een eenvoudige lokale webserver:

```bash
python -m http.server 8080
```

Open daarna:

```text
http://localhost:8080/
```

## Problemen oplossen

### De webmap verschijnt, maar de zoeklaag wordt niet gevonden

Open de browserconsole. De app ondersteunt drie mogelijke structuren:

1. `BZ_0000_Begraafplaats_Search` is zelf een FeatureLayer.
2. `BZ_0000_Begraafplaats_Search` is een Map Image Layer met sublayer `0000_LABELS`.
3. `BZ_0000_Begraafplaats_Search` is een Group Layer waarin `0000_LABELS` als FeatureLayer of MapServer-sublayer voorkomt.

Als jullie webmap nog anders is opgebouwd, pas `searchLayerTitles` en `searchSublayerTitles` in `config.js` aan.

### Kaart verschijnt, maar een zoekopdracht geeft een ArcGIS-queryfout

Controleer in de browserconsole de servicefout. De app gebruikt server-side `LIKE`-queries op `VOLNAAM`, `NAAM` en `VOORNAAM`, en een datumfilter op `OVERLIJDENSDATUM`.

### Begraafplaatsfilter blijft leeg

Controleer of `BEGRAAFPLAATS` querybaar is en of de service distinct values ondersteunt. De app haalt de keuzelijst rechtstreeks uit dat veld.

## Bestanden

```text
index.html    hoofdscherm
styles.css    responsive layout en vormgeving
app.js        ArcGIS-map, zoeken, resultaten en kaartinteractie
config.js     vaste webmap-, laag- en veldconfiguratie
.nojekyll     voorkomt Jekyll-verwerking op GitHub Pages
README.md     deze handleiding
```
