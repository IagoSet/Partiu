// GraphRouterDynamic.js - Versão OTIMIZADA com Cache Persistente
import AsyncStorage from '@react-native-async-storage/async-storage';

const OSRM_API = "https://router.project-osrm.org/route/v1/driving";
const GRAPH_CACHE_KEY = '@graph_cache_v1';

// Cache para armazenar geometrias já calculadas
const routeCache = new Map();
const distanceCache = new Map();

// Função para calcular distância Haversine (em metros)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Implementação do algoritmo de Dijkstra
function dijkstra(graph, startNodeId, endNodeId) {
  const distances = {};
  const previous = {};
  const unvisited = new Set(Object.keys(graph));

  for (const nodeId in graph) {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
  }
  distances[startNodeId] = 0;

  while (unvisited.size > 0) {
    let currentNodeId = null;
    let minDistance = Infinity;

    for (const nodeId of unvisited) {
      if (distances[nodeId] < minDistance) {
        minDistance = distances[nodeId];
        currentNodeId = nodeId;
      }
    }

    if (currentNodeId === null || minDistance === Infinity) {
      console.warn("Dijkstra: Nenhum caminho encontrado");
      break;
    }
    
    if (currentNodeId === endNodeId) break;

    unvisited.delete(currentNodeId);

    const neighbors = graph[currentNodeId] || {};
    for (const neighborId in neighbors) {
      if (unvisited.has(neighborId)) {
        const weight = neighbors[neighborId];
        const newDistance = distances[currentNodeId] + weight;

        if (newDistance < distances[neighborId]) {
          distances[neighborId] = newDistance;
          previous[neighborId] = currentNodeId;
        }
      }
    }
  }

  const path = [];
  let current = endNodeId;
  
  while (current) {
    path.unshift(current);
    current = previous[current];
  }

  if (path.length > 0 && path[0] === startNodeId) {
    return path;
  }
  
  return [];
}

// Função para buscar distância real de rua via OSRM (com cache)
async function getRealStreetDistance(stopA, stopB) {
  const cacheKey = `${stopA.id}-${stopB.id}`;
  
  if (distanceCache.has(cacheKey)) {
    return distanceCache.get(cacheKey);
  }

  const url = `${OSRM_API}/${stopA.lon},${stopA.lat};${stopB.lon},${stopB.lat}?overview=false`;
  
  try {
    const res = await fetch(url);
    const json = await res.json();

    if (json.routes && json.routes.length > 0) {
      const distance = json.routes[0].distance;
      distanceCache.set(cacheKey, distance);
      distanceCache.set(`${stopB.id}-${stopA.id}`, distance);
      return distance;
    }
    return Infinity;
  } catch (error) {
    return Infinity;
  }
}

// 🔥 NOVO: Carrega grafo do cache
async function loadGraphFromCache() {
  try {
    const cached = await AsyncStorage.getItem(GRAPH_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      console.log(`✅ Grafo carregado do cache (${Object.keys(parsed.graph).length} paradas)`);
      return parsed;
    }
  } catch (error) {
    console.warn("Erro ao carregar cache:", error);
  }
  return null;
}

// 🔥 NOVO: Salva grafo no cache
async function saveGraphToCache(graph, stopsHash) {
  try {
    await AsyncStorage.setItem(GRAPH_CACHE_KEY, JSON.stringify({
      graph,
      stopsHash,
      timestamp: Date.now()
    }));
    console.log("✅ Grafo salvo no cache");
  } catch (error) {
    console.warn("Erro ao salvar cache:", error);
  }
}

// 🔥 NOVO: Gera hash das paradas para validar cache
function generateStopsHash(stops) {
  const ids = stops.map(s => s.id).sort().join(',');
  return ids.substring(0, 100); // Hash simples
}

// Constrói o grafo usando distâncias REAIS de rua (COM CACHE!)
async function buildStopGraphWithRealDistances(stops, maxNeighbors = 12) {
  const stopsHash = generateStopsHash(stops);
  
  // 🔥 Tenta carregar do cache primeiro
  const cached = await loadGraphFromCache();
  if (cached && cached.stopsHash === stopsHash) {
    console.log("🚀 Usando grafo em cache!");
    return cached.graph;
  }
  
  console.log(`⏳ Construindo grafo com distâncias reais de ${stops.length} paradas...`);
  console.log("⚠️  Isso pode demorar alguns minutos na primeira vez...");

  const graph = {};
  
  // Inicializa o grafo
  stops.forEach(stop => {
    graph[stop.id] = {};
  });

  // Para cada parada, encontra as N mais próximas em linha reta
  const nearestNeighbors = {};
  stops.forEach((stopA) => {
    const distances = [];
    
    stops.forEach(stopB => {
      if (stopA.id !== stopB.id) {
        const dist = haversineDistance(stopA.lat, stopA.lon, stopB.lat, stopB.lon);
        if (dist <= 1500) {
          distances.push({ stop: stopB, straightDist: dist });
        }
      }
    });

    distances.sort((a, b) => a.straightDist - b.straightDist);
    nearestNeighbors[stopA.id] = distances.slice(0, maxNeighbors);
  });

  // Busca distâncias reais de rua para os vizinhos identificados
  let processed = 0;
  const total = Object.keys(nearestNeighbors).length;
  
  for (const stopAId in nearestNeighbors) {
    const stopA = stops.find(s => s.id === stopAId);
    const neighbors = nearestNeighbors[stopAId];
    
    // Processa em lotes de 5 (otimizado!)
    for (let i = 0; i < neighbors.length; i += 5) {
      const batch = neighbors.slice(i, i + 5);
      
      await Promise.all(
        batch.map(async ({ stop: stopB }) => {
          const realDist = await getRealStreetDistance(stopA, stopB);
          
          if (realDist !== Infinity) {
            graph[stopA.id][stopB.id] = realDist;
            if (!graph[stopB.id]) graph[stopB.id] = {};
            graph[stopB.id][stopA.id] = realDist;
          }
        })
      );
      
      // Delay menor (50ms em vez de 100ms)
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    processed++;
    if (processed % 10 === 0) {
      console.log(`⏳ Processadas ${processed}/${total} paradas (${Math.round(processed/total*100)}%)`);
    }
  }

  console.log("✅ Grafo construído com distâncias reais!");
  
  // 🔥 Salva no cache para próximas vezes
  await saveGraphToCache(graph, stopsHash);
  
  return graph;
}

// Constrói o grafo conectando cada parada às N mais próximas (com Haversine)
function buildStopGraphHaversine(stops, maxNeighbors = 12) {
  const graph = {};
  
  console.log(`Construindo grafo com ${stops.length} paradas...`);

  stops.forEach(stop => {
    graph[stop.id] = {};
  });

  stops.forEach((stopA, index) => {
    const distances = [];
    
    stops.forEach(stopB => {
      if (stopA.id !== stopB.id) {
        const dist = haversineDistance(stopA.lat, stopA.lon, stopB.lat, stopB.lon);
        if (dist <= 1500) {
          distances.push({ id: stopB.id, dist });
        }
      }
    });

    distances.sort((a, b) => a.dist - b.dist);
    const nearest = distances.slice(0, maxNeighbors);

    nearest.forEach(neighbor => {
      graph[stopA.id][neighbor.id] = neighbor.dist;
      if (!graph[neighbor.id]) graph[neighbor.id] = {};
      if (!graph[neighbor.id][stopA.id]) {
        graph[neighbor.id][stopA.id] = neighbor.dist;
      }
    });

    if ((index + 1) % 50 === 0) {
      console.log(`Processadas ${index + 1}/${stops.length} paradas`);
    }
  });

  console.log("Grafo construído com sucesso!");
  return graph;
}

// Função para buscar geometria de rota do OSRM entre dois pontos
async function getOSRMRouteGeometry(lon1, lat1, lon2, lat2) {
  const cacheKey = `${lon1.toFixed(5)},${lat1.toFixed(5)};${lon2.toFixed(5)},${lat2.toFixed(5)}`;
  
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  const url = `${OSRM_API}/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
  
  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error(`OSRM erro: ${res.status}`);
      return null;
    }
    
    const json = await res.json();

    if (json.routes && json.routes.length > 0) {
      const route = json.routes[0];
      
      const coords = route.geometry.coordinates.map(coord => ({
        latitude: coord[1],
        longitude: coord[0]
      }));
      
      const result = {
        coordinates: coords,
        distance: route.distance,
        duration: route.duration
      };
      
      routeCache.set(cacheKey, result);
      
      return result;
    }
    
    return null;
  } catch (error) {
    console.error("Erro ao buscar rota OSRM:", error);
    return null;
  }
}

// Função para buscar geometrias de rota em lote
async function fetchRouteSegments(stopPairs, delayMs = 150) {
  const segments = [];
  let totalDistance = 0;
  let totalDuration = 0;
  
  console.log(`Buscando ${stopPairs.length} segmentos de rota...`);
  
  for (let i = 0; i < stopPairs.length; i++) {
    const { stopA, stopB } = stopPairs[i];
    
    const routeData = await getOSRMRouteGeometry(
      stopA.lon, 
      stopA.lat, 
      stopB.lon, 
      stopB.lat
    );
    
    if (routeData && routeData.coordinates.length > 0) {
      const coords = i === 0 
        ? routeData.coordinates 
        : routeData.coordinates.slice(1);
      
      segments.push(...coords);
      totalDistance += routeData.distance;
      totalDuration += routeData.duration;
    } else {
      console.warn(`Falha no segmento ${i + 1}, usando linha reta`);
      if (i === 0) {
        segments.push({ latitude: stopA.lat, longitude: stopA.lon });
      }
      segments.push({ latitude: stopB.lat, longitude: stopB.lon });
    }
    
    if (i < stopPairs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return {
    coordinates: segments,
    totalDistance,
    totalDuration
  };
}

// Função principal de roteamento
export async function calculateStopRoute(stops, startStopId, endStopId, options = {}) {
  const { 
    maxNeighbors = 12, 
    delayBetweenRequests = 150,
    useRealDistances = true
  } = options;

  if (!stops || stops.length === 0) {
    console.error("Lista de paradas vazia.");
    return { coordinates: [], distance: 0, duration: 0, stopsCount: 0 };
  }

  console.log(`Calculando rota de ${startStopId} para ${endStopId}...`);

  try {
    // 1. Constrói o grafo (usa cache se disponível!)
    let graph;
    if (useRealDistances) {
      console.log("Construindo grafo com distâncias REAIS de rua...");
      graph = await buildStopGraphWithRealDistances(stops, maxNeighbors);
    } else {
      console.log("Construindo grafo com distâncias em linha reta...");
      graph = buildStopGraphHaversine(stops, maxNeighbors);
    }

    // 2. Executa Dijkstra
    const stopPathIds = dijkstra(graph, startStopId, endStopId);

    if (stopPathIds.length === 0) {
      console.warn(`Nenhuma rota encontrada entre ${startStopId} e ${endStopId}.`);
      return { coordinates: [], distance: 0, duration: 0, stopsCount: 0 };
    }

    console.log(`Rota encontrada com ${stopPathIds.length} paradas`);

    // 3. Mapeia IDs para objetos de parada
    const stopMap = stops.reduce((acc, stop) => {
      acc[stop.id] = stop;
      return acc;
    }, {});

    // 4. Cria pares de paradas consecutivas
    const stopPairs = [];
    for (let i = 0; i < stopPathIds.length - 1; i++) {
      stopPairs.push({
        stopA: stopMap[stopPathIds[i]],
        stopB: stopMap[stopPathIds[i + 1]]
      });
    }

    // 5. Busca geometrias de rota reais do OSRM
    console.log("Buscando rotas de rua no OSRM...");
    const routeData = await fetchRouteSegments(stopPairs, delayBetweenRequests);

    console.log(`Rota completa: ${routeData.coordinates.length} pontos, ${(routeData.totalDistance / 1000).toFixed(2)}km`);

    return {
      coordinates: routeData.coordinates,
      distance: routeData.totalDistance,
      duration: routeData.totalDuration,
      stopsCount: stopPathIds.length
    };

  } catch (error) {
    console.error("Erro ao calcular rota:", error);
    return { coordinates: [], distance: 0, duration: 0, stopsCount: 0 };
  }
}

// 🔥 NOVO: Função para limpar cache (útil para debugging)
export async function clearAllCaches() {
  routeCache.clear();
  distanceCache.clear();
  try {
    await AsyncStorage.removeItem(GRAPH_CACHE_KEY);
    console.log("✅ Todos os caches limpos");
  } catch (error) {
    console.warn("Erro ao limpar cache:", error);
  }
}