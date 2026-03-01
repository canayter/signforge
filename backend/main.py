"""
SignForge — Translation Proxy Backend
FastAPI server that mediates between the frontend and Claude API.
Keeps the Anthropic API key server-side.

Deploy: uvicorn main:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic
import os

app = FastAPI(title="SignForge API", version="0.1.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ayter.com",
        "http://localhost:5173",   # Vite dev server
        "http://localhost:4173",   # Vite preview
    ],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

# ── Anthropic client ──────────────────────────────────────────────────────────
client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# ── Language display names (for the prompt) ───────────────────────────────────
LANGUAGE_NAMES = {
    "ASL":    "American Sign Language (ASL)",
    "BSL":    "British Sign Language (BSL)",
    "ISL":    "Indian Sign Language (ISL)",
    "JSL":    "Japanese Sign Language (JSL)",
    "CSL":    "Chinese Sign Language (CSL)",
    "LSF":    "Langue des Signes Française (LSF)",
    "Auslan": "Auslan (Australian Sign Language)",
}

# ── Request / Response models ─────────────────────────────────────────────────
class TranslationRequest(BaseModel):
    gloss: str          # Raw signs, e.g. "ME WANT COFFEE PLEASE"
    language: str = "ASL"

class TranslationResponse(BaseModel):
    translation: str
    gloss: str


# ── Translation endpoint ──────────────────────────────────────────────────────
@app.post("/translate", response_model=TranslationResponse)
async def translate(req: TranslationRequest) -> TranslationResponse:
    if not req.gloss.strip():
        raise HTTPException(status_code=400, detail="gloss is empty")

    lang_name = LANGUAGE_NAMES.get(req.language, req.language)

    system_prompt = (
        "You are a sign language interpreter assistant. "
        "You receive a sequence of sign language glosses — the raw transcription "
        "of signs as the signer performed them — and you produce natural, fluent "
        "English output that conveys the intended meaning. "
        "Sign languages have their own grammar distinct from spoken English "
        "(e.g. topic-comment structure, no articles, different tense markers). "
        "Produce only the natural English translation. No explanation, no quotes, "
        "no prefix. Just the translation."
    )

    user_prompt = (
        f"Sign language: {lang_name}\n"
        f"Gloss sequence: {req.gloss.upper()}\n\n"
        "Natural English translation:"
    )

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=256,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        translation = message.content[0].text.strip()
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {e}")

    return TranslationResponse(translation=translation, gloss=req.gloss)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "signforge-api"}
