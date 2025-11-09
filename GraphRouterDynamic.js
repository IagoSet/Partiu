// GraphRouterDynamic.js - Versão com Rotas de Rua

const OSRM_API = "https://router.project-osrm.org/route/v1/driving";

// Cache para armazenar geometrias já calculadas
const routeCache = new Map();

// Função para calcular distância Haversine (em metros)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Raio da Terra em metros
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

  // Inicialização
  for (const nodeId in graph) {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
  }
  distances[startNodeId] = 0;

  while (unvisited.size > 0) {
    let currentNodeId = null;
    let minDistance = Infinity;

    // Encontra o nó não visitado com a menor distância
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

    // Atualiza as distâncias dos vizinhos
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

  // Reconstrói o caminho
  const path = [];
  let current = endNodeId;
  
  while (current) {
    path.unshift(current);
    current = previous[current];
  }

  // Verifica se o caminho é válido
  if (path.length > 0 && path[0] === startNodeId) {
    return path;
  }
  
  return [];
}

// Constrói o grafo conectando cada parada às N mais próximas
function buildStopGraphHaversine(stops, maxNeighbors = 8) {
  const graph = {};
  
  console.log(`Construindo grafo com ${stops.length} paradas...`);

  // Inicializa o grafo
  stops.forEach(stop => {
    graph[stop.id] = {};
  });

  // Para cada parada, encontra as N mais próximas
  stops.forEach((stopA, index) => {
    const distances = [];
    
    stops.forEach(stopB => {
      if (stopA.id !== stopB.id) {
        const dist = haversineDistance(stopA.lat, stopA.lon, stopB.lat, stopB.lon);
        distances.push({ id: stopB.id, dist });
      }
    });

    // Ordena por distância e pega as N mais próximas
    distances.sort((a, b) => a.dist - b.dist);
    const nearest = distances.slice(0, maxNeighbors);

    // Adiciona arestas bidirecionais
    nearest.forEach(neighbor => {
      graph[stopA.id][neighbor.id] = neighbor.dist;
      // Adiciona aresta reversa se ainda não existe
      if (!graph[neighbor.id][stopA.id]) {
        graph[neighbor.id][stopA.id] = neighbor.dist;
      }
    });

    // Log de progresso
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
  
  // Verifica cache
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
      
      // Converte coordenadas GeoJSON para formato do MapView
      const coords = route.geometry.coordinates.map(coord => ({
        latitude: coord[1],
        longitude: coord[0]
      }));
      
      const result = {
        coordinates: coords,
        distance: route.distance, // em metros
        duration: route.duration  // em segundos
      };
      
      // Armazena no cache
      routeCache.set(cacheKey, result);
      
      return result;
    }
    
    return null;
  } catch (error) {
    console.error("Erro ao buscar rota OSRM:", error);
    return null;
  }
}

// Função para buscar geometrias de rota em lote (com delay para evitar rate limit)
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
      // Remove o primeiro ponto do segmento (exceto no primeiro segmento)
      // para evitar duplicação nos pontos de conexão
      const coords = i === 0 
        ? routeData.coordinates 
        : routeData.coordinates.slice(1);
      
      segments.push(...coords);
      totalDistance += routeData.distance;
      totalDuration += routeData.duration;
      
      console.log(`Segmento ${i + 1}/${stopPairs.length} obtido (${coords.length} pontos)`);
    } else {
      // Fallback: linha reta se OSRM falhar
      console.warn(`Falha no segmento ${i + 1}, usando linha reta`);
      if (i === 0) {
        segments.push({ latitude: stopA.lat, longitude: stopA.lon });
      }
      segments.push({ latitude: stopB.lat, longitude: stopB.lon });
    }
    
    // Delay para evitar rate limiting (exceto na última iteração)
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
  const { maxNeighbors = 8, delayBetweenRequests = 150 } = options;

  if (!stops || stops.length === 0) {
    console.error("Lista de paradas vazia.");
    return { coordinates: [], distance: 0, duration: 0, stopsCount: 0 };
  }

  console.log(`Calculando rota de ${startStopId} para ${endStopId}...`);

  try {
    // 1. Constrói o grafo usando distância Haversine
    const graph = buildStopGraphHaversine(stops, maxNeighbors);

    // 2. Executa Dijkstra para encontrar sequência de paradas
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

// Função auxiliar para limpar o cache
export function clearRouteCache() {
  routeCache.clear();
  console.log("Cache de rotas limpo");
}