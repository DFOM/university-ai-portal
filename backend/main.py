from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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