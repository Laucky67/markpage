import { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import TASKS from "../data/tasks";

const STORAGE_KEY = "geolocus-markers";
const DRAW_MODES = ["point", "line", "polygon"];

function normalizeTaskMarkers(value) {
  if (Array.isArray(value)) {
    return { point: value, line: [], polygon: [] };
  }

  if (!value || typeof value !== "object") {
    return { point: [], line: [], polygon: [] };
  }

  return {
    point: Array.isArray(value.point) ? value.point : [],
    line: Array.isArray(value.line) ? value.line : [],
    polygon: Array.isArray(value.polygon) ? value.polygon : [],
  };
}

function buildInitialMarkers(rawData = {}) {
  const initial = {};
  TASKS.forEach((t) => {
    initial[t.id] = normalizeTaskMarkers(rawData[t.id]);
  });
  return initial;
}

function loadMarkers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return buildInitialMarkers(JSON.parse(raw));
  } catch {}
  return buildInitialMarkers();
}

function saveMarkers(markers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
}

const initialState = {
  currentTaskId: TASKS[0].id,
  markers: loadMarkers(),
  drawMode: "point",
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_CURRENT_TASK":
      return { ...state, currentTaskId: action.payload };

    case "SET_DRAW_MODE":
      return {
        ...state,
        drawMode: DRAW_MODES.includes(action.payload) ? action.payload : "point",
      };

    case "ADD_POINT": {
      const { taskId, point } = action.payload;
      const target = normalizeTaskMarkers(state.markers[taskId]);
      return {
        ...state,
        markers: {
          ...state.markers,
          [taskId]: { ...target, point: [...target.point, point] },
        },
      };
    }

    case "ADD_SHAPE": {
      const { taskId, shapeType, shape } = action.payload;
      if (!["line", "polygon"].includes(shapeType)) return state;
      const target = normalizeTaskMarkers(state.markers[taskId]);
      const list = [...target[shapeType], shape];
      return {
        ...state,
        markers: {
          ...state.markers,
          [taskId]: { ...target, [shapeType]: list },
        },
      };
    }

    case "REMOVE_ITEM": {
      const { taskId, itemType, index } = action.payload;
      if (!["point", "line", "polygon"].includes(itemType)) return state;
      const target = normalizeTaskMarkers(state.markers[taskId]);
      const list = [...target[itemType]];
      list.splice(index, 1);
      return {
        ...state,
        markers: {
          ...state.markers,
          [taskId]: { ...target, [itemType]: list },
        },
      };
    }

    case "CLEAR_MARKERS": {
      const { taskId } = action.payload;
      return {
        ...state,
        markers: {
          ...state.markers,
          [taskId]: { point: [], line: [], polygon: [] },
        },
      };
    }

    case "IMPORT_DATA":
      return {
        ...state,
        markers: buildInitialMarkers(action.payload),
      };

    default:
      return state;
  }
}

const MarkerContext = createContext(null);

export function MarkerProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    saveMarkers(state.markers);
  }, [state.markers]);

  return (
    <MarkerContext.Provider value={{ state, dispatch }}>
      {children}
    </MarkerContext.Provider>
  );
}

export function useMarkerStore() {
  const ctx = useContext(MarkerContext);
  if (!ctx) throw new Error("useMarkerStore must be used within MarkerProvider");
  const { state, dispatch } = ctx;

  const setCurrentTask = useCallback(
    (taskId) => dispatch({ type: "SET_CURRENT_TASK", payload: taskId }),
    [dispatch]
  );

  const setDrawMode = useCallback(
    (mode) => dispatch({ type: "SET_DRAW_MODE", payload: mode }),
    [dispatch]
  );

  const addPoint = useCallback(
    (taskId, lat, lng) =>
      dispatch({
        type: "ADD_POINT",
        payload: { taskId, point: { lat, lng, timestamp: Date.now() } },
      }),
    [dispatch]
  );

  const addShape = useCallback(
    (taskId, shapeType, coordinates) =>
      dispatch({
        type: "ADD_SHAPE",
        payload: {
          taskId,
          shapeType,
          shape: { coordinates, timestamp: Date.now() },
        },
      }),
    [dispatch]
  );

  const removeItem = useCallback(
    (taskId, itemType, index) =>
      dispatch({ type: "REMOVE_ITEM", payload: { taskId, itemType, index } }),
    [dispatch]
  );

  const clearMarkers = useCallback(
    (taskId) => dispatch({ type: "CLEAR_MARKERS", payload: { taskId } }),
    [dispatch]
  );

  const importData = useCallback(
    (data) => dispatch({ type: "IMPORT_DATA", payload: data }),
    [dispatch]
  );

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(state.markers, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geolocus-markers-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.markers]);

  return {
    currentTaskId: state.currentTaskId,
    markers: state.markers,
    drawMode: state.drawMode,
    setCurrentTask,
    setDrawMode,
    addPoint,
    addShape,
    removeItem,
    clearMarkers,
    importData,
    exportData,
  };
}
