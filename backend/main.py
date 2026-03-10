import base64
import json
import os
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

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


class AnalysisResult(BaseModel):
    name: str
    health: str
    description: str
    care_tips: list[str]


@app.post("/analyze", response_model=AnalysisResult)
async def analyze_plant(image: UploadFile = File(...)):
    image_data = await image.read()
    image_b64 = base64.standard_b64encode(image_data).decode("utf-8")
    media_type = image.content_type or "image/jpeg"

    response = client.chat.completions.create(
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
                            "Analyze this plant image and respond in JSON with exactly these fields:\n"
                            "- name: common name of the plant\n"
                            "- health: one of 'Healthy', 'Needs Attention', or 'Unhealthy'\n"
                            "- description: 1-2 sentence description of the plant and its current condition\n"
                            "- care_tips: list of 3 short care tips\n"
                            "Respond with only the JSON object, no markdown."
                        ),
                    },
                ],
            }
        ],
        max_tokens=1024,
    )

    result = json.loads(response.choices[0].message.content)
    return AnalysisResult(**result)


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
