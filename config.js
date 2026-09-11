export const CONFIG = {
  appTitle: "Zoek een overledene",
  appSubtitle:
    "Zoek waar een overledene op een Brugse begraafplaats begraven ligt.",

  // Bestaande ArcGIS Online-webmap van Stad Brugge.
  portalUrl: "https://stadbrugge.maps.arcgis.com",
  webMapId: "a8fcf951710043f4825127ba89d2fa1f",

  // Laat deze arrays leeg om de app automatisch de juiste zoeklaag/velden
  // te laten detecteren. Voor productie is expliciet invullen nog robuuster.
  data: {
    searchLayerIds: [],
    searchLayerTitles: [],
    searchFields: [],

    fullNameFields: [],
    firstNameFields: [],
    lastNameFields: [],

    cemeteryField: "",
    deathYearField: "",
    deathDateField: "",
    birthYearField: "",
    birthDateField: "",
    concessionEndField: "",
    graveFields: [],
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
