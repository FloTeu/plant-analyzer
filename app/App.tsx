import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";

const BACKEND_URL = "http://localhost:8000";
const IMAGE_SIZE = 300;
const SCALE = IMAGE_SIZE / 1000;

// ── Types ──────────────────────────────────────────────────────────────────

interface BoundingBox { y1: number; x1: number; y2: number; x2: number; }
interface PlantSegment { label: string; box: BoundingBox; }
interface AnalysisResult { name: string; genus: string; health: string; description: string; care_tips: string[]; }
interface SavedPlant {
  id: string;
  name: string;
  health: string;
  water_cycle_days: number;
  last_watered: string;
  next_watering: string;
}

type Step =
  | { name: "IDLE" }
  | { name: "SEGMENTING"; imageUri: string }
  | { name: "SELECT_SEGMENT"; imageUri: string; segments: PlantSegment[] }
  | { name: "ANALYZING"; imageUri: string; selectedSegment: PlantSegment }
  | { name: "RESULT"; imageUri: string; selectedSegment: PlantSegment; analysis: AnalysisResult };

// ── Helpers ────────────────────────────────────────────────────────────────

const healthColor: Record<string, string> = {
  Healthy: "#4CAF50",
  "Needs Attention": "#FF9800",
  Unhealthy: "#F44336",
};

function scaleBox(box: BoundingBox) {
  return {
    top:    box.y1 * SCALE,
    left:   box.x1 * SCALE,
    width:  (box.x2 - box.x1) * SCALE,
    height: (box.y2 - box.y1) * SCALE,
  };
}

function savePlant(analysis: AnalysisResult, waterCycleDays: number): void {
  const today = new Date();
  const next = new Date();
  next.setDate(today.getDate() + waterCycleDays);
  const plant: SavedPlant = {
    id: crypto.randomUUID(),
    name: analysis.name,
    health: analysis.health,
    water_cycle_days: waterCycleDays,
    last_watered: today.toISOString().split("T")[0],
    next_watering: next.toISOString().split("T")[0],
  };
  const existing: SavedPlant[] = JSON.parse(window.sessionStorage.getItem("my_plants") ?? "[]");
  window.sessionStorage.setItem("my_plants", JSON.stringify([...existing, plant]));
}

async function buildFormData(imageUri: string): Promise<FormData> {
  const formData = new FormData();
  if (Platform.OS === "web") {
    const res = await fetch(imageUri);
    const blob = await res.blob();
    formData.append("image", blob, "plant.jpg");
  } else {
    formData.append("image", { uri: imageUri, name: "plant.jpg", type: "image/jpeg" } as any);
  }
  return formData;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function App() {
  const [step, setStep] = useState<Step>({ name: "IDLE" });
  const [waterDays, setWaterDays] = useState("7");
  const [saved, setSaved] = useState(false);

  async function pickImage(fromCamera: boolean) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Please grant the requested permission.");
      return;
    }

    const picked = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });

    if (picked.canceled || !picked.assets[0]) return;

    const imageUri = picked.assets[0].uri;
    setStep({ name: "SEGMENTING", imageUri });
    setSaved(false);

    try {
      const formData = await buildFormData(imageUri);
      const response = await fetch(`${BACKEND_URL}/segment`, { method: "POST", body: formData });
      if (!response.ok) throw new Error("Segmentation failed");
      const data = await response.json();
      const segments: PlantSegment[] = data.segments;

      if (segments.length === 0) {
        Alert.alert("No plants detected", "Try a different photo.");
        setStep({ name: "IDLE" });
        return;
      }

      setStep({ name: "SELECT_SEGMENT", imageUri, segments });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Segmentation failed. Is the backend running?");
      setStep({ name: "IDLE" });
    }
  }

  async function selectSegment(imageUri: string, selectedSegment: PlantSegment) {
    setStep({ name: "ANALYZING", imageUri, selectedSegment });

    try {
      const formData = await buildFormData(imageUri);
      const response = await fetch(`${BACKEND_URL}/analyze`, { method: "POST", body: formData });
      if (!response.ok) throw new Error("Analysis failed");
      const analysis: AnalysisResult = await response.json();
      setStep({ name: "RESULT", imageUri, selectedSegment, analysis });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Analysis failed. Is the backend running?");
      setStep({ name: "SELECT_SEGMENT", imageUri, segments: [selectedSegment] });
    }
  }

  function reset() {
    setStep({ name: "IDLE" });
    setSaved(false);
    setWaterDays("7");
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const isLoading = step.name === "SEGMENTING" || step.name === "ANALYZING";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Plant Analyzer</Text>

      {/* Step: IDLE — show pick buttons */}
      {step.name === "IDLE" && (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.btn} onPress={() => pickImage(true)}>
            <Text style={styles.btnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => pickImage(false)}>
            <Text style={styles.btnText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Step: SEGMENTING — show image + spinner */}
      {step.name === "SEGMENTING" && (
        <>
          <Image source={{ uri: step.imageUri }} style={styles.preview} />
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 20 }} />
          <Text style={styles.loadingText}>Detecting plants…</Text>
        </>
      )}

      {/* Step: SELECT_SEGMENT — image with bounding box overlays */}
      {step.name === "SELECT_SEGMENT" && (
        <>
          <Text style={styles.hint}>Tap a plant to analyze it</Text>
          <View style={styles.imageContainer}>
            <Image source={{ uri: step.imageUri }} style={styles.preview} />
            {step.segments.map((seg, i) => {
              const { top, left, width, height } = scaleBox(seg.box);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.segmentBox, { top, left, width, height }]}
                  onPress={() => selectSegment(step.imageUri, seg)}
                >
                  <Text style={styles.segmentLabel}>{seg.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={[styles.btn, styles.resetBtn]} onPress={reset}>
            <Text style={styles.btnText}>Pick Different Photo</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Step: ANALYZING — show image + spinner */}
      {step.name === "ANALYZING" && (
        <>
          <Image source={{ uri: step.imageUri }} style={styles.preview} />
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 20 }} />
          <Text style={styles.loadingText}>Analyzing {step.selectedSegment.label}…</Text>
        </>
      )}

      {/* Step: RESULT — show analysis card + save controls */}
      {step.name === "RESULT" && (
        <>
          <Image source={{ uri: step.imageUri }} style={styles.preview} />
          <View style={styles.result}>
            <Text style={styles.plantName}>{step.analysis.name}</Text>
            <Text style={styles.genus}>{step.analysis.genus}</Text>
            <Text style={[styles.health, { color: healthColor[step.analysis.health] ?? "#333" }]}>
              {step.analysis.health}
            </Text>
            <Text style={styles.description}>{step.analysis.description}</Text>
            <Text style={styles.tipsTitle}>Care Tips</Text>
            {step.analysis.care_tips.map((tip, i) => (
              <Text key={i} style={styles.tip}>• {tip}</Text>
            ))}

            <View style={styles.saveRow}>
              <Text style={styles.saveLabel}>Water every</Text>
              <TextInput
                style={styles.daysInput}
                value={waterDays}
                onChangeText={setWaterDays}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.saveLabel}>days</Text>
            </View>

            {saved ? (
              <Text style={styles.savedText}>Saved to My Plants!</Text>
            ) : (
              <TouchableOpacity
                style={[styles.btn, styles.saveBtn]}
                onPress={() => {
                  savePlant(step.analysis, parseInt(waterDays, 10) || 7);
                  setSaved(true);
                }}
              >
                <Text style={styles.btnText}>Save to My Plants</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={[styles.btn, styles.resetBtn]} onPress={reset}>
            <Text style={styles.btnText}>Analyze Another Plant</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#f9fafb",
  },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 24, color: "#1a1a1a" },
  hint: { fontSize: 14, color: "#666", marginBottom: 12 },
  buttonRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  btn: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  saveBtn: { backgroundColor: "#2196F3", marginTop: 16, alignSelf: "center" },
  resetBtn: { backgroundColor: "#888", marginTop: 16 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  preview: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 12 },
  imageContainer: { width: IMAGE_SIZE, height: IMAGE_SIZE, position: "relative" },
  segmentBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#4CAF50",
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    justifyContent: "flex-end",
  },
  segmentLabel: {
    backgroundColor: "#4CAF50",
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  loadingText: { marginTop: 8, color: "#555", fontSize: 14 },
  result: {
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  plantName: { fontSize: 22, fontWeight: "700", marginBottom: 2 },
  genus: { fontSize: 14, color: "#888", fontStyle: "italic", marginBottom: 6 },
  health: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  description: { fontSize: 14, color: "#444", marginBottom: 16, lineHeight: 20 },
  tipsTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  tip: { fontSize: 14, color: "#555", marginBottom: 4 },
  saveRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20 },
  saveLabel: { fontSize: 14, color: "#444" },
  daysInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 56,
    textAlign: "center",
    fontSize: 14,
  },
  savedText: { color: "#4CAF50", fontWeight: "700", fontSize: 16, marginTop: 16, textAlign: "center" },
});
