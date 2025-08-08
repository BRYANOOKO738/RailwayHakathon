export default function Footer() {
    return (
      <footer className="bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white py-6 mt-2">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
          <div className="text-center md:text-left mb-4 md:mb-0">
            <h1 className="text-lg font-semibold">PulsePoint</h1>
            <p className="text-sm text-gray-300">Empowering the future with AI & code.</p>
          </div>
          <div className="flex space-x-4">
            <a href="https://github.com" target="_blank" className="hover:text-pink-400 transition">GitHub</a>
            <a href="https://linkedin.com" target="_blank" className="hover:text-green-400 transition">LinkedIn</a>
            <a href="mailto:you@example.com" className="hover:text-yellow-300 transition">Email</a>
          </div>
        </div>
        <div className="text-center text-xs text-gray-400 mt-4">
          © {new Date().getFullYear()} Bryano Studio. All rights reserved.
        </div>
        {/* n h*/}
      </footer>
    );
  }