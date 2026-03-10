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

## User Workflow

1. **Upload image** — User captures or picks a photo containing one or more plants
2. **Segmentation** — Frontend calls `POST /segment`; backend detects individual plant regions and returns segments
3. **Highlight plants** — Frontend overlays the detected plant segments on the image so the user can see what was found
4. **Select a plant** — User taps on one highlighted segment to select the plant they want to analyze
5. **Analyze** — Frontend calls `POST /analyze` with the selected segment; backend returns name, genus, health status, description, and care tips
6. **View results** — User sees the full analysis result in the app
7. **Save to collection** — User can add the plant to "My Plants"; the following data is stored in the browser session:

| Field | Description |
|---|---|
| `name` | Common name of the plant |
| `next_watering` | Date of the next scheduled watering |
| `last_watered` | Date the user last watered the plant |
| `water_cycle_days` | Watering interval in days |
| `health` | Latest health status from the analysis |

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

