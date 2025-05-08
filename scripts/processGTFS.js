const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const _ = require('lodash');

// Rutas de los archivos
const GTFS_DIR = path.join(__dirname, '../gtfs'); // Asume que el script está en una carpeta 'scripts' por ejemplo
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
        return resolve([]); // Devolver array vacío si no existe
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: (header) => { // Intentar convertir números automáticamente
          return header === 'headway_secs' || header === 'exact_times';
        },
        complete: (results) => {
          if (results.errors && results.errors.length > 0) {
            console.warn(`Advertencias al parsear ${filePath}:`, results.errors);
          }
          // Validar que los tipos numéricos sean correctos después de dynamicTyping
          const validatedData = results.data.map(row => {
            const validatedRow = { ...row };
            if (validatedRow.headway_secs !== undefined && typeof validatedRow.headway_secs !== 'number') {
              const parsed = parseInt(validatedRow.headway_secs, 10);
              validatedRow.headway_secs = isNaN(parsed) ? undefined : parsed;
            }
            if (validatedRow.exact_times !== undefined && typeof validatedRow.exact_times !== 'number') {
                const parsed = parseInt(validatedRow.exact_times, 10);
                validatedRow.exact_times = isNaN(parsed) ? undefined : parsed;
            }
            return validatedRow;
          });
          resolve(validatedData);
        },
        error: (error) => reject(error)
      });
    } catch (error) {
      reject(new Error(`Error leyendo o parseando ${filePath}: ${error.message}`));
    }
  });
}

// Procesar stops.txt
async function processStops() {
  console.log('Procesando paradas...');
  const stopsPath = path.join(GTFS_DIR, 'stops.txt');
  const stops = await parseCSV(stopsPath);
  const realStops = stops.filter(stop => !stop.location_type || stop.location_type === '0' || stop.location_type === '');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'stops.json'), JSON.stringify(realStops, null, 2));
  console.log(`✅ Se procesaron ${realStops.length} paradas`);
  return realStops;
}

// Procesar routes.txt
async function processRoutes() {
  console.log('Procesando líneas...');
  const routesPath = path.join(GTFS_DIR, 'routes.txt');
  const routes = await parseCSV(routesPath);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'routes.json'), JSON.stringify(routes, null, 2));
  console.log(`✅ Se procesaron ${routes.length} líneas`);
  return routes;
}

// Procesar pathways.txt
async function processPathways() {
  console.log('Procesando conexiones...');
  const pathwaysPath = path.join(GTFS_DIR, 'pathways.txt');
  try {
    const pathways = await parseCSV(pathwaysPath);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'pathways.json'), JSON.stringify(pathways, null, 2));
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
  fs.writeFileSync(path.join(OUTPUT_DIR, 'trips.json'), JSON.stringify(trips, null, 2));
  console.log(`✅ Se procesaron ${trips.length} viajes`);
  return trips;
}

// *** NUEVA FUNCIÓN para frequencies.txt ***
async function processFrequencies() {
  console.log('Procesando frecuencias...');
  const frequenciesPath = path.join(GTFS_DIR, 'frequencies.txt');
  try {
    const frequencies = await parseCSV(frequenciesPath);
    // Los datos ya deberían tener headway_secs y exact_times como números
    // gracias a dynamicTyping y la validación en parseCSV
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'frequencies.json'),
      JSON.stringify(frequencies, null, 2)
    );
    console.log(`✅ Se procesaron ${frequencies.length} registros de frecuencia`);
    return frequencies;
  } catch (error) {
    console.error('❌ Error procesando frequencies.txt:', error.message);
    // Puedes decidir si continuar o detener el script si este archivo es crucial
    return []; // Devolver vacío para no detener todo el script
  }
}
// *** FIN NUEVA FUNCIÓN ***


// Procesar stop_times.txt (sin cambios, pero adaptado para usar la función parseCSV si se quisiera simplificar, aunque el stream es mejor para archivos grandes)
async function processStopTimes() {
    const stopTimesPath = path.join(GTFS_DIR, 'stop_times.txt');
    if (!fs.existsSync(stopTimesPath)) { console.log('⚠️ No se encontró el archivo stop_times.txt'); return []; }
    console.log('Procesando horarios de paradas (esto puede tardar)...');
    const readline = require('readline');
    const stream = fs.createReadStream(stopTimesPath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream });
    return new Promise((resolve, reject) => {
      let isFirstLine = true; let headers = []; let stopTimes = []; let lineCount = 0;
      rl.on('line', (line) => {
        if (isFirstLine) { headers = line.split(',').map(h => h.trim()); isFirstLine = false; return; }
        const values = line.split(',').map(v => v.trim()); const entry = {};
        headers.forEach((header, index) => { if (index < values.length) { entry[header] = values[index]; } });
        stopTimes.push(entry); lineCount++;
        if (lineCount % 100000 === 0) { console.log(`Procesadas ${lineCount} líneas de stop_times.txt`); }
      });
      rl.on('close', () => {
        fs.writeFileSync(path.join(OUTPUT_DIR, 'stop_times.json'), JSON.stringify(stopTimes, null, 2));
        console.log(`✅ Se procesaron ${lineCount} líneas de stop_times.txt`); resolve(stopTimes);
      });
      rl.on('error', (err) => { reject(err); });
    });
}

// Crear estructuras optimizadas para consultas rápidas (sin cambios)
async function createOptimizedStructures(stops, routes, trips) { /* ... tu lógica existente ... */ }

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
    await processFrequencies(); // *** LLAMADA A LA NUEVA FUNCIÓN ***
    
    await createOptimizedStructures(stops, routes, trips); // Pasar datos necesarios si la función los usa
    
    console.log('-------------------------------------------------------');
    console.log('✅ Procesamiento completado con éxito');
    console.log('Los datos están listos para ser utilizados en la aplicación');
  } catch (error) {
    console.error('❌ Error durante el procesamiento:', error);
  }
}

// Ejecutar el script
main();