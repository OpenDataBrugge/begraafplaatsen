import { CONFIG } from "./config.js";

const [esriConfig, WebMap, MapView, FeatureLayer, Graphic] = await $arcgis.import([
  "@arcgis/core/config.js",
  "@arcgis/core/WebMap.js",
  "@arcgis/core/views/MapView.js",
  "@arcgis/core/layers/FeatureLayer.js",
  "@arcgis/core/Graphic.js",
]);

const $ = (selector) => document.querySelector(selector);

const elements = {
  pageTitle: $("#pageTitle"),
  pageSubtitle: $("#pageSubtitle"),
  searchForm: $("#searchForm"),
  searchInput: $("#searchInput"),
  searchButton: $("#searchButton"),
  clearSearchButton: $("#clearSearchButton"),
  clearFiltersButton: $("#clearFiltersButton"),
  cemeteryFilter: $("#cemeteryFilter"),
  yearFilter: $("#yearFilter"),
  activeFilterBadge: $("#activeFilterBadge"),
  resultStatus: $("#resultStatus"),
  messagePanel: $("#messagePanel"),
  messageTitle: $("#messageTitle"),
  messageText: $("#messageText"),
  resultsList: $("#resultsList"),
  desktopDetail: $("#desktopDetail"),
  desktopDetailTitle: $("#desktopDetailTitle"),
  desktopDetailBody: $("#desktopDetailBody"),
  mobileDetail: $("#mobileDetail"),
  mobileDetailTitle: $("#mobileDetailTitle"),
  mobileDetailBody: $("#mobileDetailBody"),
  mobileBackButton: $("#mobileBackButton"),
  mapLoading: $("#mapLoading"),
  fatalError: $("#fatalError"),
  fatalErrorText: $("#fatalErrorText"),
};

const state = {
  view: null,
  webmap: null,
  searchSources: [],
  results: [],
  selectedKey: null,
  highlightGraphic: null,
  searchSequence: 0,
};

const PATTERNS = {
  fullName: [
    "zoeknaam",
    "volledige naam",
    "volledigenaam",
    "naam overledene",
    "naam_overledene",
    "naamoverledene",
    "overledene",
    "deceased name",
    "full name",
    "fullname",
  ],
  firstName: ["voornaam", "voornamen", "first name", "firstname", "given name", "givenname"],
  lastName: ["achternaam", "familienaam", "family name", "lastname", "last name", "surname"],
  genericName: ["naam", "name"],
  cemetery: ["begraafplaats", "kerkhof", "cemetery"],
  deathYear: ["overlijdensjaar", "jaar overlijden", "sterfjaar", "death year"],
  deathDate: ["overlijdensdatum", "datum overlijden", "sterfdatum", "date of death", "death date"],
  birthYear: ["geboortejaar", "jaar geboorte", "birth year"],
  birthDate: ["geboortedatum", "datum geboorte", "date of birth", "birth date"],
  concessionEnd: [
    "concessie tot",
    "einde concessie",
    "einddatum concessie",
    "concessie_einde",
    "concessieeinde",
  ],
  grave: [
    "grafnummer",
    "graf nr",
    "grafnr",
    "graf_nummer",
    "vak",
    "rij",
    "sectie",
    "perceel",
    "zone",
    "plot",
    "grave",
  ],
};

function normalized(value = "") {
  return String(value)
    .toLocaleLowerCase("nl-BE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldText(field) {
  return normalized(`${field.name || ""} ${field.alias || ""}`);
}

function hasPattern(field, patterns) {
  const text = fieldText(field);
  return patterns.some((pattern) => text.includes(normalized(pattern)));
}

function isStringField(field) {
  const type = String(field.type || "").toLowerCase();
  return type.includes("string");
}

function isDateField(field) {
  const type = String(field.type || "").toLowerCase();
  return type.includes("date");
}

function isNumericField(field) {
  const type = String(field.type || "").toLowerCase();
  return ["integer", "small-integer", "double", "single", "oid"].some((value) => type.includes(value));
}

function findFields(layer, configuredNames, patterns, { stringsOnly = false, datesOnly = false } = {}) {
  const fields = layer.fields || [];
  const configured = (configuredNames || [])
    .map((name) => fields.find((field) => normalized(field.name) === normalized(name)))
    .filter(Boolean);

  if (configured.length) return configured;

  return fields.filter((field) => {
    if (stringsOnly && !isStringField(field)) return false;
    if (datesOnly && !isDateField(field)) return false;
    return hasPattern(field, patterns);
  });
}

function findFirstField(layer, configuredName, patterns, options = {}) {
  if (configuredName) {
    const exact = (layer.fields || []).find((field) => normalized(field.name) === normalized(configuredName));
    if (exact) return exact;
  }
  return findFields(layer, [], patterns, options)[0] || null;
}

function pickPersonNameFields(layer) {
  const configuredSearch = CONFIG.data.searchFields || [];
  const configured = configuredSearch
    .map((name) => layer.fields.find((field) => normalized(field.name) === normalized(name)))
    .filter(Boolean);

  if (configured.length) return configured;

  const full = findFields(layer, CONFIG.data.fullNameFields, PATTERNS.fullName, { stringsOnly: true });
  const first = findFields(layer, CONFIG.data.firstNameFields, PATTERNS.firstName, { stringsOnly: true });
  const last = findFields(layer, CONFIG.data.lastNameFields, PATTERNS.lastName, { stringsOnly: true });

  const personSpecific = uniqueFields([...full, ...first, ...last]);
  if (personSpecific.length) return personSpecific;

  // Fallback: een generiek veld "Naam" alleen gebruiken wanneer de laag zelf
  // duidelijk over personen/overledenen/graven gaat.
  const layerHint = normalized(layer.title || "");
  if (/(overled|persoon|deceased|graf|concess)/.test(layerHint)) {
    return findFields(layer, [], PATTERNS.genericName, { stringsOnly: true }).slice(0, 2);
  }

  return [];
}

function uniqueFields(fields) {
  const seen = new Set();
  return fields.filter((field) => {
    if (!field || seen.has(field.name)) return false;
    seen.add(field.name);
    return true;
  });
}

function scoreLayer(layer, searchFields) {
  const title = normalized(layer.title || "");
  let score = searchFields.length * 4;
  if (title.includes("overled")) score += 12;
  if (title.includes("persoon")) score += 8;
  if (title.includes("graf")) score += 6;
  if (title.includes("concess")) score += 4;
  if (title.includes("begraaf")) score += 2;
  if (/(pad|boom|groen|gebouw|toilet|parking|vakgrens|sectorgrens)/.test(title)) score -= 8;
  return score;
}

function sourceMetadata(layer) {
  const searchFields = pickPersonNameFields(layer);
  const fullNameFields = findFields(layer, CONFIG.data.fullNameFields, PATTERNS.fullName, { stringsOnly: true });
  const firstNameFields = findFields(layer, CONFIG.data.firstNameFields, PATTERNS.firstName, { stringsOnly: true });
  const lastNameFields = findFields(layer, CONFIG.data.lastNameFields, PATTERNS.lastName, { stringsOnly: true });

  const genericNameField = findFields(layer, [], PATTERNS.genericName, { stringsOnly: true })[0] || null;

  return {
    layer,
    searchFields,
    fullNameFields,
    firstNameFields,
    lastNameFields,
    genericNameField,
    cemeteryField: findFirstField(layer, CONFIG.data.cemeteryField, PATTERNS.cemetery),
    deathYearField: findFirstField(layer, CONFIG.data.deathYearField, PATTERNS.deathYear),
    deathDateField: findFirstField(layer, CONFIG.data.deathDateField, PATTERNS.deathDate, { datesOnly: true }),
    birthYearField: findFirstField(layer, CONFIG.data.birthYearField, PATTERNS.birthYear),
    birthDateField: findFirstField(layer, CONFIG.data.birthDateField, PATTERNS.birthDate, { datesOnly: true }),
    concessionEndField: findFirstField(layer, CONFIG.data.concessionEndField, PATTERNS.concessionEnd),
    concessionDurationField: findFirstField(layer, CONFIG.data.concessionDurationField, ["duur concessie", "concessieduur", "duur"]),
    graveFields: findFields(layer, CONFIG.data.graveFields, PATTERNS.grave).slice(0, 4),
  };
}

function matchesConfiguredLayer(layer) {
  const ids = (CONFIG.data.searchLayerIds || []).map(normalized);
  const titles = (CONFIG.data.searchLayerTitles || []).map(normalized);
  if (!ids.length && !titles.length) return true;
  return ids.includes(normalized(layer.id)) || titles.includes(normalized(layer.title));
}

function matchesConfiguredSublayer(sublayer) {
  const titles = (CONFIG.data.searchSublayerTitles || []).map(normalized);
  if (!titles.length) return true;
  return titles.includes(normalized(sublayer.title));
}

async function featureLayerFromSublayer(parentLayer, sublayer) {
  // createFeatureLayer() bewaart de velddefinities van de MapServer-sublayer.
  // De URL-fallback maakt de app ook bruikbaar wanneer die methode niet
  // beschikbaar is in een toekomstige SDK-versie.
  let featureLayer = null;
  if (typeof sublayer.createFeatureLayer === "function") {
    try {
      featureLayer = await sublayer.createFeatureLayer();
    } catch (error) {
      console.warn("Sublayer kon niet rechtstreeks als FeatureLayer worden aangemaakt:", sublayer.title, error);
    }
  }

  if (!featureLayer && parentLayer.url && Number.isFinite(Number(sublayer.id))) {
    featureLayer = new FeatureLayer({
      url: `${String(parentLayer.url).replace(/\/$/, "")}/${sublayer.id}`,
      title: sublayer.title,
    });
  }

  if (!featureLayer) return null;
  await featureLayer.load();
  return featureLayer;
}

async function discoverSearchSources(webmap) {
  const configuredParents = webmap.allLayers.toArray().filter(matchesConfiguredLayer);
  const candidates = [];

  async function inspectLayer(layer, rootTitle, requireSublayerMatch = false) {
    await layer.load();

    if (layer.type === "feature") {
      if (!requireSublayerMatch || matchesConfiguredSublayer(layer)) {
        candidates.push({
          layer,
          parentTitle: rootTitle || layer.title,
          sublayerTitle: rootTitle && rootTitle !== layer.title ? layer.title : null,
        });
      }
      return;
    }

    if (layer.type === "map-image") {
      const sublayers = layer.allSublayers?.toArray?.() || [];
      for (const sublayer of sublayers.filter(matchesConfiguredSublayer)) {
        try {
          await sublayer.load?.();
          const featureLayer = await featureLayerFromSublayer(layer, sublayer);
          if (featureLayer) {
            candidates.push({
              layer: featureLayer,
              parentTitle: rootTitle || layer.title,
              sublayerTitle: sublayer.title,
            });
          }
        } catch (error) {
          console.warn("Zoeksublayer kon niet worden geladen:", sublayer.title, error);
        }
      }
      return;
    }

    if (layer.type === "group") {
      const children = layer.layers?.toArray?.() || layer.allLayers?.toArray?.() || [];
      for (const child of children) {
        try {
          // Binnen een groep kan 0000_LABELS zelf een FeatureLayer zijn,
          // of een MapImageLayer kan de 0000_LABELS-sublayer bevatten.
          const childNeedsMatch = child.type === "feature";
          await inspectLayer(child, rootTitle || layer.title, childNeedsMatch);
        } catch (error) {
          console.warn("Onderliggende zoeklaag kon niet worden geladen:", child.title, error);
        }
      }
    }
  }

  for (const layer of configuredParents) {
    try {
      await inspectLayer(layer, layer.title, false);
    } catch (error) {
      console.warn("Zoeklaag kon niet worden geladen:", layer.title, error);
    }
  }

  // Verwijder eventuele dubbels wanneer webmap/groupstructuren dezelfde bron
  // via meer dan één pad exposen.
  const uniqueCandidates = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = `${candidate.layer.url || candidate.layer.id}|${candidate.layer.layerId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueCandidates.push(candidate);
  }

  const loaded = [];
  for (const candidate of uniqueCandidates) {
    const meta = sourceMetadata(candidate.layer);
    const score = scoreLayer(candidate.layer, meta.searchFields) + 20; // expliciet geconfigureerde bron
    if (meta.searchFields.length) {
      loaded.push({ ...meta, ...candidate, score });
    }
  }

  loaded.sort((a, b) => b.score - a.score);
  return loaded;
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function cleanSearchText(value) {
  return String(value)
    .replace(/[%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNameWhere(source, searchText) {
  const tokens = cleanSearchText(searchText)
    .split(" ")
    .filter(Boolean)
    .slice(0, 8);

  if (!tokens.length) return "1=1";

  const perToken = tokens.map((token) => {
    const safe = escapeSql(token.toLocaleUpperCase("nl-BE"));
    const fields = source.searchFields.map((field) => `UPPER(${field.name}) LIKE '%${safe}%'`);
    return `(${fields.join(" OR ")})`;
  });

  return perToken.join(" AND ");
}

function buildServerFilterWhere(source) {
  const clauses = [];
  const cemetery = elements.cemeteryFilter.value;
  const year = elements.yearFilter.value.trim();

  if (cemetery && source.cemeteryField) {
    clauses.push(`${source.cemeteryField.name} = '${escapeSql(cemetery)}'`);
  }

  if (year) {
    const value = Number(year);
    if (Number.isInteger(value) && value >= 1800 && value <= 2200) {
      if (source.deathYearField && !isDateField(source.deathYearField)) {
        clauses.push(
          isNumericField(source.deathYearField)
            ? `${source.deathYearField.name} = ${value}`
            : `${source.deathYearField.name} = '${escapeSql(String(value))}'`,
        );
      } else if (source.deathDateField) {
        // Filter het jaar server-side op het echte datumveld. Dit voorkomt dat
        // een jaarfilter alleen op de eerste N resultaten wordt toegepast.
        const start = `${value}-01-01`;
        const end = `${value + 1}-01-01`;
        clauses.push(
          `(${source.deathDateField.name} >= DATE '${start}' AND ${source.deathDateField.name} < DATE '${end}')`,
        );
      }
    }
  }

  return clauses;
}

function getAttribute(attrs, field) {
  if (!field) return null;
  return attrs[field.name];
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value).trim();
}

function formatName(source, attrs) {
  const full = source.fullNameFields.map((field) => displayValue(getAttribute(attrs, field))).find(Boolean);
  if (full) return full;

  const last = source.lastNameFields.map((field) => displayValue(getAttribute(attrs, field))).find(Boolean);
  const first = source.firstNameFields.map((field) => displayValue(getAttribute(attrs, field))).find(Boolean);
  if (last || first) return [last, first].filter(Boolean).join(" ");

  const generic = displayValue(getAttribute(attrs, source.genericNameField));
  if (generic) return generic;

  const fallback = source.searchFields.map((field) => displayValue(getAttribute(attrs, field))).filter(Boolean);
  return fallback[0] || "Onbekende naam";
}

function extractYear(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && value >= 1000 && value <= 3000) return String(Math.trunc(value));
  if (typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return String(date.getFullYear());
  }
  const text = String(value).trim();
  const fourDigits = text.match(/\b(18|19|20|21)\d{2}\b/);
  if (fourDigits) return fourDigits[0];
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? "" : String(date.getFullYear());
}

function getYear(source, attrs, yearField, dateField) {
  const direct = extractYear(getAttribute(attrs, yearField));
  if (direct) return direct;
  return extractYear(getAttribute(attrs, dateField));
}

function formatDate(value) {
  if (value === null || value === undefined || value === "") return "";
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.valueOf())) return displayValue(value);
  return new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function getCemetery(source, attrs) {
  return displayValue(getAttribute(attrs, source.cemeteryField));
}

function getGraveParts(source, attrs) {
  return source.graveFields
    .map((field) => {
      const value = displayValue(getAttribute(attrs, field));
      if (!value) return null;
      const alias = displayValue(field.alias || field.name);
      return { label: alias, value };
    })
    .filter(Boolean);
}

function getObjectId(source, graphic) {
  const objectIdField = source.layer.objectIdField;
  return objectIdField ? graphic.attributes?.[objectIdField] : null;
}

function resultKey(source, graphic, index) {
  const oid = getObjectId(source, graphic);
  return `${source.layer.id}:${oid ?? index}`;
}

function passesClientFilters(result) {
  // Filters worden waar mogelijk server-side toegepast. Deze hook blijft
  // beschikbaar voor eventuele toekomstige client-side filters.
  return true;
}

async function querySource(source, searchText, perLayerLimit) {
  const query = source.layer.createQuery();
  const nameWhere = buildNameWhere(source, searchText);
  const extra = buildServerFilterWhere(source);
  query.where = [nameWhere, ...extra].filter(Boolean).join(" AND ");
  query.outFields = ["*"];
  query.returnGeometry = true;
  query.num = perLayerLimit;

  const featureSet = await source.layer.queryFeatures(query);
  return featureSet.features.map((graphic, index) => ({
    source,
    graphic,
    key: resultKey(source, graphic, index),
  }));
}

function isSearchAllowed() {
  const text = cleanSearchText(elements.searchInput.value);
  const hasFilter = Boolean(elements.cemeteryFilter.value || elements.yearFilter.value.trim());
  return text.length >= CONFIG.search.minimumCharacters || hasFilter;
}

async function runSearch({ preserveSelection = false } = {}) {
  if (!isSearchAllowed()) {
    showMessage(
      "Vul iets meer in",
      `Typ minstens ${CONFIG.search.minimumCharacters} letters van de naam of kies een filter.`,
    );
    elements.searchInput.focus();
    return;
  }

  const sequence = ++state.searchSequence;
  const text = cleanSearchText(elements.searchInput.value);
  setSearching(true);
  elements.resultStatus.textContent = "Zoeken…";

  try {
    const perLayerLimit = Math.max(20, Math.ceil(CONFIG.search.maximumResults / state.searchSources.length) + 10);
    const settled = await Promise.allSettled(
      state.searchSources.map((source) => querySource(source, text, perLayerLimit)),
    );

    if (sequence !== state.searchSequence) return;

    const rawResults = settled
      .filter((item) => item.status === "fulfilled")
      .flatMap((item) => item.value)
      .filter(passesClientFilters);

    const errors = settled.filter((item) => item.status === "rejected");
    if (errors.length) console.warn("Niet alle zoeklagen konden worden bevraagd:", errors);

    const deduped = deduplicateResults(rawResults)
      .sort((a, b) => formatName(a.source, a.graphic.attributes).localeCompare(formatName(b.source, b.graphic.attributes), "nl"))
      .slice(0, CONFIG.search.maximumResults);

    state.results = deduped;
    if (!preserveSelection) clearSelection({ keepMobileView: true });
    renderResults();
    updateQueryString(text);
  } catch (error) {
    console.error(error);
    showMessage(
      "Zoeken lukt momenteel niet",
      "De gegevensbron kon niet worden bevraagd. Probeer het opnieuw of controleer de ArcGIS-laag.",
    );
    elements.resultStatus.textContent = "Zoeken mislukt";
  } finally {
    if (sequence === state.searchSequence) setSearching(false);
  }
}

function deduplicateResults(results) {
  const seen = new Set();
  return results.filter((result) => {
    const oid = getObjectId(result.source, result.graphic);
    const key = `${result.source.layer.url || result.source.layer.id}:${result.source.layer.layerId ?? ""}:${oid}`;
    if (oid !== null && seen.has(key)) return false;
    if (oid !== null) seen.add(key);
    return true;
  });
}

function renderResults() {
  elements.resultsList.replaceChildren();
  const count = state.results.length;

  elements.clearSearchButton.hidden = false;
  elements.resultStatus.textContent = count === 1 ? "1 resultaat" : `${count} resultaten`;

  if (!count) {
    showMessage(CONFIG.text.noResultsTitle, CONFIG.text.noResultsText);
    return;
  }

  elements.messagePanel.hidden = true;
  elements.resultsList.hidden = false;

  const fragment = document.createDocumentFragment();
  for (const result of state.results) {
    fragment.appendChild(createResultCard(result));
  }
  elements.resultsList.appendChild(fragment);
}

function createResultCard(result) {
  const { source, graphic, key } = result;
  const attrs = graphic.attributes || {};
  const name = formatName(source, attrs);
  const birthYear = getYear(source, attrs, source.birthYearField, source.birthDateField);
  const deathYear = getYear(source, attrs, source.deathYearField, source.deathDateField);
  const cemetery = getCemetery(source, attrs);
  const grave = getGraveParts(source, attrs)
    .map((part) => `${part.label} ${part.value}`)
    .join(" · ");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "result-card";
  button.dataset.key = key;
  button.setAttribute("aria-pressed", key === state.selectedKey ? "true" : "false");
  button.setAttribute("aria-label", `${name}. Toon grafplaats op kaart.`);

  const life = birthYear && deathYear
    ? `${birthYear} – ${deathYear}`
    : deathYear
      ? `Overleden in ${deathYear}`
      : birthYear
        ? `Geboren in ${birthYear}`
        : "";
  const location = [cemetery, grave].filter(Boolean).join(" · ");

  button.innerHTML = `
    <div class="result-name"><span>${escapeHtml(name)}</span><span class="arrow" aria-hidden="true">›</span></div>
    ${life ? `<div class="result-life">${escapeHtml(life)}</div>` : ""}
    ${location ? `<div class="result-location">${escapeHtml(location)}</div>` : ""}
  `;

  button.addEventListener("click", () => selectResult(result));
  return button;
}

async function selectResult(result) {
  state.selectedKey = result.key;
  updateSelectedCards();
  renderDetail(result);

  if (state.highlightGraphic) {
    state.view.graphics.remove(state.highlightGraphic);
    state.highlightGraphic = null;
  }

  if (result.graphic.geometry) {
    const geometryType = result.graphic.geometry.type;
    let symbol = null;
    if (geometryType === "polygon") {
      symbol = {
        type: "simple-fill",
        color: [255, 218, 0, 0.2],
        outline: { color: [21, 63, 82, 1], width: 2.5 },
      };
    } else if (geometryType === "polyline") {
      symbol = { type: "simple-line", color: [21, 63, 82, 1], width: 3 };
    } else {
      symbol = {
        type: "simple-marker",
        color: [255, 218, 0, 0.9],
        size: 13,
        outline: { color: [21, 63, 82, 1], width: 2 },
      };
    }

    state.highlightGraphic = new Graphic({ geometry: result.graphic.geometry, symbol });
    state.view.graphics.add(state.highlightGraphic);
  }

  if (result.graphic.geometry) {
    try {
      await state.view.goTo(
        { target: result.graphic.geometry, scale: CONFIG.search.zoomScale },
        { duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650 },
      );
    } catch (error) {
      if (error?.name !== "AbortError") console.warn("Zoomen naar resultaat mislukte:", error);
    }
  }

  if (isMobile()) {
    document.body.classList.add("mobile-map-open");
    window.setTimeout(() => state.view?.resize(), 50);
  }
}

function updateSelectedCards() {
  document.querySelectorAll(".result-card").forEach((card) => {
    card.setAttribute("aria-pressed", card.dataset.key === state.selectedKey ? "true" : "false");
  });
}

function renderDetail(result) {
  const { source, graphic } = result;
  const attrs = graphic.attributes || {};
  const name = formatName(source, attrs);

  const rows = [];
  const birthYear = getYear(source, attrs, source.birthYearField, source.birthDateField);
  const deathYear = getYear(source, attrs, source.deathYearField, source.deathDateField);
  const cemetery = getCemetery(source, attrs);

  if (birthYear) rows.push(["Geboortejaar", birthYear]);

  const deathDateRaw = getAttribute(attrs, source.deathDateField);
  if (deathDateRaw !== null && deathDateRaw !== undefined && deathDateRaw !== "") {
    rows.push([source.deathDateField.alias || "Overlijdensdatum", formatDate(deathDateRaw)]);
  } else if (deathYear) {
    rows.push(["Overlijdensjaar", deathYear]);
  }

  if (cemetery) rows.push(["Begraafplaats", cemetery]);

  for (const grave of getGraveParts(source, attrs)) {
    rows.push([grave.label, grave.value]);
  }

  const concessionRaw = getAttribute(attrs, source.concessionEndField);
  if (concessionRaw !== null && concessionRaw !== undefined && concessionRaw !== "") {
    rows.push([source.concessionEndField.alias || "Einddatum concessie", formatDate(concessionRaw)]);
  }

  const durationRaw = getAttribute(attrs, source.concessionDurationField);
  if (durationRaw !== null && durationRaw !== undefined && durationRaw !== "") {
    rows.push([source.concessionDurationField.alias || "Duur concessie", displayValue(durationRaw)]);
  }

  const html = rows.length
    ? rows
        .map(
          ([label, value]) => `
            <div class="detail-row">
              <div class="detail-label">${escapeHtml(label)}</div>
              <div class="detail-value">${escapeHtml(value)}</div>
            </div>`,
        )
        .join("")
    : `<p class="small-text">Voor deze grafplaats zijn geen extra publieke gegevens beschikbaar.</p>`;

  elements.desktopDetailTitle.textContent = name;
  elements.desktopDetailBody.innerHTML = html;
  elements.desktopDetail.hidden = false;

  elements.mobileDetailTitle.textContent = name;
  elements.mobileDetailBody.innerHTML = html;
  elements.mobileDetail.hidden = false;
}

function clearSelection({ keepMobileView = false } = {}) {
  state.selectedKey = null;
  if (state.highlightGraphic) {
    state.view?.graphics.remove(state.highlightGraphic);
    state.highlightGraphic = null;
  }
  updateSelectedCards();
  elements.desktopDetail.hidden = true;
  elements.mobileDetail.hidden = true;
  if (!keepMobileView) document.body.classList.remove("mobile-map-open");
}

function showMessage(title, text) {
  elements.resultsList.hidden = true;
  elements.messagePanel.hidden = false;
  elements.messageTitle.textContent = title;
  elements.messageText.textContent = text;
}

function setSearching(searching) {
  elements.searchButton.disabled = searching;
  elements.searchButton.querySelector("span:last-child").textContent = searching ? "Zoeken…" : "Zoeken";
}

function clearSearch() {
  state.searchSequence += 1;
  state.results = [];
  elements.searchInput.value = "";
  elements.cemeteryFilter.value = "";
  elements.yearFilter.value = "";
  elements.resultStatus.textContent = "";
  elements.resultsList.replaceChildren();
  elements.resultsList.hidden = true;
  elements.clearSearchButton.hidden = true;
  updateFilterBadge();
  clearSelection();
  showMessage("Zoeken op naam", CONFIG.text.initialText);
  updateQueryString("");
  elements.searchInput.focus();
}

function updateFilterBadge() {
  const count = [elements.cemeteryFilter.value, elements.yearFilter.value.trim()].filter(Boolean).length;
  elements.activeFilterBadge.textContent = String(count);
  elements.activeFilterBadge.hidden = count === 0;
}

async function populateCemeteryOptions() {
  const values = new Set();

  await Promise.all(
    state.searchSources.map(async (source) => {
      if (!source.cemeteryField) return;
      try {
        const query = source.layer.createQuery();
        query.where = "1=1";
        query.outFields = [source.cemeteryField.name];
        query.returnGeometry = false;
        query.returnDistinctValues = true;
        query.orderByFields = [source.cemeteryField.name];
        query.num = 500;
        const result = await source.layer.queryFeatures(query);
        result.features.forEach((feature) => {
          const value = displayValue(feature.attributes?.[source.cemeteryField.name]);
          if (value) values.add(value);
        });
      } catch (error) {
        console.warn("Begraafplaatsen konden niet vooraf geladen worden:", error);
      }
    }),
  );

  const sorted = [...values].sort((a, b) => a.localeCompare(b, "nl"));
  if (!sorted.length) return;

  const fragment = document.createDocumentFragment();
  sorted.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    fragment.appendChild(option);
  });
  elements.cemeteryFilter.appendChild(fragment);
  elements.cemeteryFilter.disabled = false;
}

function updateQueryString(searchText) {
  const url = new URL(window.location.href);
  if (searchText) url.searchParams.set("q", searchText);
  else url.searchParams.delete("q");

  if (elements.cemeteryFilter.value) url.searchParams.set("begraafplaats", elements.cemeteryFilter.value);
  else url.searchParams.delete("begraafplaats");

  if (elements.yearFilter.value.trim()) url.searchParams.set("jaar", elements.yearFilter.value.trim());
  else url.searchParams.delete("jaar");

  history.replaceState(null, "", url);
}

function restoreQueryString() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q") || "";
  const year = params.get("jaar") || "";
  elements.searchInput.value = q;
  elements.yearFilter.value = year;
  return {
    q,
    year,
    cemetery: params.get("begraafplaats") || "",
  };
}

function isMobile() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showFatalError(error) {
  console.error(error);
  elements.fatalErrorText.textContent =
    error?.message || "Onbekende fout bij het laden van de ArcGIS-webmap of de zoeklagen.";
  elements.fatalError.hidden = false;
  elements.mapLoading.hidden = true;
}

function logDetectedConfiguration() {
  console.group("Zoek een overledene — gedetecteerde ArcGIS-configuratie");
  state.searchSources.forEach((source) => {
    console.log({
      parentLayer: source.parentTitle || null,
      sublayer: source.sublayerTitle || null,
      layer: source.layer.title,
      layerId: source.layer.id,
      serviceUrl: source.layer.url,
      searchFields: source.searchFields.map((field) => field.name),
      cemeteryField: source.cemeteryField?.name || null,
      deathYearField: source.deathYearField?.name || null,
      deathDateField: source.deathDateField?.name || null,
      concessionEndField: source.concessionEndField?.name || null,
      concessionDurationField: source.concessionDurationField?.name || null,
      graveFields: source.graveFields.map((field) => field.name),
      score: source.score,
    });
  });
  console.groupEnd();
}

async function initialize() {
  elements.pageTitle.textContent = CONFIG.appTitle;
  elements.pageSubtitle.textContent = CONFIG.appSubtitle;
  elements.searchInput.placeholder = CONFIG.text.searchPlaceholder;
  showMessage("Zoeken op naam", CONFIG.text.initialText);

  if (CONFIG.portalUrl) esriConfig.portalUrl = CONFIG.portalUrl;

  const restored = restoreQueryString();

  const webmap = new WebMap({
    portalItem: { id: CONFIG.webMapId },
  });
  state.webmap = webmap;

  const view = new MapView({
    container: "mapView",
    map: webmap,
    popupEnabled: false,
    constraints: { snapToZoom: false },
    highlightOptions: {
      fillOpacity: 0.18,
      haloOpacity: 1,
    },
  });
  state.view = view;

  await Promise.all([webmap.load(), view.when()]);
  elements.mapLoading.hidden = true;

  state.searchSources = await discoverSearchSources(webmap);
  if (!state.searchSources.length) {
    throw new Error(
      "De zoeklaag BZ_0000_Begraafplaats_Search / 0000_LABELS kon niet als bevraagbare publieke laag worden geladen. Controleer of de webmap en MapServer-sublayer publiek toegankelijk zijn.",
    );
  }

  logDetectedConfiguration();
  await populateCemeteryOptions();

  if (restored.cemetery && [...elements.cemeteryFilter.options].some((opt) => opt.value === restored.cemetery)) {
    elements.cemeteryFilter.value = restored.cemetery;
  }
  updateFilterBadge();

  if (restored.q || restored.year || restored.cemetery) {
    await runSearch();
  }
}

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch();
});

elements.cemeteryFilter.addEventListener("change", () => {
  updateFilterBadge();
  if (isSearchAllowed()) runSearch();
});

elements.yearFilter.addEventListener("change", () => {
  updateFilterBadge();
  if (isSearchAllowed()) runSearch();
});

elements.clearFiltersButton.addEventListener("click", () => {
  elements.cemeteryFilter.value = "";
  elements.yearFilter.value = "";
  updateFilterBadge();
  if (cleanSearchText(elements.searchInput.value).length >= CONFIG.search.minimumCharacters) runSearch();
});

elements.clearSearchButton.addEventListener("click", clearSearch);
elements.mobileBackButton.addEventListener("click", () => {
  document.body.classList.remove("mobile-map-open");
  window.setTimeout(() => state.view?.resize(), 50);
});

document.querySelectorAll(".close-detail").forEach((button) => {
  button.addEventListener("click", () => clearSelection({ keepMobileView: true }));
});

window.addEventListener("resize", () => {
  if (!isMobile()) document.body.classList.remove("mobile-map-open");
  state.view?.resize();
});

initialize().catch(showFatalError);
