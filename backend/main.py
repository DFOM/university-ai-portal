from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="University AI Portal Backend",
    description="Backend API for the university AI portal demo.",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str


@app.get("/")
def root():
    return {
        "message": "University AI Portal backend is online"
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }


@app.post("/chat")
def chat(request: ChatRequest):
    return {
        "question": request.question,
        "answer": "This is the demo AI response. Later this will connect to the Obsidian knowledge graph, local LLM, and IBM Quantum tools.",
        "sources": [
            "Railway backend",
            "Obsidian knowledge graph",
            "Local LLM worker"
        ]
    }
