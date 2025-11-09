# Partiu - Sistema de Rotas de Ônibus

Aplicativo React Native/Expo que calcula rotas otimizadas entre paradas de ônibus usando **algoritmo de Dijkstra** implementado manualmente. Os dados são obtidos do OpenStreetMap e as rotas seguem as ruas reais usando OSRM.

## 🎯 Características

- ✅ **Algoritmo de Dijkstra** implementado do zero (sem bibliotecas externas)
- 🗺️ Visualização de paradas de ônibus em mapa interativo
- 🚏 Cálculo de rotas otimizadas entre paradas
- 🛣️ Rotas seguem ruas reais (geometria via OSRM)
- 📊 Informações detalhadas: distância, tempo estimado e número de paradas

## 📋 Pré-requisitos

- **Node.js** ≥ 16
- **npm** ou **yarn**
- **Expo CLI**: `npm install -g expo-cli`
- **Expo Go** no celular (Android/iOS) ou emulador configurado

## 🚀 Instalação e Execução

```bash
# 1. Clone o repositório
git clone https://github.com/IagoSet/Partiu
cd Partiu

# 2. Instale as dependências
npm install
# ou
yarn install

# 3. Inicie o servidor Expo
npx expo start

# 4. Abra no celular
# Escaneie o QR code com o app Expo Go
# ou use os atalhos para emulador (a = Android, i = iOS)
```

## 📁 Estrutura do Projeto

```
Partiu/
├── App.js                    # Componente principal (UI + lógica do mapa)
├── GraphRouterDynamic.js     # Implementação do Dijkstra + integração OSRM
├── package.json              # Dependências do projeto
└── README.md                 # Documentação
```

## 🔧 Como Funciona

### 1. **Carregamento de Paradas**
- Busca paradas via **Overpass API** (OpenStreetMap)
- Área: Plano Piloto, Brasília (bounding box configurável)
- Filtra `highway=bus_stop` e `public_transport=platform`

### 2. **Construção do Grafo**
- Cada parada é um **nó** do grafo
- Conecta cada parada às **8 mais próximas** (configurável)
- Pesos calculados com **distância Haversine** (fórmula matemática)

### 3. **Algoritmo de Dijkstra**
```javascript
// Implementação manual em GraphRouterDynamic.js
function dijkstra(graph, startNodeId, endNodeId) {
  // 1. Inicializa distâncias (origem = 0, demais = ∞)
  // 2. Loop: seleciona nó não visitado com menor distância
  // 3. Relaxamento: atualiza distâncias dos vizinhos
  // 4. Reconstrói caminho ótimo usando array 'previous'
}
```

### 4. **Visualização da Rota**
- **Dijkstra** encontra sequência ótima de paradas
- **OSRM** busca geometria das ruas entre cada par de paradas
- Combina segmentos em uma polyline contínua

## 🎮 Como Usar o App

1. **Aguarde carregar** as paradas de ônibus
2. **Toque em uma parada** (pin azul) para definir **origem** (fica verde 🟢)
3. **Toque em outra parada** para definir **destino** (fica vermelho 🔴)
4. **Aguarde o cálculo** — a rota aparecerá seguindo as ruas
5. **Veja informações**: distância, tempo estimado e número de paradas
6. **Botão "Limpar rota"** para recomeçar

## ⚙️ Configurações Disponíveis

### Ajustar área de busca
```javascript
// App.js - Bounding Box do Plano Piloto
const BBOX = {
  south: -15.8808,
  west: -48.1064,
  north: -15.5662,
  east: -47.7493,
};
```

### Otimizar desempenho do Dijkstra
```javascript
// App.js - fetchRoute()
const result = await calculateStopRoute(stops, start.id, end.id, {
  maxNeighbors: 8,           // Mais vizinhos = grafo mais denso
  delayBetweenRequests: 150  // Delay entre chamadas OSRM (ms)
});
```

### Trocar provedor de tiles
```javascript
// App.js - MapView
<UrlTile
  urlTemplate="https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=SUA_CHAVE"
  maximumZ={19}
/>
```

## 🐛 Problemas Comuns

| Problema | Solução |
|----------|---------|
| **Tiles não carregam** | Use Carto/Maptiler (OSM oficial bloqueia apps) |
| **Overpass erro 429** | Rate limit — aguarde ou use instância própria |
| **Rota não calcula** | Verifique console — pode ser paradas muito distantes |
| **Expo não conecta** | Celular e PC na mesma rede Wi-Fi |
| **Cache/bugs** | `expo start -c` para limpar cache |

## 📚 Para Apresentação Acadêmica

### Pontos-chave para explicar ao professor:

✅ **Dijkstra implementado manualmente** (linha 15-70 de `GraphRouterDynamic.js`)
- Sem bibliotecas externas de grafos
- Estruturas de dados: objetos JS para adjacência, Set para não visitados
- Complexidade: O(V²) — pode ser otimizado com heap binário

✅ **Grafo dinâmico**
- Nós: paradas de ônibus (dados reais do OSM)
- Arestas: conexões entre paradas próximas
- Pesos: distância Haversine (métrica geográfica)

✅ **OSRM é apenas visualização**
- Dijkstra calcula o caminho ótimo
- OSRM fornece geometria para desenhar nas ruas
- Não interfere na lógica do algoritmo

### Possíveis melhorias (para discussão):
- Implementar fila de prioridade (heap) para Dijkstra O(E log V)
- Adicionar heurística (A* em vez de Dijkstra)
- Considerar tempo real de ônibus (não só distância)
- Grafos direcionados (ruas de mão única)

## 🚨 Limitações e Produção

⚠️ **Este projeto usa servidores públicos gratuitos:**

- **Overpass API**: limite de requisições — em produção, hospede próprio ou use cache
- **OSRM público**: limite de uso — para produção, hospede servidor próprio
- **Tiles Carto**: verificar termos de uso para apps comerciais

### Alternativas para produção:
- **Roteamento**: Google Directions API, Mapbox Directions, GraphHopper
- **Tiles**: Maptiler, Mapbox, Google Maps
- **Dados OSM**: cache local ou banco de dados espacial (PostGIS)

## 📄 Licença e Atribuições

- **Código**: MIT License
- **Dados de mapas**: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- **Tiles**: [Carto basemaps](https://carto.com/basemaps/)
- **Roteamento**: [OSRM](http://project-osrm.org/)

## 🤝 Contribuindo

```bash
# Fork o projeto
# Crie uma branch: git checkout -b feature/nova-funcionalidade
# Commit: git commit -m 'Adiciona nova funcionalidade'
# Push: git push origin feature/nova-funcionalidade
# Abra um Pull Request
```

## 📞 Suporte

Para dúvidas sobre Teoria de Grafos ou implementação do Dijkstra, verifique os comentários no código ou consulte:
- [Dijkstra's Algorithm - Wikipedia](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm)
- [Graph Theory Playlist](https://www.youtube.com/watch?v=09_LlHjoEiY)

---

**Feito com 💙 para Teoria de Grafos** | [Repositório GitHub](https://github.com/IagoSet/Partiu)
