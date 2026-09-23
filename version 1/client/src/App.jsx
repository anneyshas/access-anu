import { useState } from "react";
import CampusView from "./components/CampusView";
import BuildingView from "./components/BuildingView";

// Two-level UX: outer campus map -> click a building -> indoor floor view.
function App() {
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {selectedBuilding ? (
        <BuildingView
          building={selectedBuilding}
          onBack={() => setSelectedBuilding(null)}
        />
      ) : (
        <CampusView onSelectBuilding={setSelectedBuilding} />
      )}
    </div>
  );
}

export default App;