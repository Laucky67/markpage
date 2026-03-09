import TASKS from "../data/tasks";
import { useMarkerStore } from "../store/useMarkerStore.jsx";
import "./TaskDetail.css";

export default function TaskDetail() {
  const { currentTaskId, markers, drawMode, setDrawMode, clearMarkers } = useMarkerStore();
  const task = TASKS.find((t) => t.id === currentTaskId);
  if (!task) return null;

  const taskMarkers = markers[task.id] || { point: [], line: [], polygon: [] };
  const pointCount = taskMarkers.point.length;
  const lineCount = taskMarkers.line.length;
  const polygonCount = taskMarkers.polygon.length;
  const count = pointCount + lineCount + polygonCount;

  const handleClear = () => {
    if (count === 0) return;
    if (window.confirm(`确定清除 ${task.id} 的所有 ${count} 个标记？`)) {
      clearMarkers(task.id);
    }
  };

  return (
    <div className="task-detail">
      <div className="task-detail-info">
        <h3>{task.id}</h3>
        <p>{task.description}</p>
      </div>
      <div className="task-detail-actions">
        <div className="mode-switch">
          <button
            className={drawMode === "point" ? "active" : ""}
            onClick={() => setDrawMode("point")}
          >
            点
          </button>
          <button
            className={drawMode === "line" ? "active" : ""}
            onClick={() => setDrawMode("line")}
          >
            线
          </button>
          <button
            className={drawMode === "polygon" ? "active" : ""}
            onClick={() => setDrawMode("polygon")}
          >
            面
          </button>
        </div>
        <span className="marker-count">
          点 {pointCount} / 线 {lineCount} / 面 {polygonCount}（总计 {count}）
        </span>
        <button className="clear-btn" onClick={handleClear}>
          清除标记
        </button>
      </div>
    </div>
  );
}
