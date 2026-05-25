"use client";

import { useEffect, useState } from "react";

type KnowledgeStatus = {
  files: Record<string, number>;
  total_chunks: number;
};

type QuantumResult = {
  mode: string;
  backend: string;
  job_id?: string;
  circuit: string;
  shots: number;
  counts: Record<string, number>;
  explanation: string;
  error?: string;
};

export default function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [backendMessage, setBackendMessage] = useState("Checking backend...");
  const [backendStatus, setBackendStatus] = useState("loading");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [knowledge, setKnowledge] = useState<KnowledgeStatus | null>(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [quantumLoading, setQuantumLoading] = useState(false);
  const [quantumResult, setQuantumResult] = useState<QuantumResult | null>(null);
  const [useRealIbm, setUseRealIbm] = useState(false);

  async function refreshKnowledge() {
    try {
      const response = await fetch(`${apiUrl}/knowledge`);
      const data = await response.json();
      setKnowledge(data);
    } catch {
      setKnowledge(null);
    }
  }

  useEffect(() => {
    fetch(`${apiUrl}/`)
      .then((res) => res.json())
      .then((data) => {
        setBackendMessage(data.message);
        setBackendStatus("online");
      })
      .catch(() => {
        setBackendMessage("Backend connection failed");
        setBackendStatus("offline");
      });

    refreshKnowledge();
  }, [apiUrl]);

  async function uploadFile() {
    if (!selectedFile) {
      setUploadMessage("Choose a file first.");
      return;
    }

    setUploading(true);
    setUploadMessage("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${apiUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.status === "success") {
        setUploadMessage(
          `Uploaded ${data.filename}. Added ${data.chunks_added} temporary knowledge chunks.`
        );
        setSelectedFile(null);
        await refreshKnowledge();
      } else {
        setUploadMessage(data.message || "Upload failed.");
      }
    } catch {
      setUploadMessage("Upload failed. Backend may be offline.");
    } finally {
      setUploading(false);
    }
  }

  async function askQuestion() {
    if (!question.trim()) return;

    setLoading(true);
    setAnswer("");
    setSources([]);

    try {
      const response = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
        }),
      });

      const data = await response.json();

      setAnswer(data.answer);
      setSources(data.sources || []);
    } catch {
      setAnswer("Failed to contact backend chat endpoint.");
    } finally {
      setLoading(false);
    }
  }

  async function clearKnowledge() {
    try {
      await fetch(`${apiUrl}/knowledge`, {
        method: "DELETE",
      });

      setUploadMessage("Temporary knowledge store cleared.");
      setAnswer("");
      setSources([]);
      await refreshKnowledge();
    } catch {
      setUploadMessage("Failed to clear knowledge store.");
    }
  }

  async function runQuantumDemo() {
    setQuantumLoading(true);
    setQuantumResult(null);

    try {
      const response = await fetch(`${apiUrl}/quantum-demo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          use_real_ibm: useRealIbm,
          shots: 1024,
        }),
      });

      const data = await response.json();
      setQuantumResult(data);
    } catch {
      setQuantumResult({
        mode: "frontend_error",
        backend: "none",
        circuit: "N/A",
        shots: 0,
        counts: {},
        explanation: "Failed to contact the quantum demo endpoint.",
      });
    } finally {
      setQuantumLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl bg-slate-900 border border-slate-700 p-8 shadow-xl">
          <p className="text-sm text-blue-400 mb-2">University AI Portal</p>

          <h1 className="text-4xl font-bold mb-4">
            Temporary Knowledge Graph + Quantum Demo
          </h1>

          <p className="text-slate-300">
            Upload university documents, ask questions from the temporary
            knowledge store, and run a small quantum computing demo.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-slate-900 border border-slate-700 p-6">
            <h2 className="text-xl font-semibold mb-3">1. System Status</h2>

            <p
              className={
                backendStatus === "online"
                  ? "text-green-400"
                  : backendStatus === "offline"
                  ? "text-red-400"
                  : "text-yellow-400"
              }
            >
              {backendMessage}
            </p>

            <div className="mt-4 rounded-xl bg-slate-800 border border-slate-700 p-4">
              <h3 className="font-semibold mb-2">
                Temporary Knowledge Store
              </h3>

              <p className="text-slate-300">
                Total chunks: {knowledge?.total_chunks ?? 0}
              </p>

              {knowledge && Object.keys(knowledge.files).length > 0 ? (
                <ul className="mt-3 list-disc list-inside text-slate-400 text-sm">
                  {Object.entries(knowledge.files).map(([filename, chunks]) => (
                    <li key={filename}>
                      {filename} — {chunks} chunks
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-slate-500 text-sm">
                  No files uploaded yet.
                </p>
              )}

              <button
                onClick={clearKnowledge}
                className="mt-4 rounded-lg bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600"
              >
                Clear temporary knowledge
              </button>
            </div>
          </section>

          <section className="rounded-2xl bg-slate-900 border border-slate-700 p-6">
            <h2 className="text-xl font-semibold mb-3">
              2. Upload Knowledge File
            </h2>

            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-500"
            />

            <button
              onClick={uploadFile}
              disabled={uploading}
              className="mt-4 rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload File"}
            </button>

            {uploadMessage && (
              <p className="mt-4 text-sm text-slate-300">{uploadMessage}</p>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-2xl bg-slate-900 border border-slate-700 p-6">
          <h2 className="text-xl font-semibold mb-4">3. Ask the Portal</h2>

          <textarea
            className="w-full min-h-32 rounded-lg bg-slate-950 border border-slate-600 p-4 text-white outline-none focus:border-blue-400"
            placeholder="Example: What are the graduation requirements for students who entered in 2025?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />

          <button
            onClick={askQuestion}
            disabled={loading}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Ask"}
          </button>

          {answer && (
            <div className="mt-6 rounded-lg bg-slate-950 border border-slate-700 p-5">
              <h3 className="font-semibold mb-2">Answer</h3>
              <p className="whitespace-pre-line text-slate-300">{answer}</p>

              {sources.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Sources</h4>
                  <ul className="list-disc list-inside text-slate-400">
                    {sources.map((source, index) => (
                      <li key={index}>{source}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl bg-slate-900 border border-slate-700 p-6">
          <h2 className="text-xl font-semibold mb-4">
            4. IBM Quantum Demo
          </h2>

          <p className="text-slate-300 mb-4">
            This runs a Bell-state quantum circuit demo. For tomorrow, keep
            real IBM hardware off unless your IBM token is already configured.
          </p>

          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={useRealIbm}
              onChange={(e) => setUseRealIbm(e.target.checked)}
            />
            Try real IBM Quantum hardware
          </label>

          <button
            onClick={runQuantumDemo}
            disabled={quantumLoading}
            className="mt-4 rounded-lg bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500 disabled:opacity-50"
          >
            {quantumLoading ? "Running Quantum Demo..." : "Run Quantum Demo"}
          </button>

          {quantumResult && (
            <div className="mt-6 rounded-lg bg-slate-950 border border-slate-700 p-5">
              <h3 className="font-semibold mb-2">Quantum Result</h3>

              <p className="text-slate-300">
                Mode: <span className="text-blue-300">{quantumResult.mode}</span>
              </p>

              <p className="text-slate-300">
                Backend:{" "}
                <span className="text-blue-300">{quantumResult.backend}</span>
              </p>

              {quantumResult.job_id && (
                <p className="text-slate-300">
                  Job ID:{" "}
                  <span className="text-blue-300">{quantumResult.job_id}</span>
                </p>
              )}

              {quantumResult.error && (
                <p className="mt-3 text-yellow-300">
                  Error / fallback reason: {quantumResult.error}
                </p>
              )}

              <p className="mt-3 text-slate-300">
                Circuit: {quantumResult.circuit}
              </p>

              <p className="mt-3 text-slate-300">
                Shots: {quantumResult.shots}
              </p>

              <div className="mt-3">
                <h4 className="font-semibold mb-2">Counts</h4>

                <ul className="list-disc list-inside text-slate-400">
                  {Object.entries(quantumResult.counts).map(([state, count]) => (
                    <li key={state}>
                      {state}: {count}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-4 text-slate-300">
                {quantumResult.explanation}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}