import { useState } from 'react';
import Sidebar from './Components/Sidebar';
import Controller from './Components/Controller';
import Footer from './Components/Footer';

function App() {
  const [view, setView] = useState("transcribe");

  return (
    <>
      <div className="min-h-screen flex flex-col md:flex-row">
        {/* Sidebar stacks vertically on small screens, becomes horizontal at md */}
        <Sidebar setView={setView} />

        {/* Main content grows and scrolls n if necessary */}
        <div className="flex-1 px-4 py-2 bg-gray-100">
          <Controller view={view} />
        </div>
      </div>

      <Footer />
    </>
  );
}

export default App;
