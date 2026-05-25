"use client";

import { useEffect, useState } from "react";

type KnowledgeStatus = {
  files: Record<string, number>;
  total_chunks: number;
};

type PlanOption = {
  state: string;
  name: string;
  description: string;
};

type AcademicPlanResult = {
  status: string;
  message?: string;
  plans: PlanOption[];
  recommended_plan: PlanOption;
  execution_mode: string;
  backend: string;
  job_id?: string | null;
  shots: number;
  counts: Record<string, number>;
  sources: string[];
  explanation: string;
};

export default function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

  const [backendMessage, setBackendMessage] = useState("Connecting to system...");
  const [backendStatus, setBackendStatus] = useState<
    "loading" | "online" | "offline"
  >("loading");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [knowledge, setKnowledge] = useState<KnowledgeStatus | null>(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  const [planResult, setPlanResult] = useState<AcademicPlanResult | null>(null);

  async function refreshKnowledge() {
    if (!apiUrl) return;

    try {
      const response = await fetch(`${apiUrl}/knowledge`);
      const data = await response.json();
      setKnowledge(data);
    } catch {
      setKnowledge(null);
    }
  }

  useEffect(() => {
    if (!apiUrl) {
      setBackendMessage("System API is not configured.");
      setBackendStatus("offline");
      return;
    }

    fetch(`${apiUrl}/`)
      .then((res) => res.json())
      .then((data) => {
        setBackendMessage(data.message || "System online");
        setBackendStatus("online");
      })
      .catch(() => {
        setBackendMessage("System connection unavailable");
        setBackendStatus("offline");
      });

    refreshKnowledge();
  }, [apiUrl]);

  async function uploadFile() {
    if (!selectedFile) {
      setUploadMessage("Please choose a file first.");
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
        setUploadMessage(`${data.filename} was added to the knowledge base.`);
        setSelectedFile(null);
        await refreshKnowledge();
      } else {
        setUploadMessage(data.message || "Upload failed.");
      }
    } catch {
      setUploadMessage("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function clearKnowledge() {
    try {
      await fetch(`${apiUrl}/knowledge`, {
        method: "DELETE",
      });

      setUploadMessage("Knowledge base has been reset.");
      setAnswer("");
      setSources([]);
      setPlanResult(null);
      await refreshKnowledge();
    } catch {
      setUploadMessage("Could not reset the knowledge base.");
    }
  }

  async function askQuestion() {
    if (!question.trim()) return;

    setAnswerLoading(true);
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

      setAnswer(data.answer || "No answer was returned.");
      setSources(data.sources || []);
    } catch {
      setAnswer("The assistant could not complete the request. Please try again.");
    } finally {
      setAnswerLoading(false);
    }
  }

  async function runAcademicPlanSearch() {
    setPlanLoading(true);
    setPlanResult(null);

    try {
      const response = await fetch(`${apiUrl}/academic-plan-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question:
            question ||
            "Based on the uploaded academic documents, what should this student prioritize?",
          shots: 1024,
          use_ibm: true,
        }),
      });

      const data = await response.json();
      setPlanResult(data);
    } catch {
      setPlanResult({
        status: "unavailable",
        plans: [],
        recommended_plan: {
          state: "11",
          name: "Balanced Exploration Priority",
          description:
            "Balance academic requirements, electives, and schedule flexibility.",
        },
        execution_mode: "Unavailable",
        backend: "Academic planning module",
        job_id: null,
        shots: 0,
        counts: {},
        sources: [],
        explanation: "The academic plan search module is currently unavailable.",
      });
    } finally {
      setPlanLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="mx-auto max-w-6xl">
        <section className="mb-8 rounded-2xl bg-slate-900 border border-slate-700 p-8 shadow-xl">
          <p className="text-sm text-blue-400 mb-2">University AI Portal</p>

          <h1 className="text-4xl font-bold mb-4">
            Knowledge Graph Assistant
          </h1>

          <p className="text-slate-300 max-w-3xl">
            A student-facing academic assistant that combines university
            documents, structured knowledge retrieval, AI reasoning, and
            computational planning tools in one portal.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-slate-900 border border-slate-700 p-6">
            <h2 className="text-xl font-semibold mb-3">System Status</h2>

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
              <h3 className="font-semibold mb-2">Knowledge Base</h3>

              <p className="text-slate-300">
                Indexed sections: {knowledge?.total_chunks ?? 0}
              </p>

              {knowledge && Object.keys(knowledge.files).length > 0 ? (
                <ul className="mt-3 list-disc list-inside text-slate-400 text-sm">
                  {Object.entries(knowledge.files).map(([filename, chunks]) => (
                    <li key={filename}>
                      {filename} — {chunks} indexed sections
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-slate-500 text-sm">
                  No documents have been added yet.
                </p>
              )}

              <button
                onClick={clearKnowledge}
                className="mt-4 rounded-lg bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600"
              >
                Reset Knowledge Base
              </button>
            </div>
          </section>

          <section className="rounded-2xl bg-slate-900 border border-slate-700 p-6">
            <h2 className="text-xl font-semibold mb-3">
              Add Academic Documents
            </h2>

            <p className="mb-4 text-sm text-slate-400">
              Upload handbooks, syllabi, graduation requirements, or course
              documents.
            </p>

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
              {uploading ? "Indexing Document..." : "Add to Knowledge Base"}
            </button>

            {uploadMessage && (
              <p className="mt-4 text-sm text-slate-300">{uploadMessage}</p>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-2xl bg-slate-900 border border-slate-700 p-6">
          <h2 className="text-xl font-semibold mb-4">Ask the Assistant</h2>

          <textarea
            className="w-full min-h-32 rounded-lg bg-slate-950 border border-slate-600 p-4 text-white outline-none focus:border-blue-400"
            placeholder="Example: What are the graduation requirements for students who entered in 2025?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />

          <button
            onClick={askQuestion}
            disabled={answerLoading}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {answerLoading ? "Searching Knowledge Base..." : "Ask Assistant"}
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
          <h2 className="text-xl font-semibold mb-4">Academic Plan Search</h2>

          <p className="text-slate-300 mb-4 max-w-3xl">
            This module compares possible academic planning strategies using the
            uploaded university documents, then runs a search process to
            highlight the strongest strategy for the student question.
          </p>

          <button
            onClick={runAcademicPlanSearch}
            disabled={planLoading}
            className="rounded-lg bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500 disabled:opacity-50"
          >
            {planLoading ? "Searching Academic Plans..." : "Run Academic Plan Search"}
          </button>

          {planResult && (
            <div className="mt-6 rounded-lg bg-slate-950 border border-slate-700 p-5">
              <h3 className="font-semibold mb-2">Recommended Strategy</h3>

              <p className="text-blue-300 text-lg font-semibold">
                {planResult.recommended_plan.name}
              </p>

              <p className="mt-2 text-slate-300">
                {planResult.recommended_plan.description}
              </p>

              {planResult.message && (
                <p className="mt-3 text-yellow-300">{planResult.message}</p>
              )}

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg bg-slate-900 border border-slate-700 p-4">
                  <h4 className="font-semibold mb-2">Search Execution</h4>

                  <p className="text-slate-300">
                    Mode:{" "}
                    <span className="text-blue-300">
                      {planResult.execution_mode}
                    </span>
                  </p>

                  <p className="text-slate-300">
                    Backend:{" "}
                    <span className="text-blue-300">{planResult.backend}</span>
                  </p>

                  {planResult.job_id && (
                    <p className="text-slate-300">
                      Job ID:{" "}
                      <span className="text-blue-300">{planResult.job_id}</span>
                    </p>
                  )}

                  <p className="text-slate-300">Shots: {planResult.shots}</p>
                </div>

                <div className="rounded-lg bg-slate-900 border border-slate-700 p-4">
                  <h4 className="font-semibold mb-2">Search Results</h4>

                  {Object.keys(planResult.counts).length > 0 ? (
                    <ul className="list-disc list-inside text-slate-400">
                      {Object.entries(planResult.counts).map(([state, count]) => {
                        const plan = planResult.plans.find(
                          (item) => item.state === state
                        );

                        return (
                          <li key={state}>
                            {state}
                            {plan ? ` — ${plan.name}` : ""}: {count}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-slate-500 text-sm">
                      No search counts available.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-slate-900 border border-slate-700 p-4">
                <h4 className="font-semibold mb-2">Explanation</h4>
                <p className="text-slate-300">{planResult.explanation}</p>
              </div>

              {planResult.sources.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Sources</h4>
                  <ul className="list-disc list-inside text-slate-400">
                    {planResult.sources.map((source, index) => (
                      <li key={index}>{source}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}