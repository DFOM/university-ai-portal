"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [backendMessage, setBackendMessage] = useState("Checking backend...");
  const [backendStatus, setBackendStatus] = useState("loading");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

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
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-3xl w-full rounded-2xl bg-slate-900 border border-slate-700 p-8 shadow-xl">
        <p className="text-sm text-blue-400 mb-2">University AI Portal</p>

        <h1 className="text-4xl font-bold mb-4">
          AI-Powered University Portal Demo
        </h1>

        <p className="text-slate-300 mb-6">
          This demo will connect the university knowledge graph, local LLM,
          IBM Quantum tools, and Railway deployment into one student-facing portal.
        </p>

        <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
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
      </div>
    </main>
  );
}
