from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from io import BytesIO
from pypdf import PdfReader
import os
import re
import random


app = FastAPI(
    title="University AI Portal Backend",
    description="Temporary demo backend for uploaded university documents and IBM Quantum demo.",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temporary in-memory store.
# This is good for tomorrow's demo, but it resets when Railway restarts.
KNOWLEDGE_STORE = []


class ChatRequest(BaseModel):
    question: str


class QuantumDemoRequest(BaseModel):
    use_real_ibm: bool = False
    shots: int = 1024


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


def build_simple_answer(question: str, top_chunks):
    if not top_chunks:
        return "I could not find a clear answer in the uploaded temporary knowledge documents."

    answer_lines = [
        "Based on the uploaded temporary knowledge documents, here is the most relevant information I found:"
    ]

    for index, chunk in enumerate(top_chunks, start=1):
        preview = chunk["text"][:600].strip()

        answer_lines.append(
            f"\n{index}. Source: {chunk['filename']}\n"
            f"{preview}..."
        )

    answer_lines.append(
        "\nNote: This is a temporary demo knowledge system. It retrieves relevant document chunks, but it is not yet a full long-term knowledge graph."
    )

    return "\n".join(answer_lines)


@app.get("/")
def root():
    loaded_files = len(set(item["filename"] for item in KNOWLEDGE_STORE))

    return {
        "message": "University AI Portal backend is online",
        "knowledge_files_loaded": loaded_files,
        "knowledge_chunks_loaded": len(KNOWLEDGE_STORE),
        "features": [
            "temporary document upload",
            "document-based chat",
            "quantum demo endpoint",
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
        "message": "Temporary knowledge store cleared.",
    }


@app.post("/chat")
def chat(request: ChatRequest):
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
            "answer": "No documents have been uploaded yet. Upload a handbook, syllabus, graduation requirement sheet, or course document first.",
            "sources": [],
        }

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

    # Avoid showing repeated chunks from the same file too much.
    top_chunks = []
    seen = set()

    for chunk in scored_chunks:
        key = (chunk["filename"], chunk["chunk_index"])
        if key not in seen:
            top_chunks.append(chunk)
            seen.add(key)

        if len(top_chunks) >= 3:
            break

    if not top_chunks:
        return {
            "question": question,
            "answer": "I could not find a clear answer in the uploaded temporary knowledge documents.",
            "sources": [],
        }

    sources = list(dict.fromkeys(chunk["filename"] for chunk in top_chunks))

    return {
        "question": question,
        "answer": build_simple_answer(question, top_chunks),
        "sources": sources,
    }


@app.post("/quantum-demo")
def quantum_demo(request: QuantumDemoRequest):
    shots = max(128, min(request.shots, 2048))

    if not request.use_real_ibm:
        half = shots // 2

        return {
            "mode": "demo",
            "backend": "local demo simulator",
            "circuit": "Bell state: H on qubit 0, CX from qubit 0 to qubit 1, then measure both qubits.",
            "shots": shots,
            "counts": {
                "00": half,
                "11": shots - half,
            },
            "explanation": (
                "This demonstrates quantum entanglement. In an ideal Bell state, "
                "the two qubits are strongly correlated, so the main results are 00 and 11."
            ),
        }

    token = os.getenv("IBM_QUANTUM_TOKEN")

    if not token:
        half = shots // 2

        return {
            "mode": "fallback",
            "backend": "fallback demo simulator",
            "error": "IBM_QUANTUM_TOKEN is not set on Railway.",
            "circuit": "Bell state demo fallback.",
            "shots": shots,
            "counts": {
                "00": half,
                "11": shots - half,
            },
            "explanation": (
                "The IBM Quantum token is missing, so this returned a safe demo result instead of calling real IBM hardware."
            ),
        }

    try:
        from qiskit.circuit import QuantumCircuit, QuantumRegister, ClassicalRegister
        from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
        from qiskit_ibm_runtime import QiskitRuntimeService, Session
        from qiskit_ibm_runtime import SamplerV2 as Sampler

        qr = QuantumRegister(2, name="qr")
        cr = ClassicalRegister(2, name="cr")
        qc = QuantumCircuit(qr, cr, name="bell")

        qc.h(qr[0])
        qc.cx(qr[0], qr[1])
        qc.measure(qr, cr)

        service = QiskitRuntimeService(
            channel="ibm_quantum_platform",
            token=token,
        )

        backend = service.least_busy(
            operational=True,
            simulator=False,
            min_num_qubits=2,
        )

        pass_manager = generate_preset_pass_manager(
            target=backend.target,
            optimization_level=1,
        )

        transpiled_circuit = pass_manager.run(qc)

        with Session(backend=backend) as session:
            sampler = Sampler(mode=session)
            job = sampler.run([transpiled_circuit], shots=shots)
            result = job.result()[0]
            counts = result.data.cr.get_counts()

        return {
            "mode": "ibm_quantum",
            "backend": backend.name,
            "job_id": job.job_id(),
            "circuit": "Bell state: H on qubit 0, CX from qubit 0 to qubit 1, then measure both qubits.",
            "shots": shots,
            "counts": counts,
            "explanation": (
                "This result came from IBM Quantum Runtime. Real quantum hardware is noisy, "
                "so you may see small counts outside the ideal 00 and 11 states."
            ),
        }

    except Exception as error:
        half = shots // 2
        noise = random.randint(0, max(1, shots // 20))
        good_total = shots - noise

        return {
            "mode": "fallback_after_ibm_error",
            "backend": "fallback demo simulator",
            "error": str(error),
            "circuit": "Bell state demo fallback.",
            "shots": shots,
            "counts": {
                "00": good_total // 2,
                "11": good_total - (good_total // 2),
                "01": noise // 2,
                "10": noise - (noise // 2),
            },
            "explanation": (
                "The IBM Quantum call failed, so the app returned a safe fallback result. "
                "This still demonstrates the idea of Bell-state correlation for the class demo."
            ),
        }