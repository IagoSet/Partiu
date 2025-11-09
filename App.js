// App.js - Versão com Rotas de Rua
import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, Alert, TouchableOpacity, ActivityIndicator } from "react-native";
import MapView, { Marker, UrlTile, Polyline } from "react-native-maps";
import { calculateStopRoute } from './GraphRouterDynamic';

// Lista de servidores Overpass (fallback automático)
const OVERPASS_SERVERS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

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
  const [calculating, setCalculating] = useState(false);
  const [buildingGraph, setBuildingGraph] = useState(false);
  const [visibleRegion, setVisibleRegion] = useState(null);

  const [startStop, setStartStop] = useState(null);
  const [endStop, setEndStop] = useState(null);
  const [pathCoords, setPathCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);

  async function fetchStops() {
    setLoading(true);
    
    // Query simplificada e otimizada
    const q = `
      [out:json][timeout:60];
      (
        node["highway"="bus_stop"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
        node["public_transport"="platform"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
      );
      out body;
    `;
    
    // Tenta cada servidor até conseguir
    let lastError = null;
    for (let i = 0; i < OVERPASS_SERVERS.length; i++) {
      const server = OVERPASS_SERVERS[i];
      console.log(`Tentando servidor ${i + 1}/${OVERPASS_SERVERS.length}: ${server}`);
      
      try {
        const url = server + "?data=" + encodeURIComponent(q);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
        
        const res = await fetch(url, { 
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        
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
        console.log(`✅ ${parsed.length} paradas carregadas com sucesso do servidor ${i + 1}`);
        setLoading(false);
        return; // Sucesso! Sai da função
        
      } catch (err) {
        console.warn(`❌ Falha no servidor ${i + 1}:`, err.message);
        lastError = err;
        
        // Se não for o último servidor, aguarda um pouco antes de tentar o próximo
        if (i < OVERPASS_SERVERS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // Se chegou aqui, todos os servidores falharam
    console.error("Todos os servidores Overpass falharam:", lastError);
    Alert.alert(
      "Erro ao carregar paradas", 
      "Não foi possível conectar aos servidores do OpenStreetMap. Verifique sua conexão e tente novamente em alguns minutos.\n\n" +
      "Erro: " + (lastError?.message || "Desconhecido"),
      [
        { text: "Tentar Novamente", onPress: () => fetchStops() },
        { text: "Cancelar", style: "cancel" }
      ]
    );
    setLoading(false);
  }

  async function fetchRoute(start, end) {
    if (!start || !end) return;
    
    setCalculating(true);
    setBuildingGraph(true);
    setPathCoords([]);
    setRouteInfo(null);

    try {
      console.log(`Iniciando cálculo de rota: ${start.name} → ${end.name}`);
      
      // Calcula a rota seguindo ruas reais
      const result = await calculateStopRoute(
        stops,
        start.id,
        end.id,
        { 
          maxNeighbors: 20,           // Aumentado para 12 vizinhos
          delayBetweenRequests: 50,
          useRealDistances: false     // USA DISTÂNCIAS REAIS DE RUA! 🔥
        }
      );

      setBuildingGraph(false);

      if (result.coordinates.length > 0) {
        setPathCoords(result.coordinates);
        
        // Formata duração em minutos
        const durationMin = Math.round(result.duration / 60);
        
        setRouteInfo({
          stops: result.stopsCount,
          distance: (result.distance / 1000).toFixed(2), // em km
          duration: durationMin,
          points: result.coordinates.length
        });
        
        console.log(
          `Rota calculada: ${result.stopsCount} paradas, ` +
          `${(result.distance / 1000).toFixed(2)}km, ` +
          `${durationMin}min, ` +
          `${result.coordinates.length} pontos de geometria`
        );
      } else {
        Alert.alert(
          "Rota não encontrada", 
          "Não foi possível encontrar uma rota entre as paradas selecionadas. Tente paradas mais próximas."
        );
      }
    } catch (error) {
      console.error("Erro ao calcular rota:", error);
      Alert.alert(
        "Erro",
        "Ocorreu um erro ao calcular a rota. Verifique sua conexão e tente novamente."
      );
    } finally {
      setCalculating(false);
      setBuildingGraph(false);
    }
  }

  useEffect(() => {
    fetchStops();
  }, []);

  // Calcula rota quando origem e destino são definidos
  useEffect(() => {
    if (startStop && endStop) {
      fetchRoute(startStop, endStop);
    } else {
      setPathCoords([]);
      setRouteInfo(null);
    }
  }, [startStop, endStop]);

  function handleMarkerPress(stop) {
    if (!startStop) {
      setStartStop(stop);
      console.log(`Origem definida: ${stop.name}`);
    } else if (!endStop) {
      if (stop.id === startStop.id) {
        Alert.alert("Aviso", "Selecione uma parada diferente como destino.");
        return;
      }
      setEndStop(stop);
      console.log(`Destino definido: ${stop.name}`);
    } else {
      // Reinicia a seleção
      setStartStop(stop);
      setEndStop(null);
      setPathCoords([]);
      setRouteInfo(null);
      console.log(`Seleção reiniciada. Nova origem: ${stop.name}`);
    }
  }

  function clearRoute() {
    setStartStop(null);
    setEndStop(null);
    setPathCoords([]);
    setRouteInfo(null);
    console.log("Rota limpa");
  }

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

        {/* Marcadores - Filtra por zoom mas sempre mostra origem/destino */}
        {stops
          .filter((s) => {
            // Sempre mostra origem e destino, independente do zoom
            if (startStop?.id === s.id || endStop?.id === s.id) {
              return true;
            }
            // Outras paradas: só mostra com zoom suficiente
            return !visibleRegion || visibleRegion.latitudeDelta < 0.03;
          })
          .map((s) => (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lon }}
              title={s.name}
              description={
                startStop?.id === s.id 
                  ? "🟢 Origem" 
                  : endStop?.id === s.id 
                  ? "🔴 Destino" 
                  : "Parada de ônibus"
              }
              pinColor={
                startStop?.id === s.id
                  ? "green"
                  : endStop?.id === s.id
                  ? "red"
                  : "blue"
              }
              onPress={() => handleMarkerPress(s)}
            />
          ))
        }

        {/* Polyline da rota seguindo ruas */}
        {pathCoords.length > 0 && (
          <Polyline
            coordinates={pathCoords}
            strokeColor="#0b63d6"
            strokeWidth={5}
            lineJoin="round"
            lineCap="round"
          />
        )}
      </MapView>

      {/* Painel de informações */}
      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <Text style={styles.info}>
            {loading
              ? "Carregando paradas..."
              : stops.length > 0
              ? `${stops.length} paradas disponíveis`
              : "Nenhuma parada carregada"}
          </Text>
          {!loading && stops.length === 0 && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={fetchStops}
            >
              <Text style={styles.retryText}>🔄 Tentar Novamente</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {calculating && (
          <View style={styles.calculatingRow}>
            <ActivityIndicator size="small" color="#0b63d6" />
            <Text style={styles.calculatingText}>
              {buildingGraph 
                ? "Construindo grafo com distâncias reais..." 
                : "Calculando rota nas ruas..."}
            </Text>
          </View>
        )}
        
        {startStop && (
          <View style={styles.stopRow}>
            <Text style={styles.stopIcon}>🟢</Text>
            <Text style={styles.routeText} numberOfLines={1}>
              {startStop.name}
            </Text>
          </View>
        )}
        
        {endStop && (
          <View style={styles.stopRow}>
            <Text style={styles.stopIcon}>🔴</Text>
            <Text style={styles.routeText} numberOfLines={1}>
              {endStop.name}
            </Text>
          </View>
        )}
        
        {routeInfo && (
          <View style={styles.routeInfoContainer}>
            <Text style={styles.routeInfoLabel}>Detalhes da rota:</Text>
            <Text style={styles.routeInfoText}>
              📍 {routeInfo.stops} paradas • 
              🚗 {routeInfo.distance} km • 
              ⏱️ ~{routeInfo.duration} min
            </Text>
          </View>
        )}
        
        {!startStop && !calculating && (
          <Text style={styles.hint}>
            👆 Toque em uma parada para definir a origem
          </Text>
        )}
        
        {startStop && !endStop && !calculating && (
          <Text style={styles.hint}>
            👆 Toque em outra parada para definir o destino
          </Text>
        )}
        
        {(startStop || endStop) && (
          <TouchableOpacity
            style={[styles.btn, calculating && styles.btnDisabled]}
            onPress={clearRoute}
            disabled={calculating}
          >
            <Text style={styles.btnText}>
              {calculating ? "Calculando..." : "Limpar rota"}
            </Text>
          </TouchableOpacity>
        )}
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
    backgroundColor: "rgba(255,255,255,0.98)",
    padding: 14,
    borderRadius: 12,
    flexDirection: "column",
    alignItems: "flex-start",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 6,
  },
  info: { 
    fontSize: 13, 
    color: "#666",
    fontWeight: "500",
    flex: 1,
  },
  retryBtn: {
    backgroundColor: "#f0f7ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#0b63d6",
  },
  retryText: {
    fontSize: 11,
    color: "#0b63d6",
    fontWeight: "600",
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    width: "100%",
  },
  stopIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  routeText: {
    fontSize: 14,
    color: "#222",
    fontWeight: "500",
    flex: 1,
  },
  routeInfoContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    width: "100%",
  },
  routeInfoLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
    fontWeight: "600",
  },
  routeInfoText: {
    fontSize: 13,
    color: "#0b63d6",
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    marginTop: 8,
  },
  calculatingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "#f0f7ff",
    padding: 8,
    borderRadius: 6,
    width: "100%",
  },
  calculatingText: {
    fontSize: 13,
    color: "#0b63d6",
    marginLeft: 8,
    fontWeight: "500",
  },
  btn: {
    marginTop: 12,
    backgroundColor: "#0b63d6",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    alignSelf: "stretch",
    alignItems: "center",
  },
  btnDisabled: {
    backgroundColor: "#a0c4e8",
  },
  btnText: { 
    color: "#fff", 
    fontWeight: "600",
    fontSize: 14,
  },
});