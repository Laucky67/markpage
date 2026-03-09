import TASKS from "../tasks";

const RAW_REFERENCE_MODULES = import.meta.glob("./*.{json,geojson}", {
  eager: true,
  import: "default",
  query: "?raw",
});

const TASK_FILE_PATTERN = /^(t\d+-\d+)(.*)\.(json|geojson)$/i;
const AUXILIARY_TOKEN_PATTERN = /^(center|copy|s\d*)$/i;
const BASE_ITEM_KEY = "__base__";
const WEB_MERCATOR_RADIUS = 6378137;

function createFeatureCollection(features = []) {
  return { type: "FeatureCollection", features };
}

function createReferenceEntry({
  features = [],
  labels = [],
  sourceFiles = [],
  unresolvedLandmarks = [],
} = {}) {
  const labelFeatures = labels
    .filter((label) => Array.isArray(label.coordinates) && label.coordinates.length >= 2)
    .map((label, index) => ({
      type: "Feature",
      properties: {
        index,
        name: label.name,
        sourceFile: label.sourceFile,
      },
      geometry: {
        type: "Point",
        coordinates: label.coordinates,
      },
    }));

  return {
    featureCollection: createFeatureCollection(features),
    labelCollection: createFeatureCollection(labelFeatures),
    features,
    labels,
    sourceFiles,
    unresolvedLandmarks,
  };
}

export const EMPTY_REFERENCE = createReferenceEntry();

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isFeatureCollection(document) {
  return document?.type === "FeatureCollection" && Array.isArray(document.features);
}

function getDocumentKind(document) {
  if (isFeatureCollection(document)) return "geometry";
  if (document && typeof document === "object" && Array.isArray(document.landmarks)) {
    return "placeholder";
  }
  return "unknown";
}

function shouldIgnoreStem(stem) {
  return /(?:^|[\s-])copy$/i.test(stem);
}

function getItemKey(taskId, stem) {
  const suffix = stem.slice(taskId.length).replace(/^[-\s]+/, "");
  if (!suffix) return BASE_ITEM_KEY;

  const tokens = suffix.split("-").filter(Boolean);
  while (tokens.length > 0 && AUXILIARY_TOKEN_PATTERN.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join("-").trim() || BASE_ITEM_KEY;
}

function getVariantPenalty(taskId, stem) {
  const suffix = stem.slice(taskId.length).replace(/^[-\s]+/, "");
  if (!suffix) return 0;
  return suffix
    .split("-")
    .filter(Boolean)
    .some((token) => AUXILIARY_TOKEN_PATTERN.test(token))
    ? 1
    : 0;
}

function parseReferenceFile(modulePath, rawText) {
  const fileName = modulePath.split("/").pop();
  const match = fileName?.match(TASK_FILE_PATTERN);
  if (!match) return null;

  const [, taskId, , extension] = match;
  const stem = fileName.replace(/\.(json|geojson)$/i, "");
  if (shouldIgnoreStem(stem)) return null;

  let document;
  try {
    document = JSON.parse(rawText);
  } catch {
    return null;
  }

  return {
    taskId,
    fileName,
    stem,
    extension: extension.toLowerCase(),
    itemKey: getItemKey(taskId, stem),
    variantPenalty: getVariantPenalty(taskId, stem),
    document,
    kind: getDocumentKind(document),
  };
}

function getGeometrySourcePriority(entry) {
  if (entry.kind !== "geometry") return -1;
  return entry.extension === "json" ? 2 : 1;
}

function isBetterGeometrySource(candidate, current) {
  const priorityDelta = getGeometrySourcePriority(candidate) - getGeometrySourcePriority(current);
  if (priorityDelta !== 0) return priorityDelta > 0;

  if (candidate.variantPenalty !== current.variantPenalty) {
    return candidate.variantPenalty < current.variantPenalty;
  }

  return candidate.fileName.localeCompare(current.fileName, "zh-Hans-CN") < 0;
}

function collectCanonicalGeometryEntries(entries) {
  const selectedByItem = new Map();

  entries
    .filter((entry) => entry.kind === "geometry")
    .forEach((entry) => {
      const current = selectedByItem.get(entry.itemKey);
      if (!current || isBetterGeometrySource(entry, current)) {
        selectedByItem.set(entry.itemKey, entry);
      }
    });

  return [...selectedByItem.values()].sort((a, b) =>
    a.fileName.localeCompare(b.fileName, "zh-Hans-CN")
  );
}

function findFirstCoordinate(geometry) {
  if (!geometry || typeof geometry !== "object") return null;

  if (geometry.type === "GeometryCollection") {
    for (const item of geometry.geometries || []) {
      const coordinate = findFirstCoordinate(item);
      if (coordinate) return coordinate;
    }
    return null;
  }

  const { coordinates } = geometry;
  if (!Array.isArray(coordinates)) return null;

  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    return coordinates;
  }

  for (const child of coordinates) {
    const coordinate = findFirstCoordinate({ type: geometry.type, coordinates: child });
    if (coordinate) return coordinate;
  }

  return null;
}

function detectCoordinateSystem(document) {
  const crsName = normalizeText(document?.crs?.properties?.name).toUpperCase();
  if (crsName.includes("3857")) return "EPSG:3857";
  if (crsName.includes("4326") || crsName.includes("CRS84")) return "EPSG:4326";

  for (const feature of document?.features || []) {
    const coordinate = findFirstCoordinate(feature?.geometry);
    if (!coordinate) continue;

    const [x, y] = coordinate;
    if (Math.abs(x) > 180 || Math.abs(y) > 90) {
      return "EPSG:3857";
    }
    return "EPSG:4326";
  }

  return "EPSG:4326";
}

function mercatorToLngLat(coordinates) {
  const [x, y, ...rest] = coordinates;
  const longitude = (x / WEB_MERCATOR_RADIUS) * (180 / Math.PI);
  const latitude = (Math.atan(Math.sinh(y / WEB_MERCATOR_RADIUS)) * 180) / Math.PI;
  return [longitude, latitude, ...rest];
}

function transformCoordinatesToWgs84(coordinates) {
  if (!Array.isArray(coordinates)) return coordinates;

  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    return mercatorToLngLat(coordinates);
  }

  return coordinates.map(transformCoordinatesToWgs84);
}

function normalizeGeometry(geometry, coordinateSystem) {
  if (!geometry || typeof geometry !== "object") return geometry;

  if (coordinateSystem !== "EPSG:3857") {
    return geometry;
  }

  if (geometry.type === "GeometryCollection") {
    return {
      ...geometry,
      geometries: (geometry.geometries || []).map((item) =>
        normalizeGeometry(item, coordinateSystem)
      ),
    };
  }

  return {
    ...geometry,
    coordinates: transformCoordinatesToWgs84(geometry.coordinates),
  };
}

function inferNameFromDocument(entry) {
  if (entry.itemKey !== BASE_ITEM_KEY) return entry.itemKey;

  const documentName = normalizeText(entry.document?.name);
  if (!documentName) return "";

  const taskPrefixPattern = new RegExp(`^${escapeRegExp(entry.taskId)}(?:[-\\s]+)?`, "i");
  return documentName.replace(taskPrefixPattern, "").trim();
}

function inferFeatureName(feature, entry) {
  const featureName = normalizeText(feature?.properties?.name);
  if (featureName) return featureName;

  const displayName = normalizeText(feature?.properties?.display_name);
  if (displayName) {
    const [firstPart] = displayName.split(",");
    if (normalizeText(firstPart)) return normalizeText(firstPart);
  }

  return inferNameFromDocument(entry);
}

function collectPositions(geometry, positions = []) {
  if (!geometry || typeof geometry !== "object") return positions;

  switch (geometry.type) {
    case "Point":
      if (Array.isArray(geometry.coordinates)) positions.push(geometry.coordinates);
      break;
    case "MultiPoint":
    case "LineString":
      (geometry.coordinates || []).forEach((coordinate) => positions.push(coordinate));
      break;
    case "MultiLineString":
    case "Polygon":
      (geometry.coordinates || []).forEach((part) => {
        (part || []).forEach((coordinate) => positions.push(coordinate));
      });
      break;
    case "MultiPolygon":
      (geometry.coordinates || []).forEach((polygon) => {
        (polygon || []).forEach((ring) => {
          (ring || []).forEach((coordinate) => positions.push(coordinate));
        });
      });
      break;
    case "GeometryCollection":
      (geometry.geometries || []).forEach((item) => collectPositions(item, positions));
      break;
    default:
      break;
  }

  return positions;
}

function getBoundingBox(geometries) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let hasCoordinate = false;

  geometries.forEach((geometry) => {
    collectPositions(geometry).forEach((coordinate) => {
      const [lng, lat] = coordinate;
      if (typeof lng !== "number" || typeof lat !== "number") return;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
      hasCoordinate = true;
    });
  });

  if (!hasCoordinate) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function normalizeGeometryFeatures(entry) {
  const coordinateSystem = detectCoordinateSystem(entry.document);

  return (entry.document.features || [])
    .filter((feature) => feature?.type === "Feature" && feature.geometry)
    .map((feature, index) => {
      const name = inferFeatureName(feature, entry);
      return {
        type: "Feature",
        properties: {
          ...(feature.properties || {}),
          ...(name ? { name } : {}),
          referenceTaskId: entry.taskId,
          referenceSourceFile: entry.fileName,
          referenceItemKey: entry.itemKey,
          referenceFeatureIndex: index,
        },
        geometry: normalizeGeometry(feature.geometry, coordinateSystem),
      };
    });
}

function buildLabel(entry, features) {
  if (features.length === 0) return null;

  const name = normalizeText(features[0]?.properties?.name) || inferNameFromDocument(entry);
  if (!name) return null;

  const bounds = getBoundingBox(features.map((feature) => feature.geometry));
  if (!bounds) return null;

  const [minLng, minLat, maxLng, maxLat] = bounds;
  return {
    name,
    coordinates: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
    sourceFile: entry.fileName,
  };
}

function buildUnresolvedLandmarks(entries) {
  return entries
    .filter((entry) => entry.kind === "placeholder")
    .flatMap((entry) =>
      (entry.document.landmarks || [])
        .map((landmark) => ({
          name: normalizeText(landmark?.name),
          sourceFile: entry.fileName,
        }))
        .filter((landmark) => landmark.name)
    );
}

function buildReferenceEntry(entries) {
  const selectedGeometryEntries = collectCanonicalGeometryEntries(entries);
  const features = [];
  const labels = [];
  const seenLabels = new Set();

  selectedGeometryEntries.forEach((entry) => {
    const normalizedFeatures = normalizeGeometryFeatures(entry);
    features.push(...normalizedFeatures);

    const label = buildLabel(entry, normalizedFeatures);
    if (!label) return;

    const labelKey = `${label.name}:${label.coordinates.join(",")}`;
    if (seenLabels.has(labelKey)) return;
    seenLabels.add(labelKey);
    labels.push(label);
  });

  const sourceFiles = [
    ...new Set([
      ...selectedGeometryEntries.map((entry) => entry.fileName),
      ...entries
        .filter((entry) => entry.kind === "placeholder")
        .map((entry) => entry.fileName),
    ]),
  ].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  return createReferenceEntry({
    features,
    labels,
    sourceFiles,
    unresolvedLandmarks: buildUnresolvedLandmarks(entries),
  });
}

const parsedReferenceFiles = Object.entries(RAW_REFERENCE_MODULES)
  .map(([modulePath, rawText]) => parseReferenceFile(modulePath, rawText))
  .filter(Boolean);

const parsedByTaskId = parsedReferenceFiles.reduce((acc, entry) => {
  acc[entry.taskId] ??= [];
  acc[entry.taskId].push(entry);
  return acc;
}, {});

export const REFERENCE_BY_TASK_ID = TASKS.reduce((acc, task) => {
  acc[task.id] = buildReferenceEntry(parsedByTaskId[task.id] || []);
  return acc;
}, {});

export default REFERENCE_BY_TASK_ID;
