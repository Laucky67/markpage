import { useRef } from "react";
import { useTranslation } from "react-i18next";
import TASKS from "../data/tasks";
import { useMarkerStore } from "../store/useMarkerStore.jsx";
import LanguageSwitcher from "./LanguageSwitcher";
import "./Sidebar.css";

export default function Sidebar() {
  const { currentTaskId, markers, setCurrentTask, exportData, importData } =
    useMarkerStore();
  const { t } = useTranslation("ui");
  const { t: tTasks } = useTranslation("tasks");
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
        alert(t("invalidJson"));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <h2>{t("appTitle")}</h2>
          <LanguageSwitcher />
        </div>
        <div className="sidebar-actions">
          <button onClick={exportData}>{t("exportJson")}</button>
          <button onClick={() => fileRef.current?.click()}>{t("importJson")}</button>
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
          const desc = tTasks(task.id, { defaultValue: task.description });
          return (
            <div
              key={task.id}
              className={`task-item ${task.id === currentTaskId ? "active" : ""}`}
              onClick={() => setCurrentTask(task.id)}
            >
              <span className="task-id">{task.id}</span>
              <span className="task-desc">
                {desc.length > 30 ? desc.slice(0, 30) + "…" : desc}
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
