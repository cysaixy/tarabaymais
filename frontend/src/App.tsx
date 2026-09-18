import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 text-slate-100 flex flex-col items-center justify-center gap-8 px-4">
      <header className="text-center space-y-3">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          TarabayMais
        </h1>
        <p className="text-slate-400 max-w-md mx-auto">
          React + Vite + TypeScript + Tailwind CSS is wired up and ready.
        </p>
      </header>

      <button
        onClick={() => setCount((c) => c + 1)}
        className="rounded-lg bg-indigo-500 px-6 py-3 font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 active:scale-95"
      >
        count is {count}
      </button>

      <p className="text-sm text-slate-500">
        Edit <code className="rounded bg-slate-700/60 px-1.5 py-0.5">src/App.tsx</code> and save to test HMR.
      </p>
    </div>
  )
}

export default App
