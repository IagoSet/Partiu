// App.js
import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, Alert, TouchableOpacity } from "react-native";
import MapView, { Marker, UrlTile, Polyline } from "react-native-maps";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";
// Servidor público OSRM (cuidado: tem limite de uso, para produção é melhor hospedar o seu)
const OSRM_API = "https://router.project-osrm.org/route/v1/driving";

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
  const [visibleRegion, setVisibleRegion] = useState(null);

  const [startStop, setStartStop] = useState(null);
  const [endStop, setEndStop] = useState(null);
  const [pathCoords, setPathCoords] = useState([]);

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
        .filter((e) => e.type === "node" && e.lat && e.lon)
        .map((e) => ({
          id: String(e.id),
          lat: e.lat,
          lon: e.lon,
          name:
            e.tags && (e.tags.name || e.tags.ref)
              ? e.tags.name || e.tags.ref
              : "Parada de ônibus",
        }));
      setStops(parsed);
    } catch (err) {
      console.error("Erro Overpass:", err);
      Alert.alert("Erro", "Falha ao buscar paradas.");
    } finally {
      setLoading(false);
    }
  }

  // Chama OSRM para calcular rota viária entre duas paradas
  async function fetchRoute(start, end) {
    try {
      const url = `${OSRM_API}/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (json.routes && json.routes.length > 0) {
        const coords = json.routes[0].geometry.coordinates.map((c) => ({
          latitude: c[1],
          longitude: c[0],
        }));
        setPathCoords(coords);
      } else {
        Alert.alert("Aviso", "Nenhuma rota encontrada.");
      }
    } catch (err) {
      console.error("Erro OSRM:", err);
      Alert.alert("Erro", "Falha ao calcular rota.");
    }
  }

  useEffect(() => {
    fetchStops();
  }, []);

  // Calcula rota sempre que origem e destino são definidos
  useEffect(() => {
    if (startStop && endStop) {
      fetchRoute(startStop, endStop);
    }
  }, [startStop, endStop]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -15.792,
          longitude: -47.8825,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        onRegionChangeComplete={(region) => setVisibleRegion(region)}
      >
        <UrlTile
          urlTemplate="https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png"
          maximumZ={19}
        />

        {/* Marcadores */}
        {visibleRegion &&
          visibleRegion.latitudeDelta < 0.03 &&
          stops
            .filter(
              (s) =>
                s.lat <
                  visibleRegion.latitude + visibleRegion.latitudeDelta / 2 &&
                s.lat >
                  visibleRegion.latitude - visibleRegion.latitudeDelta / 2 &&
                s.lon <
                  visibleRegion.longitude + visibleRegion.longitudeDelta / 2 &&
                s.lon >
                  visibleRegion.longitude - visibleRegion.longitudeDelta / 2
            )
            .map((s) => (
              <Marker
                key={s.id}
                coordinate={{ latitude: s.lat, longitude: s.lon }}
                title={s.name}
                pinColor={
                  startStop?.id === s.id
                    ? "green"
                    : endStop?.id === s.id
                    ? "red"
                    : "blue"
                }
                onPress={() => {
                  if (!startStop) setStartStop(s);
                  else if (!endStop) setEndStop(s);
                  else {
                    setStartStop(s);
                    setEndStop(null);
                    setPathCoords([]);
                  }
                }}
              />
            ))}

        {/* Polyline da rota */}
        {pathCoords.length > 0 && (
          <Polyline
            coordinates={pathCoords}
            strokeColor="#0b63d6"
            strokeWidth={4}
          />
        )}
      </MapView>

      <View style={styles.panel}>
        <Text style={styles.info}>
          {loading
            ? "Carregando paradas..."
            : `Paradas carregadas: ${stops.length}`}
        </Text>
        {startStop && <Text>Origem: {startStop.name}</Text>}
        {endStop && <Text>Destino: {endStop.name}</Text>}
        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            setStartStop(null);
            setEndStop(null);
            setPathCoords([]);
          }}
        >
          <Text style={styles.btnText}>Limpar rota</Text>
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
    flexDirection: "column",
    alignItems: "flex-start",
    elevation: 4,
  },
  info: { fontSize: 14, color: "#222" },
  btn: {
    marginTop: 6,
    backgroundColor: "#0b63d6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  btnText: { color: "#fff", fontWeight: "600" },
});
