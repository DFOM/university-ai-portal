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

type FourYearPlanResult = {
  status: string;
  message?: string;
  student_profile: {
    entry_year: string;
    major: string;
    minor: string;
    student_goal: string;
    completed_courses: string;
  };
  recommended_strategy: PlanOption;
  four_year_plan: string;
  optimization: {
    execution_mode: string;
    backend: string;
    job_id?: string | null;
    shots: number;
    counts: Record<string, number>;
  };
  sources: string[];
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

  const [plannerMajor, setPlannerMajor] = useState("");
  const [plannerMinor, setPlannerMinor] = useState("");
  const [plannerEntryYear, setPlannerEntryYear] = useState("2025");
  const [plannerGoal, setPlannerGoal] = useState("");
  const [completedCourses, setCompletedCourses] = useState("");
  const [fourYearLoading, setFourYearLoading] = useState(false);
  const [fourYearPlan, setFourYearPlan] = useState<FourYearPlanResult | null>(
    null
  );

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
      setFourYearPlan(null);
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

  async function generateFourYearPlan() {
    setFourYearLoading(true);
    setFourYearPlan(null);

    try {
      const response = await fetch(`${apiUrl}/four-year-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          major: plannerMajor,
          minor: plannerMinor,
          entry_year: plannerEntryYear,
          student_goal: plannerGoal,
          completed_courses: completedCourses,
          semesters: 8,
          shots: 1024,
          use_ibm: true,
        }),
      });

      const data = await response.json();
      setFourYearPlan(data);
    } catch {
      setFourYearPlan({
        status: "unavailable",
        student_profile: {
          entry_year: plannerEntryYear,
          major: plannerMajor,
          minor: plannerMinor,
          student_goal: plannerGoal,
          completed_courses: completedCourses,
        },
        recommended_strategy: {
          state: "11",
          name: "Balanced Major-Minor Pathway",
          description:
            "Balance graduation requirements, major progress, optional minor requirements, electives, and schedule flexibility.",
        },
        four_year_plan:
          "The four-year planner is currently unavailable. Please try again.",
        optimization: {
          execution_mode: "Unavailable",
          backend: "Academic planning module",
          job_id: null,
          shots: 0,
          counts: {},
        },
        sources: [],
      });
    } finally {
      setFourYearLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="mx-auto max-w-6xl">
        <section className="mb-8 rounded-2xl bg-slate-900 border border-slate-700 p-8 shadow-xl">
          <p className="text-sm text-blue-400 mb-2">University AI Portal</p>

          <h1 className="text-4xl font-bold mb-4">
            Knowledge Graph Academic Planner
          </h1>

          <p className="text-slate-300 max-w-3xl">
            A student-facing academic assistant that combines university
            documents, structured knowledge retrieval, AI reasoning, and
            IBM Quantum-compatible planning search in one portal.
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
              Upload handbooks, syllabi, graduation requirements, course lists,
              major requirements, or minor requirements.
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
          <h2 className="text-xl font-semibold mb-4">
            Four-Year Academic Planner
          </h2>

          <p className="text-slate-300 mb-4 max-w-3xl">
            Generate a four-year academic pathway using the uploaded university
            documents, selected major, optional minor, completed courses, and
            graduation priorities.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Entry Year
              </label>
              <input
                value={plannerEntryYear}
                onChange={(e) => setPlannerEntryYear(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-600 p-3 text-white outline-none focus:border-blue-400"
                placeholder="2025"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Major</label>
              <input
                value={plannerMajor}
                onChange={(e) => setPlannerMajor(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-600 p-3 text-white outline-none focus:border-blue-400"
                placeholder="Example: Global Business and Economics"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Minor Optional
              </label>
              <input
                value={plannerMinor}
                onChange={(e) => setPlannerMinor(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-600 p-3 text-white outline-none focus:border-blue-400"
                placeholder="Example: Data Science"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Completed Courses Optional
              </label>
              <input
                value={completedCourses}
                onChange={(e) => setCompletedCourses(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-600 p-3 text-white outline-none focus:border-blue-400"
                placeholder="Example: EAE A, Intro to Economics"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm text-slate-400 mb-1">
              Student Goal
            </label>
            <textarea
              value={plannerGoal}
              onChange={(e) => setPlannerGoal(e.target.value)}
              className="w-full min-h-24 rounded-lg bg-slate-950 border border-slate-600 p-3 text-white outline-none focus:border-blue-400"
              placeholder="Example: Graduate on time while prioritizing major requirements and keeping room for exchange."
            />
          </div>

          <button
            onClick={generateFourYearPlan}
            disabled={fourYearLoading}
            className="mt-4 rounded-lg bg-emerald-600 px-5 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-50"
          >
            {fourYearLoading
              ? "Generating Four-Year Plan..."
              : "Generate Four-Year Plan"}
          </button>

          {fourYearPlan && (
            <div className="mt-6 rounded-lg bg-slate-950 border border-slate-700 p-5">
              <h3 className="font-semibold mb-2">Generated Four-Year Plan</h3>

              {fourYearPlan.message && (
                <p className="mb-3 text-yellow-300">{fourYearPlan.message}</p>
              )}

              <div className="rounded-lg bg-slate-900 border border-slate-700 p-4 mb-4">
                <h4 className="font-semibold mb-2">
                  Recommended Planning Strategy
                </h4>
                <p className="text-blue-300 font-semibold">
                  {fourYearPlan.recommended_strategy.name}
                </p>
                <p className="text-slate-300 mt-1">
                  {fourYearPlan.recommended_strategy.description}
                </p>
              </div>

              <div className="rounded-lg bg-slate-900 border border-slate-700 p-4 mb-4">
                <h4 className="font-semibold mb-2">Planning Output</h4>
                <p className="whitespace-pre-line text-slate-300">
                  {fourYearPlan.four_year_plan}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg bg-slate-900 border border-slate-700 p-4">
                  <h4 className="font-semibold mb-2">Optimization Execution</h4>
                  <p className="text-slate-300">
                    Mode:{" "}
                    <span className="text-blue-300">
                      {fourYearPlan.optimization.execution_mode}
                    </span>
                  </p>
                  <p className="text-slate-300">
                    Backend:{" "}
                    <span className="text-blue-300">
                      {fourYearPlan.optimization.backend}
                    </span>
                  </p>
                  {fourYearPlan.optimization.job_id && (
                    <p className="text-slate-300">
                      Job ID:{" "}
                      <span className="text-blue-300">
                        {fourYearPlan.optimization.job_id}
                      </span>
                    </p>
                  )}
                  <p className="text-slate-300">
                    Shots: {fourYearPlan.optimization.shots}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-900 border border-slate-700 p-4">
                  <h4 className="font-semibold mb-2">Optimization Counts</h4>
                  {Object.keys(fourYearPlan.optimization.counts).length > 0 ? (
                    <ul className="list-disc list-inside text-slate-400">
                      {Object.entries(fourYearPlan.optimization.counts).map(
                        ([state, count]) => (
                          <li key={state}>
                            {state}: {count}
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="text-slate-500 text-sm">
                      No counts available.
                    </p>
                  )}
                </div>
              </div>

              {fourYearPlan.sources.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Sources</h4>
                  <ul className="list-disc list-inside text-slate-400">
                    {fourYearPlan.sources.map((source, index) => (
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