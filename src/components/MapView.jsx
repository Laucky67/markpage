import { useState, useEffect, useCallback, useRef } from "react";
import Map, { Marker, Popup, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import TASKS from "../data/tasks";
import REFERENCE_BY_TASK_ID, { EMPTY_REFERENCE } from "../data/reference";
import { useMarkerStore } from "../store/useMarkerStore.jsx";
import "./MapView.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const REFERENCE_FILL_LAYER = {
  id: "reference-fill-layer",
  type: "fill",
  filter: ["==", ["geometry-type"], "Polygon"],
  paint: {
    "fill-color": "#3949ab",
    "fill-opacity": 0.16,
  },
};
const REFERENCE_OUTLINE_LAYER = {
  id: "reference-outline-layer",
  type: "line",
  filter: ["==", ["geometry-type"], "Polygon"],
  paint: {
    "line-color": "#3949ab",
    "line-width": 2,
  },
};
const REFERENCE_LINE_LAYER = {
  id: "reference-line-layer",
  type: "line",
  filter: ["==", ["geometry-type"], "LineString"],
  paint: {
    "line-color": "#3949ab",
    "line-width": 3,
    "line-dasharray": [1, 1],
  },
};
const REFERENCE_POINT_LAYER = {
  id: "reference-point-layer",
  type: "circle",
  filter: ["==", ["geometry-type"], "Point"],
  paint: {
    "circle-radius": 5,
    "circle-color": "#3949ab",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1.5,
  },
};
const REFERENCE_LABEL_LAYER = {
  id: "reference-label-layer",
  type: "symbol",
  layout: {
    "text-field": ["get", "name"],
    "text-size": 13,
    "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
    "text-offset": [0, 1],
    "text-anchor": "top",
    "text-allow-overlap": true,
  },
  paint: {
    "text-color": "#1a237e",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.2,
  },
};

export default function MapView() {
  const { currentTaskId, markers, drawMode, addPoint, addShape, removeItem } =
    useMarkerStore();
  const task = TASKS.find((t) => t.id === currentTaskId);
  const mapRef = useRef(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [draftState, setDraftState] = useState({ taskId: null, coordinates: [] });

  const [viewState, setViewState] = useState({
    longitude: task?.center[0] ?? 0,
    latitude: task?.center[1] ?? 0,
    zoom: task?.zoom ?? 12,
  });

  useEffect(() => {
    if (!task) return;
    mapRef.current?.flyTo({
      center: task.center,
      zoom: task.zoom,
      duration: 1200,
    });
  }, [task]);

  const draftCoords = draftState.taskId === currentTaskId ? draftState.coordinates : [];

  const handleClick = useCallback(
    (e) => {
      if (!currentTaskId) return;
      const hitFeature = e.features?.find((f) => {
        const shapeType = f.properties?.shapeType;
        return shapeType === "line" || shapeType === "polygon";
      });

      if (hitFeature) {
        const index = Number(hitFeature.properties?.index);
        const shapeType = hitFeature.properties?.shapeType;
        const shape = markers[currentTaskId]?.[shapeType]?.[index];
        if (shape) {
          setPopupInfo({
            type: shapeType,
            index,
            timestamp: shape.timestamp,
            vertexCount: shape.coordinates.length,
            lng: e.lngLat.lng,
            lat: e.lngLat.lat,
          });
        }
        return;
      }

      const { lng, lat } = e.lngLat;
      setPopupInfo(null);
      if (drawMode === "point") {
        addPoint(currentTaskId, lat, lng);
        return;
      }

      setDraftState((prev) => ({
        taskId: currentTaskId,
        coordinates: prev.taskId === currentTaskId ? [...prev.coordinates, [lng, lat]] : [[lng, lat]],
      }));
    },
    [currentTaskId, drawMode, addPoint, markers]
  );

  const taskMarkers = markers[currentTaskId] || { point: [], line: [], polygon: [] };
  const referenceData = REFERENCE_BY_TASK_ID[currentTaskId] || EMPTY_REFERENCE;

  const lineFeatures = taskMarkers.line.map((item, index) => ({
    type: "Feature",
    properties: { index, shapeType: "line", timestamp: item.timestamp },
    geometry: { type: "LineString", coordinates: item.coordinates },
  }));

  const polygonFeatures = taskMarkers.polygon.map((item, index) => {
    const ring = [...item.coordinates];
    if (ring.length > 0) {
      const [firstLng, firstLat] = ring[0];
      const [lastLng, lastLat] = ring[ring.length - 1];
      if (firstLng !== lastLng || firstLat !== lastLat) {
        ring.push([firstLng, firstLat]);
      }
    }
    return {
      type: "Feature",
      properties: { index, shapeType: "polygon", timestamp: item.timestamp },
      geometry: { type: "Polygon", coordinates: [ring] },
    };
  });

  const draftLineData = {
    type: "FeatureCollection",
    features:
      draftCoords.length >= 2
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: draftCoords },
            },
          ]
        : [],
  };

  const draftPolygonData = {
    type: "FeatureCollection",
    features:
      drawMode === "polygon" && draftCoords.length >= 3
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [[...draftCoords, draftCoords[0]]] },
            },
          ]
        : [],
  };

  const handleCompleteDraft = () => {
    const minPoints = drawMode === "line" ? 2 : 3;
    if (draftCoords.length < minPoints) {
      alert(drawMode === "line" ? "线标注至少需要 2 个点" : "面标注至少需要 3 个点");
      return;
    }
    addShape(currentTaskId, drawMode, draftCoords);
    setDraftState({ taskId: currentTaskId, coordinates: [] });
  };

  return (
    <div className="map-container">
      {(drawMode === "line" || drawMode === "polygon") && (
        <div className="draw-toolbar">
          <span>
            当前{drawMode === "line" ? "线" : "面"}草稿点数：{draftCoords.length}
          </span>
          <button onClick={handleCompleteDraft}>完成</button>
          <button onClick={() => setDraftState({ taskId: currentTaskId, coordinates: [] })}>
            取消
          </button>
        </div>
      )}
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        onClick={handleClick}
        interactiveLayerIds={["line-layer", "polygon-fill-layer", "polygon-outline-layer"]}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: "100%", height: "100%" }}
      >
        <Source
          id="reference-source"
          type="geojson"
          data={referenceData.featureCollection}
        >
          <Layer {...REFERENCE_FILL_LAYER} />
          <Layer {...REFERENCE_OUTLINE_LAYER} />
          <Layer {...REFERENCE_LINE_LAYER} />
          <Layer {...REFERENCE_POINT_LAYER} />
        </Source>

        <Source
          id="reference-label-source"
          type="geojson"
          data={referenceData.labelCollection}
        >
          <Layer {...REFERENCE_LABEL_LAYER} />
        </Source>

        <Source
          id="line-source"
          type="geojson"
          data={{ type: "FeatureCollection", features: lineFeatures }}
        >
          <Layer
            id="line-layer"
            type="line"
            paint={{ "line-color": "#ef6c00", "line-width": 3 }}
          />
        </Source>

        <Source
          id="polygon-source"
          type="geojson"
          data={{ type: "FeatureCollection", features: polygonFeatures }}
        >
          <Layer
            id="polygon-fill-layer"
            type="fill"
            paint={{ "fill-color": "#43a047", "fill-opacity": 0.25 }}
          />
          <Layer
            id="polygon-outline-layer"
            type="line"
            paint={{ "line-color": "#2e7d32", "line-width": 2 }}
          />
        </Source>

        <Source id="draft-line-source" type="geojson" data={draftLineData}>
          <Layer
            id="draft-line-layer"
            type="line"
            paint={{ "line-color": "#1e88e5", "line-width": 3, "line-dasharray": [2, 1] }}
          />
        </Source>

        <Source id="draft-polygon-source" type="geojson" data={draftPolygonData}>
          <Layer
            id="draft-polygon-fill-layer"
            type="fill"
            paint={{ "fill-color": "#1e88e5", "fill-opacity": 0.18 }}
          />
        </Source>

        {taskMarkers.point.map((m, i) => (
          <Marker
            key={`${currentTaskId}-${i}-${m.timestamp}`}
            longitude={m.lng}
            latitude={m.lat}
            anchor="center"
          >
            <div
              className="marker-circle"
              onClick={(e) => {
                e.stopPropagation();
                setPopupInfo({ ...m, index: i, type: "point" });
              }}
            >
              {i + 1}
            </div>
          </Marker>
        ))}

        {draftCoords.map((coord, i) => (
          <Marker key={`draft-${i}`} longitude={coord[0]} latitude={coord[1]} anchor="center">
            <div className="draft-point">{i + 1}</div>
          </Marker>
        ))}

        {popupInfo && (
          <Popup
            longitude={popupInfo.lng}
            latitude={popupInfo.lat}
            anchor="bottom"
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
          >
            <div className="popup-content">
              {popupInfo.type === "point" ? (
                <>
                  <p>
                    <strong>点标注 #{popupInfo.index + 1}</strong>
                  </p>
                  <p>经度: {popupInfo.lng.toFixed(6)}</p>
                  <p>纬度: {popupInfo.lat.toFixed(6)}</p>
                </>
              ) : (
                <>
                  <p>
                    <strong>{popupInfo.type === "line" ? "线" : "面"}标注 #{popupInfo.index + 1}</strong>
                  </p>
                  <p>顶点数: {popupInfo.vertexCount}</p>
                </>
              )}
              <p>
                时间:{" "}
                {new Date(popupInfo.timestamp).toLocaleString()}
              </p>
              <button
                className="popup-delete"
                onClick={() => {
                  removeItem(currentTaskId, popupInfo.type, popupInfo.index);
                  setPopupInfo(null);
                }}
              >
                删除
              </button>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
