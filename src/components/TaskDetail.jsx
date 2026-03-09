import { useTranslation } from "react-i18next";
import TASKS from "../data/tasks";
import { useMarkerStore } from "../store/useMarkerStore.jsx";
import "./TaskDetail.css";

export default function TaskDetail() {
  const { currentTaskId, markers, drawMode, setDrawMode, clearMarkers } = useMarkerStore();
  const { t } = useTranslation("ui");
  const { t: tTasks } = useTranslation("tasks");
  const task = TASKS.find((tk) => tk.id === currentTaskId);
  if (!task) return null;

  const taskMarkers = markers[task.id] || { point: [], line: [], polygon: [] };
  const pointCount = taskMarkers.point.length;
  const lineCount = taskMarkers.line.length;
  const polygonCount = taskMarkers.polygon.length;
  const count = pointCount + lineCount + polygonCount;

  const handleClear = () => {
    if (count === 0) return;
    if (window.confirm(t("confirmClear", { taskId: task.id, count }))) {
      clearMarkers(task.id);
    }
  };

  return (
    <div className="task-detail">
      <div className="task-detail-info">
        <h3>{task.id}</h3>
        <p>{tTasks(task.id, { defaultValue: task.description })}</p>
      </div>
      <div className="task-detail-actions">
        <div className="mode-switch">
          <button
            className={drawMode === "point" ? "active" : ""}
            onClick={() => setDrawMode("point")}
          >
            {t("drawMode.point")}
          </button>
          <button
            className={drawMode === "line" ? "active" : ""}
            onClick={() => setDrawMode("line")}
          >
            {t("drawMode.line")}
          </button>
          <button
            className={drawMode === "polygon" ? "active" : ""}
            onClick={() => setDrawMode("polygon")}
          >
            {t("drawMode.polygon")}
          </button>
        </div>
        <span className="marker-count">
          {t("markerCount", { point: pointCount, line: lineCount, polygon: polygonCount, total: count })}
        </span>
        <button className="clear-btn" onClick={handleClear}>
          {t("clearMarkers")}
        </button>
      </div>
    </div>
  );
}
