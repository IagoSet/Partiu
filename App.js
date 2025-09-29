// App.js
import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, ActivityIndicator, Alert, TouchableOpacity } from "react-native";
import MapView, { Marker, UrlTile } from "react-native-maps";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

// Bounding Box do Plano Piloto
const BBOX = {
  south: -15.8808,
  west: -48.1064,
  north: -15.5662,
  east: -47.7493,
};

export default function App() {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(false);

  async function fetchStops() {
    setLoading(true);
    const q = `
      [out:json][timeout:25];
      (
        node["highway"="bus_stop"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
        node["public_transport"="platform"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
      );
      out body;
    `;
    try {
      const url = OVERPASS_API + "?data=" + encodeURIComponent(q);
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      const parsed = (json.elements || [])
        .filter(e => e.type === "node" && e.lat && e.lon)
        .map(e => ({
          id: e.id,
          lat: e.lat,
          lon: e.lon,
          name: (e.tags && (e.tags.name || e.tags.ref)) ? (e.tags.name || e.tags.ref) : "Parada de ônibus",
        }));
      setStops(parsed);
    } catch (err) {
      console.error("Erro Overpass:", err);
      Alert.alert("Erro", "Falha ao buscar paradas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStops();
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -15.792, // centro de Brasília
          longitude: -47.8825,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {/* Carto basemap (livre p/ apps) */}
        <UrlTile
          urlTemplate="https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png"
          maximumZ={19}
        />

       {stops.map(s => (
  <Marker
    key={String(s.id)}
    coordinate={{ latitude: s.lat, longitude: s.lon }}
    title={s.name}
  >
    <View style={styles.busStopMarker} />
  </Marker>
))}

      </MapView>

      <View style={styles.panel}>
        <Text style={styles.info}>Paradas carregadas: {stops.length}</Text>
        <TouchableOpacity style={styles.btn} onPress={fetchStops}>
          <Text style={styles.btnText}>{loading ? "Carregando..." : "Recarregar"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  panel: {
    position: "absolute",
    bottom: 16,
    left: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 4,
  },
  info: { fontSize: 14, color: "#222" },
  btn: {
    backgroundColor: "#0b63d6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  btnText: { color: "#fff", fontWeight: "600" },
  busStopMarker: {
  width: 10,
  height: 10,
  borderRadius: 5,
  backgroundColor: "#666", // cinza
},

});
