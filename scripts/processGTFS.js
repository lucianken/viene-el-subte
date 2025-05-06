const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const _ = require('lodash');

// Rutas de los archivos
const GTFS_DIR = path.join(__dirname, '../gtfs');
const OUTPUT_DIR = path.join(__dirname, '../public/data');

// Asegurar que el directorio de salida existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Función para leer y parsear un archivo CSV
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`Archivo no encontrado: ${filePath}`);
        return resolve([]);
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors && results.errors.length > 0) {
            console.warn(`Advertencias al parsear ${filePath}:`, results.errors);
          }
          resolve(results.data);
        },
        error: (error) => reject(error)
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Procesar stops.txt
async function processStops() {
  console.log('Procesando paradas...');
  const stopsPath = path.join(GTFS_DIR, 'stops.txt');
  const stops = await parseCSV(stopsPath);
  
  // Filtrar solo las paradas reales (no nodos de conexión)
  const realStops = stops.filter(stop => 
    !stop.location_type || stop.location_type === '0' || stop.location_type === ''
  );
  
  // Guardar todas las paradas
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'stops.json'),
    JSON.stringify(realStops, null, 2)
  );
  
  console.log(`✅ Se procesaron ${realStops.length} paradas`);
  return realStops;
}

// Procesar routes.txt
async function processRoutes() {
  console.log('Procesando líneas...');
  const routesPath = path.join(GTFS_DIR, 'routes.txt');
  const routes = await parseCSV(routesPath);
  
  // Guardar todas las rutas
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'routes.json'),
    JSON.stringify(routes, null, 2)
  );
  
  console.log(`✅ Se procesaron ${routes.length} líneas`);
  return routes;
}

// Procesar pathways.txt
async function processPathways() {
  console.log('Procesando conexiones...');
  const pathwaysPath = path.join(GTFS_DIR, 'pathways.txt');
  
  try {
    const pathways = await parseCSV(pathwaysPath);
    
    // Guardar todos los caminos
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'pathways.json'),
      JSON.stringify(pathways, null, 2)
    );
    
    console.log(`✅ Se procesaron ${pathways.length} conexiones`);
    return pathways;
  } catch (error) {
    console.warn('No se pudo procesar pathways.txt:', error.message);
    return [];
  }
}

// Procesar trips.txt
async function processTrips() {
  console.log('Procesando viajes...');
  const tripsPath = path.join(GTFS_DIR, 'trips.txt');
  const trips = await parseCSV(tripsPath);
  
  // Guardar todos los viajes
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'trips.json'),
    JSON.stringify(trips, null, 2)
  );
  
  console.log(`✅ Se procesaron ${trips.length} viajes`);
  return trips;
}

// Procesar stop_times.txt para el MVP completo
async function processStopTimes() {
  const stopTimesPath = path.join(GTFS_DIR, 'stop_times.txt');
  
  if (!fs.existsSync(stopTimesPath)) {
    console.log('⚠️ No se encontró el archivo stop_times.txt');
    return [];
  }
  
  console.log('Procesando horarios de paradas (esto puede tardar)...');
  
  // Procesar línea por línea para manejar archivos grandes
  const readline = require('readline');
  const stream = fs.createReadStream(stopTimesPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream });
  
  return new Promise((resolve, reject) => {
    let isFirstLine = true;
    let headers = [];
    let stopTimes = [];
    let lineCount = 0;
    
    rl.on('line', (line) => {
      if (isFirstLine) {
        headers = line.split(',').map(h => h.trim());
        isFirstLine = false;
        return;
      }
      
      const values = line.split(',').map(v => v.trim());
      const entry = {};
      
      headers.forEach((header, index) => {
        if (index < values.length) {
          entry[header] = values[index];
        }
      });
      
      stopTimes.push(entry);
      lineCount++;
      
      if (lineCount % 100000 === 0) {
        console.log(`Procesadas ${lineCount} líneas de stop_times.txt`);
      }
    });
    
    rl.on('close', () => {
      // Guardar todos los horarios
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'stop_times.json'),
        JSON.stringify(stopTimes, null, 2)
      );
      
      console.log(`✅ Se procesaron ${lineCount} líneas de stop_times.txt`);
      resolve(stopTimes);
    });
    
    rl.on('error', (err) => {
      reject(err);
    });
  });
}

// Crear estructuras optimizadas para consultas rápidas
async function createOptimizedStructures(stops, routes, trips) {
  console.log('Creando estructuras optimizadas completas...');
  
  const stopTimesPath = path.join(GTFS_DIR, 'stop_times.txt');
  
  if (!fs.existsSync(stopTimesPath)) {
    console.log('⚠️ No se puede crear el mapa sin stop_times.txt');
    return;
  }
  
  // Crear un mapa de trip_id a route_id
  const tripToRoute = {};
  trips.forEach(trip => {
    tripToRoute[trip.trip_id] = trip.route_id;
  });
  
  // Estructuras para almacenar los mapeos
  const stopToRoutes = {};
  const tripStops = {};
  
  // Procesar línea por línea
  const readline = require('readline');
  const stream = fs.createReadStream(stopTimesPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream });
  
  return new Promise((resolve, reject) => {
    let isFirstLine = true;
    let headers = [];
    let lineCount = 0;
    
    rl.on('line', (line) => {
      if (isFirstLine) {
        headers = line.split(',').map(h => h.trim());
        isFirstLine = false;
        return;
      }
      
      const values = line.split(',').map(v => v.trim());
      const entry = {};
      
      headers.forEach((header, index) => {
        if (index < values.length) {
          entry[header] = values[index];
        }
      });
      
      // Procesar la entrada para stop_to_routes
      const stopId = entry.stop_id;
      const tripId = entry.trip_id;
      const routeId = tripToRoute[tripId];
      const stopSequence = parseInt(entry.stop_sequence, 10);
      
      if (stopId && routeId) {
        if (!stopToRoutes[stopId]) {
          stopToRoutes[stopId] = new Set();
        }
        stopToRoutes[stopId].add(routeId);
      }
      
      // Procesar la entrada para route_to_stops
      if (tripId && stopId && !isNaN(stopSequence)) {
        if (!tripStops[tripId]) {
          tripStops[tripId] = [];
        }
        
        tripStops[tripId].push({
          stopId,
          stopSequence
        });
      }
      
      lineCount++;
      
      if (lineCount % 100000 === 0) {
        console.log(`Procesadas ${lineCount} líneas para estructuras optimizadas`);
      }
    });
    
    rl.on('close', () => {
      // Convertir los Sets a arrays para stop_to_routes
      const stopRoutesMap = {};
      Object.keys(stopToRoutes).forEach(stopId => {
        stopRoutesMap[stopId] = Array.from(stopToRoutes[stopId]);
      });
      
      // Guardar stop_to_routes
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'stop_to_routes.json'),
        JSON.stringify(stopRoutesMap, null, 2)
      );
      
      console.log(`✅ Se creó el mapa de ${Object.keys(stopRoutesMap).length} paradas a líneas`);
      
      // Procesar route_to_stops
      // Ordenar las paradas de cada viaje por secuencia
      Object.keys(tripStops).forEach(tripId => {
        tripStops[tripId].sort((a, b) => a.stopSequence - b.stopSequence);
      });
      
      // Agrupar por route_id y seleccionar un viaje representativo para cada dirección
      const routeToStops = {};
      
      routes.forEach(route => {
        const routeId = route.route_id;
        const routeTrips = trips.filter(trip => trip.route_id === routeId);
        
        if (routeTrips.length > 0) {
          // Agrupar por dirección (0 y 1)
          const tripsByDirection = _.groupBy(routeTrips, 'direction_id');
          
          // Para cada dirección, seleccionar un viaje representativo
          Object.keys(tripsByDirection).forEach(directionId => {
            const directionTrips = tripsByDirection[directionId];
            if (directionTrips.length > 0) {
              const repTripId = directionTrips[0].trip_id;
              const repTripStops = tripStops[repTripId] || [];
              
              // Clave combinada para dirección
              const directionKey = `${routeId}_${directionId}`;
              
              // Estructura con ID de parada y su nombre
              const stopsWithNames = repTripStops
                .map(stop => {
                  const stopData = stops.find(s => s.stop_id === stop.stopId);
                  return {
                    stopId: stop.stopId,
                    stopName: stopData ? stopData.stop_name : `Parada ${stop.stopId}`,
                    sequence: stop.stopSequence
                  };
                });
              
              routeToStops[directionKey] = stopsWithNames;
            }
          });
        } else {
          routeToStops[`${routeId}_0`] = [];
          routeToStops[`${routeId}_1`] = [];
        }
      });
      
      // Guardar route_to_stops con direcciones
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'route_to_stops.json'),
        JSON.stringify(routeToStops, null, 2)
      );
      
      console.log(`✅ Se creó el mapa de rutas a paradas con direcciones`);
      
      // Estructura adicional: Nombre de paradas por ID
      const stopNames = {};
      stops.forEach(stop => {
        stopNames[stop.stop_id] = stop.stop_name;
      });
      
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'stop_names.json'),
        JSON.stringify(stopNames, null, 2)
      );
      
      console.log(`✅ Se creó el mapa de nombres de paradas`);
      
      // Estructura adicional: Info de rutas (nombre corto, color)
      const routeInfo = {};
      routes.forEach(route => {
        routeInfo[route.route_id] = {
          shortName: route.route_short_name,
          longName: route.route_long_name,
          color: route.route_color || 'CCCCCC',
          textColor: route.route_text_color || '000000'
        };
      });
      
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'route_info.json'),
        JSON.stringify(routeInfo, null, 2)
      );
      
      console.log(`✅ Se creó el mapa de información de rutas`);
      
      resolve();
    });
    
    rl.on('error', (err) => {
      reject(err);
    });
  });
}

// Ejecutar todo el procesamiento
async function main() {
  try {
    console.log(`📊 Iniciando procesamiento de archivos GTFS desde: ${GTFS_DIR}`);
    console.log(`📂 Los archivos JSON se guardarán en: ${OUTPUT_DIR}`);
    console.log('-------------------------------------------------------');
    
    const stops = await processStops();
    const routes = await processRoutes();
    const pathways = await processPathways();
    const trips = await processTrips();
    await processStopTimes();
    
    await createOptimizedStructures(stops, routes, trips);
    
    console.log('-------------------------------------------------------');
    console.log('✅ Procesamiento completado con éxito');
    console.log('Los datos están listos para ser utilizados en la aplicación');
  } catch (error) {
    console.error('❌ Error durante el procesamiento:', error);
  }
}

// Ejecutar el script
main();