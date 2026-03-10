# Plant Analyzer

A hackathon demo app that uses Claude AI to analyze plant photos and provide health assessments and care tips.

## Structure

```
.
├── app/        # React Native (Expo) mobile app
└── backend/    # FastAPI Python backend
```

## Backend

FastAPI server that accepts plant images and uses Claude claude-opus-4-6 to identify the plant, assess its health, and suggest care tips.

```bash
cd backend
uv sync
uv run uvicorn main:app --reload
```

Runs on `http://localhost:8000`.

## App

Expo React Native app. Pick or capture a plant photo, tap **Analyze Plant**, and see the results.

```bash
cd app
npm install
npx expo start
```

## Feature Roadmap

### Backend
- [ ] Health checkup of plant
- [ ] Identification of plant genus
- [ ] Segmentation of plants in input images

### Frontend
- [ ] Analyzed health checkup view
- [ ] Store plant to user browser session
- [ ] Highlight plant segments in frontend view (requires segmentation)

## API

`POST /analyze` — Upload an image file, returns:

```json
{
  "name": "Monstera Deliciosa",
  "health": "Healthy",
  "description": "...",
  "care_tips": ["...", "...", "..."]
}
```

