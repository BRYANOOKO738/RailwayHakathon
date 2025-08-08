import { Mic, Clapperboard, Brain,ShieldAlert } from "lucide-react";

export default function Sidebar({ setView }) {
  return (
    <div className="w-full md:w-64 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white p-0">
      <img src="/logo.svg" alt="Logo" className="w-full h-35 mx-3 block" />

      <ul className="space-y-2 p-4 pt-0 mt-0">
        <li
          className="flex items-center gap-3 cursor-pointer hover:bg-white hover:text-black px-4 py-2 rounded transition"
          onClick={() => setView("transcribe")}
        >
          <Mic className="w-5 h-5" />
          TRANSCRIPTION
        </li>
{/* vg */}
        <li
          className="flex items-center gap-3 cursor-pointer hover:bg-white hover:text-black px-4 py-2 rounded transition"
          onClick={() => setView("daab")}
        >
          <Clapperboard className="w-5 h-5" />
          VIDEO DUBBING
        </li>

        
      </ul>
    </div>
  );
}
