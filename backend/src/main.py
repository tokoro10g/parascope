from fastapi import FastAPI

app = FastAPI(title="Parascope Backend")

@app.get("/")
async def root():
    return {"message": "Hello from Parascope Backend"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
