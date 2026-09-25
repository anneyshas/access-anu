import { useState } from "react";
import CampusView from "./components/CampusView";
import BuildingView from "./components/BuildingView";

// Two-level UX: outdoor campus map <-> indoor building view.
// `intent` carries what to do on arrival inside (e.g. directions from the
// entrance you walked to, to the room you searched for on the campus map).
function App() {
  const [indoor, setIndoor] = useState(null); // { building, intent } | null

  return (
    <div className="relative h-[100dvh] w-full max-w-full overflow-hidden">
      {indoor ? (
        <BuildingView building={indoor.building} intent={indoor.intent} onBack={() => setIndoor(null)} />
      ) : (
        <CampusView onEnterBuilding={(building, intent) => setIndoor({ building, intent })} />
      )}
    </div>
  );
}

export default App;