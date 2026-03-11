import { useState, useCallback, useEffect } from "react";
import { useMap, Source, Layer, Marker } from "react-map-gl/mapbox";
import { useTranslation } from "react-i18next";
import "./MeasureTool.css";

const MEASURE_LINE_LAYER = {
  id: "measure-line-layer",
  type: "line",
  paint: {
    "line-color": "#1976d2",
    "line-width": 2.5,
    "line-dasharray": [2, 1],
  },
};

function haversine(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDist(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export default function MeasureTool({ onMeasuringChange }) {
  const { current: mapRef } = useMap();
  const { t } = useTranslation("ui");
  const [active, setActive] = useState(false);
  const [points, setPoints] = useState([]);

  useEffect(() => {
    onMeasuringChange?.(active);
  }, [active, onMeasuringChange]);

  const handleMapClick = useCallback((e) => {
    setPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
  }, []);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    if (active) {
      map.getCanvas().style.cursor = "crosshair";
      map.on("click", handleMapClick);
    }
    return () => {
      map.getCanvas().style.cursor = "";
      map.off("click", handleMapClick);
    };
  }, [active, mapRef, handleMapClick]);

  const toggle = () => {
    setActive((prev) => {
      if (prev) setPoints([]);
      return !prev;
    });
  };

  const clear = () => setPoints([]);

  const segments = [];
  let totalDist = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i]);
    segments.push({ midLng: (points[i - 1][0] + points[i][0]) / 2, midLat: (points[i - 1][1] + points[i][1]) / 2, dist: d });
    totalDist += d;
  }

  const lineData = {
    type: "FeatureCollection",
    features:
      points.length >= 2
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } }]
        : [],
  };

  return (
    <>
      <button
        className={`measure-toggle${active ? " measure-toggle--active" : ""}`}
        onClick={toggle}
        title={t("measure.toggle")}
      >
        &#x1F4CF;
      </button>

      {active && (
        <>
          <Source id="measure-line-source" type="geojson" data={lineData}>
            <Layer {...MEASURE_LINE_LAYER} />
          </Source>

          {points.map((pt, i) => (
            <Marker key={`mp-${i}`} longitude={pt[0]} latitude={pt[1]} anchor="center">
              <div className="measure-point" />
            </Marker>
          ))}

          {segments.map((seg, i) => (
            <Marker key={`ml-${i}`} longitude={seg.midLng} latitude={seg.midLat} anchor="center">
              <div className="measure-label">{formatDist(seg.dist)}</div>
            </Marker>
          ))}

          {points.length === 0 && (
            <div className="measure-hint">{t("measure.clickToStart")}</div>
          )}

          {points.length >= 2 && (
            <div className="measure-panel">
              <span>{t("measure.totalDistance")}: {formatDist(totalDist)}</span>
              <span>{t("measure.segmentCount")}: {segments.length}</span>
              <button onClick={clear}>{t("measure.clear")}</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
