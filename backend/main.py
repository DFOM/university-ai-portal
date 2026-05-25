cat > main.py <<'EOF'
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
    question = request.question

    return {
        "question": question,
        "answer": (
            "This is the demo AI response. Later, this endpoint will search the "
            "Obsidian knowledge graph, send context to the local LLM, and return "
            "a grounded student advising answer."
        ),
        "sources": [
            "Obsidian knowledge graph",
            "Local LLM worker",
            "Railway backend"
        ]
    }
EOF