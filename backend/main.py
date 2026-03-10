import base64
import os
from dotenv import load_dotenv
from fastapi import FastAPI, File, Header, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from models import PlantAnalysis, SegmentationResult

load_dotenv()

app = FastAPI(title="Plant Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
)


def parse_language(accept_language: str | None) -> str:
    """Extract the primary language tag from an Accept-Language header value."""
    if not accept_language:
        return "English"
    primary = accept_language.split(",")[0].split(";")[0].strip()
    return primary or "English"


@app.post("/analyze", response_model=PlantAnalysis)
async def analyze_plant(
    image: UploadFile = File(...),
    language: str | None = Query(default=None, description="Response language (e.g. 'de', 'fr'). Defaults to Accept-Language header."),
    accept_language: str | None = Header(default=None),
):
    image_data = await image.read()
    image_b64 = base64.standard_b64encode(image_data).decode("utf-8")
    media_type = image.content_type or "image/jpeg"
    response_language = language or parse_language(accept_language)

    response = client.beta.chat.completions.parse(
        model="google/gemini-2.5-flash",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{image_b64}",
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            f"Analyze this plant image. Identify the plant, assess its health, and provide care tips. "
                            f"Respond in the following language: {response_language}."
                        ),
                    },
                ],
            }
        ],
        response_format=PlantAnalysis,
        max_tokens=1024,
    )

    return response.choices[0].message.parsed


@app.post("/segment", response_model=SegmentationResult)
async def segment_plants(image: UploadFile = File(...)):
    image_data = await image.read()
    image_b64 = base64.standard_b64encode(image_data).decode("utf-8")
    media_type = image.content_type or "image/jpeg"

    response = client.beta.chat.completions.parse(
        model="google/gemini-2.5-flash",
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_b64}"}},
                {
                    "type": "text",
                    "text": (
                        "Detect every distinct plant in this image. "
                        "Return bounding box coordinates as integers 0–1000, where (0,0) is top-left. "
                        "If no plants are found, return an empty segments list."
                    ),
                },
            ],
        }],
        response_format=SegmentationResult,
        max_tokens=1024,
    )

    return response.choices[0].message.parsed or SegmentationResult(segments=[])


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str


@app.post("/ask", response_model=AskResponse)
async def ask(request: AskRequest):
    response = client.chat.completions.create(
        model="google/gemini-2.5-flash",
        messages=[{"role": "user", "content": request.question}],
        max_tokens=1024,
    )
    return AskResponse(answer=response.choices[0].message.content)


@app.get("/health")
def health_check():
    return {"status": "ok"}
