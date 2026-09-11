export const CONFIG = {
  appTitle: "Zoek een overledene",
  appSubtitle:
    "Zoek waar een overledene op een Brugse begraafplaats begraven ligt.",

  // Publieke ArcGIS Online-webmap van Stad Brugge.
  // Gebruik het globale ArcGIS Online-portaal voor browsertoegang vanaf
  // GitHub Pages. Het organisatieportaal stadbrugge.maps.arcgis.com blokkeert
  // cross-origin requests naar /sharing/rest/portals/self.
  portalUrl: "https://www.arcgis.com",
  webMapId: "a8fcf951710043f4825127ba89d2fa1f",

  // Productieconfiguratie voor BZ_0000_Begraafplaats_Search.
  // Deze veldnamen komen rechtstreeks uit de publieke laag.
  data: {
    searchLayerIds: [],
    searchLayerTitles: ["BZ_0000_Begraafplaats_Search"],
    // In de publieke webmap kan de zoekbron als Map Image Layer voorkomen.
    // De screenshot met velddefinities toont deze sublaag.
    searchSublayerTitles: ["0000_LABELS"],

    // Zoek op volledige naam én op de afzonderlijke naamvelden.
    // De zoeklogica splitst de invoer in woorden, zodat zowel
    // "Jan Peeters" als "Peeters Jan" bruikbaar zijn.
    searchFields: ["VOLNAAM", "NAAM", "VOORNAAM"],

    fullNameFields: ["VOLNAAM"],
    firstNameFields: ["VOORNAAM"],
    lastNameFields: ["NAAM"],

    cemeteryField: "BEGRAAFPLAATS",
    deathYearField: "",
    deathDateField: "OVERLIJDENSDATUM",
    birthYearField: "",
    birthDateField: "",
    concessionEndField: "EINDDATUM",
    concessionDurationField: "DUUR",
    graveFields: ["BLOKNR", "GRAFNUMMER"],
  },

  search: {
    minimumCharacters: 2,
    maximumResults: 100,
    zoomScale: 700,
  },

  text: {
    searchPlaceholder: "Typ voornaam en/of familienaam",
    noResultsTitle: "Geen overledene gevonden",
    noResultsText:
      "Controleer de spelling, probeer alleen de familienaam of verwijder de filters.",
    initialText:
      "Vul een naam in om te zoeken. Je kunt nadien verfijnen op begraafplaats of overlijdensjaar.",
  },
};
