import AudioTranscriberTool from "../AudioTranscriberTool";
import VideoDubber from "../Dubb";

// bn
export default function Controller({ view }) {
  if (view === "transcribe") return <AudioTranscriberTool />;
  if (view === "daab") return <VideoDubber />;
 
 
  return <div>Not Found</div>;
}
