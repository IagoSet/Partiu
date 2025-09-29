Resumo

Este projeto (Expo / React Native) carrega paradas de ônibus do OpenStreetMap (via Overpass API) e exibe no mapa usando tiles do Carto (base OSM). Esta versão é uma tela única: mapa + marcadores (bolinha cinza).

Pré-requisitos

Node.js (recomendo >=16)

npm ou yarn

Expo CLI (global):

npm install -g expo-cli


Celular com Expo Go instalado (Android ou iOS) ou emulador Android/iOS configurado.

Passos para rodar (clone → rodar)

Clone o repositório:

git clone (https://github.com/IagoSet/Partiu)
cd Partiu


Instale dependências:

npm install
# ou
yarn install


Inicie o servidor do Expo:

expo start


Abra o projeto no seu celular:

Abra o app Expo Go e escaneie o QR code exibido no terminal/na página do Expo.

Ou use um emulador (clicando em “Run on Android device/emulator” ou “Run on iOS simulator” na interface do Expo).

Pronto — o app deve abrir e carregar as paradas do Plano Piloto.

Arquivos importantes

App.js — tela principal (mapa + query Overpass + markers).

package.json — dependências (expo, react-native-maps, etc.).

README.md — este arquivo.

Como o app funciona (curto)

Paradas: buscadas via Overpass API usando uma bounding box do Plano Piloto.

Mapa: tiles carregados da Carto via UrlTile.

Marcadores: são Marker com um View custom (bolinha cinza).

Trocar provedor de tiles (se necessário)

Se quiser usar outro provedor (ex.: Maptiler com chave), edite o componente UrlTile em App.js.
Exemplo Maptiler:

<UrlTile
  urlTemplate="https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=SUA_CHAVE_AQUI"
  maximumZ={19}
/>


Se usar Maptiler coloque a chave em .env (não commit) e carregue com expo-constants/react-native-dotenv.

Ajustes úteis

Aumentar a área de busca: ajuste SEARCH_RADIUS_METERS ou a BBOX em App.js.

Se quiser diferenciar tipos (highway=bus_stop vs public_transport=platform), a query Overpass já retorna tags — você pode usar tags para colorir marcadores diferentes.

Para implementar busca por nome, adicione um TextInput e filtre o array stops.

Problemas comuns & soluções

Tiles não carregam / 403: provedor OSM oficial bloqueia apps. Troque para Carto/Maptiler ou outro provedor autorizado.

Overpass retorna erro / rate limited: aguarde alguns segundos e tente novamente; Overpass aplica limites. Em produção rode seu próprio endpoint Overpass ou faça caching.

Expo não abre no celular: verifique se celular e computador estão na mesma rede Wi‑Fi (ou use conexão via tunnel pelo Expo).

Cache/bugs no metro bundler: reinicie com:

expo start -c

Boas práticas para produção

Não usar servidores públicos de tiles/OSM em escala; obtenha plano comercial ou hospede seu próprio tile server.

Para rotas (direções) não use o servidor demo do OSRM em produção — hospede seu próprio ou use serviço pago.

Cache local dos dados OSM para reduzir chamadas à Overpass.

Licença e atribuições

Dados de mapas: © OpenStreetMap contributors.

Overpass API: utilizado para consultas OSM.

Basemap usado: Carto basemaps.
Licença do código: MIT (sinta-se livre para adaptar).
