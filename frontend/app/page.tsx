"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [backendMessage, setBackendMessage] = useState("Checking backend...");
  const [backendStatus, setBackendStatus] = useState("loading");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

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
  }, [apiUrl]);

  async function askQuestion() {
    if (!question.trim()) return;

    setLoading(true);
    setAnswer("");
    setSources([]);

    try {
      const response = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: question
        })
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

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-4xl w-full rounded-2xl bg-slate-900 border border-slate-700 p-8 shadow-xl">
        <p className="text-sm text-blue-400 mb-2">University AI Portal</p>

        <h1 className="text-4xl font-bold mb-4">
          AI-Powered University Portal Demo
        </h1>

        <p className="text-slate-300 mb-6">
          Ask a question. Right now this is a demo response. Later it will connect
          to the Obsidian knowledge graph, local LLM, and IBM Quantum tools.
        </p>

        <div className="rounded-xl bg-slate-800 border border-slate-700 p-5 mb-6">
          <h2 className="text-xl font-semibold mb-2">Backend Connection</h2>
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
        </div>

        <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
          <h2 className="text-xl font-semibold mb-4">Ask the Portal</h2>

          <textarea
            className="w-full min-h-32 rounded-lg bg-slate-950 border border-slate-600 p-4 text-white outline-none focus:border-blue-400"
            placeholder="Example: What courses should I take before graduation?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />

          <button
            onClick={askQuestion}
            disabled={loading}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Thinking..." : "Ask"}
          </button>

          {answer && (
            <div className="mt-6 rounded-lg bg-slate-950 border border-slate-700 p-5">
              <h3 className="font-semibold mb-2">Answer</h3>
              <p className="text-slate-300">{answer}</p>

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
        </div>
      </div>
    </main>
  );
}
