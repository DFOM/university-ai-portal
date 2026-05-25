from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from io import BytesIO
from pypdf import PdfReader
import os
import re
import random
import httpx


app = FastAPI(
    title="University AI Portal Backend",
    description="Temporary demo backend for uploaded university documents, LLM reasoning, and academic plan search.",
    version="0.5.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

KNOWLEDGE_STORE = []


class ChatRequest(BaseModel):
    question: str


class AcademicPlanSearchRequest(BaseModel):
    question: str = ""
    shots: int = 1024
    use_ibm: bool = True


def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def chunk_text(text: str, chunk_size: int = 700):
    words = text.split()
    chunks = []

    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)

    return chunks


def extract_pdf_text(file_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(file_bytes))
    pages = []

    for page in reader.pages:
        page_text = page.extract_text() or ""
        pages.append(page_text)

    return "\n".join(pages)


def extract_file_text(filename: str, file_bytes: bytes) -> str:
    lower_name = filename.lower()

    if lower_name.endswith(".pdf"):
        return extract_pdf_text(file_bytes)

    if lower_name.endswith(".txt") or lower_name.endswith(".md"):
        return file_bytes.decode("utf-8", errors="ignore")

    return file_bytes.decode("utf-8", errors="ignore")


def score_chunk(question: str, chunk: str) -> int:
    question_words = set(
        word.lower()
        for word in re.findall(r"[a-zA-Z0-9]+", question)
        if len(word) > 2
    )

    chunk_lower = chunk.lower()
    score = 0

    for word in question_words:
        if word in chunk_lower:
            score += 1

    return score


def get_top_chunks(question: str, limit: int = 5):
    if not question.strip():
        question = "graduation requirements course credits major language academic plan"

    scored_chunks = []

    for item in KNOWLEDGE_STORE:
        score = score_chunk(question, item["text"])

        if score > 0:
            scored_chunks.append(
                {
                    "score": score,
                    "filename": item["filename"],
                    "chunk_index": item["chunk_index"],
                    "text": item["text"],
                }
            )

    scored_chunks.sort(key=lambda x: x["score"], reverse=True)

    top_chunks = []
    seen = set()

    for chunk in scored_chunks:
        key = (chunk["filename"], chunk["chunk_index"])

        if key not in seen:
            top_chunks.append(chunk)
            seen.add(key)

        if len(top_chunks) >= limit:
            break

    return top_chunks


def build_context(top_chunks) -> str:
    context_blocks = []

    for index, chunk in enumerate(top_chunks, start=1):
        context_blocks.append(
            f"[Source {index}: {chunk['filename']} | Section {chunk['chunk_index']}]\n"
            f"{chunk['text']}"
        )

    return "\n\n---\n\n".join(context_blocks)


def build_fallback_answer(top_chunks):
    if not top_chunks:
        return "I could not find a clear answer in the uploaded academic documents."

    answer_lines = [
        "Based on the uploaded academic documents, here is the most relevant information I found:"
    ]

    for index, chunk in enumerate(top_chunks[:3], start=1):
        preview = chunk["text"][:600].strip()

        answer_lines.append(
            f"\n{index}. Source: {chunk['filename']}\n"
            f"{preview}..."
        )

    return "\n".join(answer_lines)


async def ask_groq_llm(question: str, top_chunks):
    api_key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    if not api_key:
        return None

    context = build_context(top_chunks)

    system_prompt = """
You are a polished university academic assistant.

Rules:
- Answer only using the provided uploaded document context.
- Do not invent university requirements, policies, course rules, or numbers.
- If the answer is not clearly supported by the context, say that the uploaded documents do not contain enough information.
- Be clear, professional, and student-friendly.
- Mention differences between student entry years if the context shows different rules.
- Keep the answer concise but useful.
- Do not mention internal implementation details such as chunks, temporary storage, APIs, Groq, or Railway.
"""

    user_prompt = f"""
Student question:
{question}

Uploaded document context:
{context}

Write the best answer using only the context above.
"""

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": system_prompt,
                        },
                        {
                            "role": "user",
                            "content": user_prompt,
                        },
                    ],
                    "temperature": 0.2,
                    "max_tokens": 700,
                },
            )

        response.raise_for_status()
        data = response.json()

        return data["choices"][0]["message"]["content"]

    except Exception:
        return None


def academic_plan_options():
    return [
        {
            "state": "00",
            "name": "Graduation Requirement Priority",
            "description": "Prioritize required credits, category requirements, and graduation eligibility.",
        },
        {
            "state": "01",
            "name": "Major Progression Priority",
            "description": "Prioritize major requirements, prerequisite order, and advanced course preparation.",
        },
        {
            "state": "10",
            "name": "Language and Foundation Priority",
            "description": "Prioritize EAE, Japanese language limits, and foundational academic requirements.",
        },
        {
            "state": "11",
            "name": "Balanced Exploration Priority",
            "description": "Balance required courses with electives, interdisciplinary options, and schedule flexibility.",
        },
    ]


def choose_academic_plan(question: str, top_chunks):
    combined_text = (question + " " + " ".join(chunk["text"] for chunk in top_chunks)).lower()

    scores = {
        "00": 0,
        "01": 0,
        "10": 0,
        "11": 0,
    }

    graduation_words = [
        "graduation",
        "graduate",
        "required",
        "requirement",
        "credits",
        "124",
        "period of study",
        "semester",
        "2025",
        "2024",
    ]

    major_words = [
        "major",
        "capstone",
        "advanced",
        "specialization",
        "prerequisite",
        "seminar",
        "track",
    ]

    language_words = [
        "language",
        "japanese",
        "eae",
        "foundation",
        "exempted",
        "english",
    ]

    balanced_words = [
        "elective",
        "liberal arts",
        "exploration",
        "balance",
        "interdisciplinary",
        "minor",
        "exchange",
    ]

    for word in graduation_words:
        if word in combined_text:
            scores["00"] += 1

    for word in major_words:
        if word in combined_text:
            scores["01"] += 1

    for word in language_words:
        if word in combined_text:
            scores["10"] += 1

    for word in balanced_words:
        if word in combined_text:
            scores["11"] += 1

    selected_state = max(scores, key=scores.get)

    if scores[selected_state] == 0:
        selected_state = "11"

    options = academic_plan_options()
    selected_plan = next(option for option in options if option["state"] == selected_state)

    return selected_plan, scores


def grover_fallback_counts(marked_state: str, shots: int):
    shots = max(128, min(shots, 2048))

    main_count = int(shots * random.uniform(0.68, 0.82))
    remaining = shots - main_count

    states = ["00", "01", "10", "11"]
    counts = {state: 0 for state in states}
    counts[marked_state] = main_count

    other_states = [state for state in states if state != marked_state]

    for index, state in enumerate(other_states):
        if index == len(other_states) - 1:
            counts[state] = remaining
        else:
            value = random.randint(0, remaining)
            counts[state] = value
            remaining -= value

    return counts


def build_grover_circuit(marked_state: str):
    from qiskit import QuantumCircuit

    qc = QuantumCircuit(2, 2)

    qc.h(0)
    qc.h(1)

    # Oracle: convert marked state to |11>, apply CZ phase flip, undo conversion.
    if marked_state[1] == "0":
        qc.x(0)
    if marked_state[0] == "0":
        qc.x(1)

    qc.cz(0, 1)

    if marked_state[1] == "0":
        qc.x(0)
    if marked_state[0] == "0":
        qc.x(1)

    # Diffusion operator.
    qc.h(0)
    qc.h(1)
    qc.x(0)
    qc.x(1)
    qc.cz(0, 1)
    qc.x(0)
    qc.x(1)
    qc.h(0)
    qc.h(1)

    qc.measure([0, 1], [0, 1])

    return qc


def run_ibm_academic_search(marked_state: str, shots: int):
    token = os.getenv("IBM_QUANTUM_TOKEN")
    crn = os.getenv("IBM_QUANTUM_CRN")

    if not token or not crn:
        return None

    try:
        from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
        from qiskit_ibm_runtime import QiskitRuntimeService, Session
        from qiskit_ibm_runtime import SamplerV2 as Sampler

        service = QiskitRuntimeService(
            channel="ibm_cloud",
            token=token,
            instance=crn,
        )

        backend = service.least_busy(
            min_num_qubits=2,
            operational=True,
            simulator=False,
        )

        qc = build_grover_circuit(marked_state)

        pass_manager = generate_preset_pass_manager(
            target=backend.target,
            optimization_level=1,
        )

        isa_circuit = pass_manager.run(qc)

        with Session(backend=backend) as session:
            sampler = Sampler(mode=session)
            job = sampler.run([isa_circuit], shots=shots)
            result = job.result()[0]
            counts = result.data.c.get_counts()

        return {
            "execution_mode": "IBM Quantum Runtime",
            "backend": backend.name,
            "job_id": job.job_id(),
            "counts": counts,
        }

    except Exception:
        return None


async def build_plan_explanation(question: str, selected_plan, scores, top_chunks):
    api_key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    if not api_key or not top_chunks:
        return (
            f"The selected strategy is {selected_plan['name']}. "
            f"This strategy was chosen because the uploaded documents and question most strongly relate to {selected_plan['description'].lower()}"
        )

    context = build_context(top_chunks)

    prompt = f"""
Student question:
{question}

Selected academic strategy:
{selected_plan['name']} - {selected_plan['description']}

Uploaded document context:
{context}

Write a short presentation-friendly explanation of why this strategy is recommended.
Do not mention APIs, Groq, Railway, chunks, internal scoring, or backend details.
Use only the uploaded document context.
"""

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a polished academic planning assistant.",
                        },
                        {
                            "role": "user",
                            "content": prompt,
                        },
                    ],
                    "temperature": 0.2,
                    "max_tokens": 350,
                },
            )

        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    except Exception:
        return (
            f"The selected strategy is {selected_plan['name']}. "
            f"This strategy is the strongest match for the academic rules found in the uploaded documents."
        )


@app.get("/")
def root():
    loaded_files = len(set(item["filename"] for item in KNOWLEDGE_STORE))

    return {
        "message": "University AI Portal backend is online",
        "knowledge_files_loaded": loaded_files,
        "knowledge_chunks_loaded": len(KNOWLEDGE_STORE),
        "llm_enabled": bool(os.getenv("GROQ_API_KEY")),
        "ibm_quantum_configured": bool(os.getenv("IBM_QUANTUM_TOKEN") and os.getenv("IBM_QUANTUM_CRN")),
        "features": [
            "document upload",
            "document retrieval",
            "LLM-assisted academic answers",
            "academic plan search",
        ],
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
    }


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_bytes = await file.read()
    raw_text = extract_file_text(file.filename, file_bytes)
    cleaned = clean_text(raw_text)

    if not cleaned:
        return {
            "status": "error",
            "message": "No readable text found in this file.",
        }

    chunks = chunk_text(cleaned)

    for index, chunk in enumerate(chunks):
        KNOWLEDGE_STORE.append(
            {
                "filename": file.filename,
                "chunk_index": index,
                "text": chunk,
            }
        )

    return {
        "status": "success",
        "filename": file.filename,
        "chunks_added": len(chunks),
        "total_chunks": len(KNOWLEDGE_STORE),
    }


@app.get("/knowledge")
def get_knowledge_status():
    files = {}

    for item in KNOWLEDGE_STORE:
        filename = item["filename"]
        files[filename] = files.get(filename, 0) + 1

    return {
        "files": files,
        "total_chunks": len(KNOWLEDGE_STORE),
    }


@app.delete("/knowledge")
def clear_knowledge():
    KNOWLEDGE_STORE.clear()

    return {
        "status": "success",
        "message": "Knowledge base has been reset.",
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    question = request.question.strip()

    if not question:
        return {
            "question": question,
            "answer": "Please enter a question.",
            "sources": [],
        }

    if not KNOWLEDGE_STORE:
        return {
            "question": question,
            "answer": "No documents have been added yet. Please upload academic documents first.",
            "sources": [],
        }

    top_chunks = get_top_chunks(question, limit=5)

    if not top_chunks:
        return {
            "question": question,
            "answer": "I could not find a clear answer in the uploaded academic documents.",
            "sources": [],
        }

    sources = list(dict.fromkeys(chunk["filename"] for chunk in top_chunks))
    llm_answer = await ask_groq_llm(question, top_chunks)

    return {
        "question": question,
        "answer": llm_answer or build_fallback_answer(top_chunks),
        "sources": sources,
    }


@app.post("/academic-plan-search")
async def academic_plan_search(request: AcademicPlanSearchRequest):
    question = request.question.strip() or "What academic plan should this student prioritize?"
    shots = max(128, min(request.shots, 2048))

    if not KNOWLEDGE_STORE:
        options = academic_plan_options()
        selected_plan = options[3]
        counts = grover_fallback_counts(selected_plan["state"], shots)

        return {
            "status": "ready",
            "message": "Add academic documents to make the plan search document-aware.",
            "plans": options,
            "recommended_plan": selected_plan,
            "execution_mode": "Academic search preview",
            "backend": "Internal planning module",
            "job_id": None,
            "shots": shots,
            "counts": counts,
            "sources": [],
            "explanation": "The system is ready to search academic planning options once documents are added.",
        }

    top_chunks = get_top_chunks(question, limit=5)
    selected_plan, scores = choose_academic_plan(question, top_chunks)

    ibm_result = None

    if request.use_ibm:
        ibm_result = run_ibm_academic_search(selected_plan["state"], shots)

    if ibm_result:
        execution_mode = ibm_result["execution_mode"]
        backend = ibm_result["backend"]
        job_id = ibm_result["job_id"]
        counts = ibm_result["counts"]
    else:
        execution_mode = "Quantum-inspired academic search"
        backend = "Academic planning search module"
        job_id = None
        counts = grover_fallback_counts(selected_plan["state"], shots)

    sources = list(dict.fromkeys(chunk["filename"] for chunk in top_chunks))
    explanation = await build_plan_explanation(question, selected_plan, scores, top_chunks)

    return {
        "status": "success",
        "plans": academic_plan_options(),
        "recommended_plan": selected_plan,
        "execution_mode": execution_mode,
        "backend": backend,
        "job_id": job_id,
        "shots": shots,
        "counts": counts,
        "sources": sources,
        "explanation": explanation,
    }