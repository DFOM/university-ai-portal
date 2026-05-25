cat > backend/main.py <<'EOF'
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from io import BytesIO
from pypdf import PdfReader
import re

app = FastAPI(
    title="University AI Portal Backend",
    description="Temporary demo backend for uploaded university documents.",
    version="0.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temporary in-memory knowledge store.
# Good for tomorrow demo. It resets if Railway restarts/redeploys.
KNOWLEDGE_STORE = []


class ChatRequest(BaseModel):
    question: str


def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def chunk_text(text: str, chunk_size: int = 900):
    words = text.split()
    chunks = []

    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i:i + chunk_size])
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


@app.get("/")
def root():
    return {
        "message": "University AI Portal backend is online",
        "knowledge_files_loaded": len(set(item["filename"] for item in KNOWLEDGE_STORE)),
        "knowledge_chunks_loaded": len(KNOWLEDGE_STORE)
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_bytes = await file.read()
    raw_text = extract_file_text(file.filename, file_bytes)
    cleaned = clean_text(raw_text)

    if not cleaned:
        return {
            "status": "error",
            "message": "No readable text found in this file."
        }

    chunks = chunk_text(cleaned)

    for index, chunk in enumerate(chunks):
        KNOWLEDGE_STORE.append({
            "filename": file.filename,
            "chunk_index": index,
            "text": chunk
        })

    return {
        "status": "success",
        "filename": file.filename,
        "chunks_added": len(chunks),
        "total_chunks": len(KNOWLEDGE_STORE)
    }


@app.get("/knowledge")
def get_knowledge_status():
    files = {}

    for item in KNOWLEDGE_STORE:
        filename = item["filename"]
        files[filename] = files.get(filename, 0) + 1

    return {
        "files": files,
        "total_chunks": len(KNOWLEDGE_STORE)
    }


@app.delete("/knowledge")
def clear_knowledge():
    KNOWLEDGE_STORE.clear()

    return {
        "status": "success",
        "message": "Temporary knowledge store cleared."
    }


@app.post("/chat")
def chat(request: ChatRequest):
    question = request.question.strip()

    if not question:
        return {
            "question": question,
            "answer": "Please enter a question.",
            "sources": []
        }

    if not KNOWLEDGE_STORE:
        return {
            "question": question,
            "answer": "No documents have been uploaded yet. Upload a handbook, syllabus, or course document first.",
            "sources": []
        }

    scored_chunks = []

    for item in KNOWLEDGE_STORE:
        score = score_chunk(question, item["text"])

        if score > 0:
            scored_chunks.append({
                "score": score,
                "filename": item["filename"],
                "chunk_index": item["chunk_index"],
                "text": item["text"]
            })

    scored_chunks.sort(key=lambda x: x["score"], reverse=True)
    top_chunks = scored_chunks[:3]

    if not top_chunks:
        return {
            "question": question,
            "answer": "I could not find a clear answer in the uploaded temporary knowledge documents.",
            "sources": []
        }

    answer_parts = []

    for chunk in top_chunks:
        preview = chunk["text"][:700]
        answer_parts.append(
            f"From {chunk['filename']}: {preview}..."
        )

    return {
        "question": question,
        "answer": "\n\n".join(answer_parts),
        "sources": list(dict.fromkeys(chunk["filename"] for chunk in top_chunks))
    }
EOF