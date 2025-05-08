const fs = require('fs');
const path = require('path');

// Función para convertir HH:MM:SS a segundos totales desde la medianoche
function timeToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
        console.warn(`Tiempo inválido o ausente: ${timeStr}, devolviendo 0 segundos.`);
        return 0; // O podrías lanzar un error o devolver NaN
    }
    const parts = timeStr.split(':');
    if (parts.length !== 3) {
        console.warn(`Formato de tiempo inválido: ${timeStr}, devolviendo 0 segundos.`);
        return 0; // O manejar el error de otra forma
    }
    const [hours, minutes, seconds] = parts.map(Number);
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
        console.warn(`Componente de tiempo no numérico en: ${timeStr}, devolviendo 0 segundos.`);
        return 0;
    }
    return hours * 3600 + minutes * 60 + seconds;
}

// Función para obtener la línea del trip_id (A, B, ..., H, P1, P2)
function getLineFromTripId(tripId) {
    if (tripId.startsWith('P1')) return 'P1';
    if (tripId.startsWith('P2')) return 'P2';
    return tripId.charAt(0); // Asume que los otros son A, B, C, D, E, H
}

async function processStopTimes(filePath) {
    console.log(`Leyendo archivo: ${filePath}`);
    let stopTimesData;
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        stopTimesData = JSON.parse(rawData);
    } catch (error) {
        console.error(`Error al leer o parsear el archivo JSON: ${error.message}`);
        return null;
    }

    console.log(`Total de entradas de stoptimes: ${stopTimesData.length}`);

    // 1. Agrupar paradas por trip_id
    const trips = {};
    stopTimesData.forEach(stopTime => {
        if (!trips[stopTime.trip_id]) {
            trips[stopTime.trip_id] = [];
        }
        // Convertir stop_sequence a número para asegurar orden correcto
        stopTime.stop_sequence = parseInt(stopTime.stop_sequence, 10);
        trips[stopTime.trip_id].push(stopTime);
    });

    // 2. Ordenar paradas dentro de cada trip por stop_sequence
    for (const tripId in trips) {
        trips[tripId].sort((a, b) => a.stop_sequence - b.stop_sequence);
    }

    // 3. Calcular duraciones para cada trip individual
    const individualTripDurations = {};
    for (const tripId in trips) {
        const stops = trips[tripId];
        individualTripDurations[tripId] = [];
        for (let i = 1; i < stops.length; i++) {
            const prevStop = stops[i - 1];
            const currentStop = stops[i];

            const prevDepartureSeconds = timeToSeconds(prevStop.departure_time);
            const currentArrivalSeconds = timeToSeconds(currentStop.arrival_time);

            let duration = currentArrivalSeconds - prevDepartureSeconds;

            // Manejo de cruce de medianoche o tiempos inconsistentes (ej. llega antes de salir)
            // Para este problema, asumimos que no hay cruces de medianoche complejos entre paradas consecutivas.
            // Si la duración es negativa, podría indicar un problema de datos o que el viaje cruza la medianoche
            // y los tiempos no están representados como >24:00:00.
            // Por la descripción, el problema es "cuánto se tarda entre estaciones", así que una duración negativa es un error.
            if (duration < 0) {
                console.warn(`Duración negativa detectada para trip ${tripId} entre ${prevStop.stop_id} (sale ${prevStop.departure_time}) y ${currentStop.stop_id} (llega ${currentStop.arrival_time}). Duración: ${duration}s. Se usará 0.`);
                // Podrías decidir ignorar este segmento, usar Math.abs(duration), o como en este caso, usar 0.
                // Si los tiempos son realmente 23:59:00 -> 00:01:00, la lógica sería más compleja.
                // Dada la info "todos arrancan a las 12", esto es probablemente un error de datos.
                duration = 0; 
            }

            individualTripDurations[tripId].push({
                from_stop_id: prevStop.stop_id,
                from_stop_sequence: prevStop.stop_sequence,
                to_stop_id: currentStop.stop_id,
                to_stop_sequence: currentStop.stop_sequence,
                // Opcional: incluir tiempos originales para depuración
                // prev_departure_time: prevStop.departure_time,
                // current_arrival_time: currentStop.arrival_time,
                duration_seconds: duration
            });
        }
    }

    // 4. Calcular promedios por línea
    const lineSegmentAggregates = {}; // { "LINEA": { "FROM_TO": { totalDuration: X, count: Y, from_id: Z, to_id: W } } }
    for (const tripId in individualTripDurations) {
        const line = getLineFromTripId(tripId);
        if (!lineSegmentAggregates[line]) {
            lineSegmentAggregates[line] = {};
        }

        individualTripDurations[tripId].forEach(segment => {
            // Usamos stop_sequence para definir un segmento de manera más robusta si los stop_id pudieran repetirse en contextos diferentes
            // pero dado que es entre paradas, stop_id debería ser suficiente.
            // Usaremos stop_id para la clave del segmento.
            const segmentKey = `${segment.from_stop_id}_${segment.to_stop_id}`;
            
            if (!lineSegmentAggregates[line][segmentKey]) {
                lineSegmentAggregates[line][segmentKey] = {
                    from_stop_id: segment.from_stop_id,
                    to_stop_id: segment.to_stop_id,
                    totalDuration: 0,
                    count: 0
                };
            }
            lineSegmentAggregates[line][segmentKey].totalDuration += segment.duration_seconds;
            lineSegmentAggregates[line][segmentKey].count++;
        });
    }

    const lineAverageDurations = {};
    for (const line in lineSegmentAggregates) {
        lineAverageDurations[line] = [];
        for (const segmentKey in lineSegmentAggregates[line]) {
            const aggregate = lineSegmentAggregates[line][segmentKey];
            if (aggregate.count > 0) {
                lineAverageDurations[line].push({
                    from_stop_id: aggregate.from_stop_id,
                    to_stop_id: aggregate.to_stop_id,
                    average_duration_seconds: parseFloat((aggregate.totalDuration / aggregate.count).toFixed(2)),
                    sample_size: aggregate.count // Cuántos trips contribuyeron a este promedio
                });
            }
        }
        // Opcional: ordenar los segmentos de la línea por la secuencia promedio o algún otro criterio
        // Por ahora, el orden dependerá de cómo se encontraron los segmentos.
    }

    return {
        individualTripDurations,
        lineAverageDurations
    };
}

// --- Ejecución Principal ---
async function main() {
    // Reemplaza 'stoptimes.json' con la ruta real a tu archivo
    const inputFile = path.join(__dirname, '..', 'public', 'data', 'stop_times.json');    const outputFile = path.join(__dirname, '..', 'public', 'data', 'processed_subte_times.json');

    if (!fs.existsSync(inputFile)) {
        console.error(`El archivo de entrada no existe: ${inputFile}`);
        // Crear un archivo de ejemplo si no existe para probar
        console.log('Creando un archivo stoptimes.json de ejemplo...');
        const sampleData = [
              { "trip_id": "A01", "arrival_time": "12:00:00", "departure_time": "12:00:24", "stop_id": "1076S", "stop_sequence": "1"},
              { "trip_id": "A01", "arrival_time": "12:00:58", "departure_time": "12:01:22", "stop_id": "1075S", "stop_sequence": "2"},
              { "trip_id": "A01", "arrival_time": "12:02:06", "departure_time": "12:02:30", "stop_id": "1074S", "stop_sequence": "3"},
              { "trip_id": "A02", "arrival_time": "12:00:00", "departure_time": "12:00:20", "stop_id": "1076S", "stop_sequence": "1"},
              { "trip_id": "A02", "arrival_time": "12:00:50", "departure_time": "12:01:10", "stop_id": "1075S", "stop_sequence": "2"},
              { "trip_id": "P1-01", "arrival_time": "12:00:00", "departure_time": "12:00:15", "stop_id": "P001S", "stop_sequence": "1"},
              { "trip_id": "P1-01", "arrival_time": "12:01:00", "departure_time": "12:01:15", "stop_id": "P002S", "stop_sequence": "2"},
              { "trip_id": "P1-01", "arrival_time": "12:02:00", "departure_time": "12:02:15", "stop_id": "P003S", "stop_sequence": "3"},
              // Caso con error de tiempo para probar el warning
              { "trip_id": "B01", "arrival_time": "12:00:00", "departure_time": "12:00:24", "stop_id": "B01S", "stop_sequence": "1"},
              { "trip_id": "B01", "arrival_time": "11:59:58", "departure_time": "12:01:22", "stop_id": "B02S", "stop_sequence": "2"}, 
              // Caso con tiempo inválido
              { "trip_id": "C01", "arrival_time": "12:00:00", "departure_time": "INVALID_TIME", "stop_id": "C01S", "stop_sequence": "1"},
              { "trip_id": "C01", "arrival_time": "12:01:00", "departure_time": "12:01:22", "stop_id": "C02S", "stop_sequence": "2"}, 
            ];
        fs.writeFileSync(inputFile, JSON.stringify(sampleData, null, 2));
        console.log(`Archivo ${inputFile} creado. Por favor, ejecute el script de nuevo.`);
        return;
    }

    const results = await processStopTimes(inputFile);

    if (results) {
        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
        console.log(`Procesamiento completado. Resultados guardados en: ${outputFile}`);
        
        // Ejemplo de cómo acceder a los datos:
        // console.log("\nDuraciones individuales para el trip A01:");
        // console.log(JSON.stringify(results.individualTripDurations['A01'], null, 2));
        
        // console.log("\nDuraciones promedio para la línea A:");
        // console.log(JSON.stringify(results.lineAverageDurations['A'], null, 2));
    }
}

main().catch(console.error);