import { useState } from "react";
import CampusView from "./components/CampusView";
import BuildingView from "./components/BuildingView";

// Two-level UX: outer campus map -> click a building -> indoor floor view.
function App() {
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
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