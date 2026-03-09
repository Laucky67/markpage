import { useRef } from "react";
import TASKS from "../data/tasks";
import { useMarkerStore } from "../store/useMarkerStore.jsx";
import "./Sidebar.css";

export default function Sidebar() {
  const { currentTaskId, markers, setCurrentTask, exportData, importData } =
    useMarkerStore();
  const fileRef = useRef(null);

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        importData(data);
      } catch {
        alert("无效的 JSON 文件");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>GeoLocus 标注工具</h2>
        <div className="sidebar-actions">
          <button onClick={exportData}>导出 JSON</button>
          <button onClick={() => fileRef.current?.click()}>导入 JSON</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleImport}
          />
        </div>
      </div>
      <div className="task-list">
        {TASKS.map((task) => {
          const taskMarkers = markers[task.id] || { point: [], line: [], polygon: [] };
          const count =
            taskMarkers.point.length + taskMarkers.line.length + taskMarkers.polygon.length;
          return (
            <div
              key={task.id}
              className={`task-item ${task.id === currentTaskId ? "active" : ""}`}
              onClick={() => setCurrentTask(task.id)}
            >
              <span className="task-id">{task.id}</span>
              <span className="task-desc">
                {task.description.length > 30
                  ? task.description.slice(0, 30) + "…"
                  : task.description}
              </span>
              <span className={`task-badge ${count === 0 ? "empty" : ""}`}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
