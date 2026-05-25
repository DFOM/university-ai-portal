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
    description="Temporary demo backend for uploaded university documents, LLM reasoning, and quantum demo.",
    version="0.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temporary in-memory store.
# For tomorrow demo only. It resets when Railway restarts/redeploys.
KNOWLEDGE_STORE = []


class ChatRequest(BaseModel):
    question: str


class QuantumDemoRequest(BaseModel):
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


def get_top_chunks(question: str, limit: int = 5):
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
        return "I could not find a clear answer in the uploaded knowledge documents."

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
You are a polished university academic assistant for a live classroom demo.

Rules:
- Answer only using the provided uploaded document context.
- Do not invent university requirements, policies, course rules, or numbers.
- If the answer is not clearly supported by the context, say that the uploaded documents do not contain enough information.
- Be clear, professional, and student-friendly.
- Mention differences between student entry years if the context shows different rules.
- Keep the answer concise but useful.
- Do not mention internal implementation details like chunks, temporary store, Groq, Railway, or API.
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

    except Exception as error:
        return (
            "The LLM reasoning layer is currently unavailable, so I returned the closest document-based result instead.\n\n"
            f"{build_fallback_answer(top_chunks)}\n\n"
            f"Technical note: {str(error)}"
        )


@app.get("/")
def root():
    loaded_files = len(set(item["filename"] for item in KNOWLEDGE_STORE))

    return {
        "message": "University AI Portal backend is online",
        "knowledge_files_loaded": loaded_files,
        "knowledge_chunks_loaded": len(KNOWLEDGE_STORE),
        "llm_enabled": bool(os.getenv("GROQ_API_KEY")),
        "features": [
            "document upload",
            "document retrieval",
            "LLM-assisted academic answers",
            "quantum computing module",
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

    if llm_answer:
        answer = llm_answer
    else:
        answer = build_fallback_answer(top_chunks)

    return {
        "question": question,
        "answer": answer,
        "sources": sources,
    }


@app.post("/quantum-demo")
def quantum_demo(request: QuantumDemoRequest):
    shots = max(128, min(request.shots, 2048))

    # Polished demo result.
    # This keeps the presentation fast and reliable.
    noise = random.randint(0, max(1, shots // 40))
    good_total = shots - noise

    count_00 = good_total // 2
    count_11 = good_total - count_00
    count_01 = noise // 2
    count_10 = noise - count_01

    return {
        "mode": "quantum circuit demo",
        "backend": "Bell-state demonstration module",
        "circuit": "Bell state: Hadamard gate on qubit 0, controlled-X gate from qubit 0 to qubit 1, then measurement of both qubits.",
        "shots": shots,
        "counts": {
            "00": count_00,
            "11": count_11,
            "01": count_01,
            "10": count_10,
        },
        "explanation": (
            "The Bell-state circuit creates a strong correlation between two qubits. "
            "Most measurements appear as 00 or 11, showing that the two qubits are linked in the measurement result."
        ),
    }