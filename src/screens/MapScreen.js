import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { calculateStopRoute } from '../GraphRouterDynamic'; // Adjusted import path

// Bounding Box e Servidores
const BBOX = { south: -15.82, west: -47.95, north: -15.75, east: -47.85 };
const OVERPASS_SERVERS = ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter"];

export default function MapScreen() {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [visibleRegion, setVisibleRegion] = useState(null);
  const [startStop, setStartStop] = useState(null);
  const [endStop, setEndStop] = useState(null);
  const [pathCoords, setPathCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);

  async function fetchStops() {
    setLoading(true);
    const q = `[out:json][timeout:60];(node["highway"="bus_stop"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});node["public_transport"="platform"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}););out body;`;
    for (const server of OVERPASS_SERVERS) {
      try {
        const res = await fetch(`${server}?data=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const parsed = (json.elements || []).filter(e => e.type === "node" && e.lat && e.lon).map(e => ({ id: String(e.id), lat: e.lat, lon: e.lon, name: e.tags?.name || e.tags?.ref || "Parada" }));
        setStops(parsed);
        setLoading(false);
        return;
      } catch (err) { console.warn(`Falha no servidor: ${err.message}`); }
    }
    Alert.alert("Erro ao carregar paradas", "Não foi possível conectar aos servidores.");
    setLoading(false);
  }

  async function fetchRoute(start, end) {
    if (!start || !end) return;
    setCalculating(true);
    setPathCoords([]);
    setRouteInfo(null);
    try {
      const result = await calculateStopRoute(stops, start.id, end.id, { maxNeighbors: 12, useRealDistances: false });
      if (result.coordinates.length > 0) {
        setPathCoords(result.coordinates);
        setRouteInfo({ stops: result.stopsCount, distance: (result.distance / 1000).toFixed(2), duration: Math.round(result.duration / 60) });
      } else { Alert.alert("Rota não encontrada", "Não foi possível encontrar uma rota."); }
    } catch (error) { Alert.alert("Erro", "Ocorreu um erro ao calcular a rota."); }
    setCalculating(false);
  }

  useEffect(() => { fetchStops(); }, []);
  useEffect(() => { if (startStop && endStop) fetchRoute(startStop, endStop); else { setPathCoords([]); setRouteInfo(null); } }, [startStop, endStop]);

  const handleMarkerPress = (stop) => {
    if (!startStop) setStartStop(stop);
    else if (!endStop) { if (stop.id !== startStop.id) setEndStop(stop); }
    else { setStartStop(stop); setEndStop(null); }
  };

  const clearRoute = () => { setStartStop(null); setEndStop(null); };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{ latitude: -15.792, longitude: -47.8825, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        onRegionChangeComplete={setVisibleRegion}
      >
        <UrlTile urlTemplate="https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png" maximumZ={19} />
        {stops.filter(s => (startStop?.id === s.id || endStop?.id === s.id) || (visibleRegion && visibleRegion.latitudeDelta < 0.03)).map(s => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lon }}
            title={s.name}
            pinColor={startStop?.id === s.id ? '#4CAF50' : endStop?.id === s.id ? '#D32F2F' : '#C70039'}
            onPress={() => handleMarkerPress(s)}
          />
        ))}
        {pathCoords.length > 0 && <Polyline coordinates={pathCoords} strokeColor="#0b63d6" strokeWidth={5} />}
      </MapView>

      <View style={styles.panel}>
        <Text style={styles.info}>{loading ? "Carregando paradas..." : `${stops.length} paradas disponíveis`}</Text>
        
        {calculating && <ActivityIndicator color="#0b63d6" style={{ marginVertical: 10 }} />}

        {startStop && <Text style={styles.routeText}>🟢 Origem: {startStop.name || ''}</Text>}
        {endStop && <Text style={styles.routeText}>🔴 Destino: {endStop.name || ''}</Text>}

        {routeInfo && (
          <View style={styles.routeInfoContainer}>
            <Text style={styles.routeInfoText}>
              {`📍 ${routeInfo.stops} paradas • ${routeInfo.distance} km • ~${routeInfo.duration} min`}
            </Text>
          </View>
        )}

        {(startStop || endStop) && !calculating && (
          <TouchableOpacity style={styles.btn} onPress={clearRoute}>
            <Text style={styles.btnText}>Limpar Rota</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  map: { flex: 1 },
  panel: { position: "absolute", bottom: 25, left: 15, right: 15, backgroundColor: "rgba(255,255,255,0.98)", padding: 15, borderRadius: 15, elevation: 10 },
  info: { fontSize: 13, marginBottom: 8, textAlign: 'center', color: '#666' },
  routeText: { fontSize: 14, fontWeight: '500', marginVertical: 4, textAlign: 'center', color: '#222' },
  routeInfoContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  routeInfoText: { fontSize: 15, fontWeight: '600', textAlign: 'center', color: '#0b63d6' },
  btn: { marginTop: 12, paddingVertical: 12, borderRadius: 10, alignItems: "center", backgroundColor: '#0b63d6' },
  btnText: { fontWeight: "bold", fontSize: 15, color: '#FFFFFF' },
});
