from fastapi import FastAPI

app = FastAPI(
    title="University AI Portal Backend",
    description="Backend API for the university AI portal demo.",
    version="0.1.0"
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