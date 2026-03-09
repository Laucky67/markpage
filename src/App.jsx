import Sidebar from "./components/Sidebar";
import TaskDetail from "./components/TaskDetail";
import MapView from "./components/MapView";
import "./App.css";

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <TaskDetail />
        <MapView />
      </div>
    </div>
  );
}
