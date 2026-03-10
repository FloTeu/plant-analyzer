import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";

const BACKEND_URL = "http://localhost:8000";

interface AnalysisResult {
  name: string;
  health: string;
  description: string;
  care_tips: string[];
}

const healthColor: Record<string, string> = {
  Healthy: "#4CAF50",
  "Needs Attention": "#FF9800",
  Unhealthy: "#F44336",
};

export default function App() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

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

    if (!picked.canceled && picked.assets[0]) {
      setImageUri(picked.assets[0].uri);
      setResult(null);
    }
  }

  async function analyze() {
    if (!imageUri) return;
    setLoading(true);
    try {
      const formData = new FormData();
      if (Platform.OS === "web") {
        const res = await fetch(imageUri);
        const blob = await res.blob();
        formData.append("image", blob, "plant.jpg");
      } else {
        formData.append("image", {
          uri: imageUri,
          name: "plant.jpg",
          type: "image/jpeg",
        } as any);
      }

      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Analysis failed");
      const data: AnalysisResult = await response.json();
      setResult(data);
    } catch (e) {
      Alert.alert("Error", "Could not analyze the plant. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>🌿 Plant Analyzer</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.btn} onPress={() => pickImage(true)}>
          <Text style={styles.btnText}>📷 Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => pickImage(false)}>
          <Text style={styles.btnText}>🖼 Gallery</Text>
        </TouchableOpacity>
      </View>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.preview} />
      )}

      {imageUri && !loading && (
        <TouchableOpacity style={[styles.btn, styles.analyzeBtn]} onPress={analyze}>
          <Text style={styles.btnText}>Analyze Plant</Text>
        </TouchableOpacity>
      )}

      {loading && <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 20 }} />}

      {result && (
        <View style={styles.result}>
          <Text style={styles.plantName}>{result.name}</Text>
          <Text style={[styles.health, { color: healthColor[result.health] ?? "#333" }]}>
            {result.health}
          </Text>
          <Text style={styles.description}>{result.description}</Text>
          <Text style={styles.tipsTitle}>Care Tips</Text>
          {result.care_tips.map((tip, i) => (
            <Text key={i} style={styles.tip}>• {tip}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#f9fafb",
  },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 24, color: "#1a1a1a" },
  buttonRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  btn: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  analyzeBtn: { backgroundColor: "#2196F3", marginTop: 16 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  preview: { width: 300, height: 300, borderRadius: 12, marginTop: 8 },
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
  plantName: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  health: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  description: { fontSize: 14, color: "#444", marginBottom: 16, lineHeight: 20 },
  tipsTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  tip: { fontSize: 14, color: "#555", marginBottom: 4 },
});
