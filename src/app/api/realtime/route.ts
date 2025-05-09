// src/app/api/realtime/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// --- INTERFACES EXTERNAS ---
interface ExternalApiArrivalDepartureInfo { time?: number; delay?: number; }
interface ExternalApiStation { stop_id: string; stop_name: string; arrival?: ExternalApiArrivalDepartureInfo; departure?: ExternalApiArrivalDepartureInfo; }
interface ExternalApiTripLinea { Trip_Id: string; Route_Id: string; Direction_ID: number | string; start_time: string; start_date: string; Estaciones: ExternalApiStation[]; }
interface ExternalApiEntity { ID: string; Linea: ExternalApiTripLinea; }
interface ExternalApiResponse { Header: { timestamp: number }; Entity: ExternalApiEntity[]; }

// --- INTERFACES PARA NUESTRA RESPUESTA (LADO API) ---
interface ArrivalBase { 
    estimatedArrivalTime: number; // SEGUNDOS
    delaySeconds: number; 
    status: 'on-time' | 'delayed' | 'early' | 'unknown';
}
interface Arrival extends ArrivalBase { 
    tripId: string; 
    routeId: string; 
    departureTimeFromTerminal?: string; 
    vehicleId?: string; 
    isEstimate?: boolean; 
}
interface StopOnLine { stopId: string; stopName: string; sequence: number; }
interface ApiStopWithCalculatedArrival extends StopOnLine { nextArrival?: ArrivalBase; }
interface RealtimeApiRouteResponse { 
    arrivals: Arrival[]; 
    lineStopsWithArrivals: ApiStopWithCalculatedArrival[]; 
    timestamp: number; // MILISEGUNDOS
    frequency?: { // Nueva propiedad para la frecuencia
      startTime: string;
      endTime: string;
      headwaySeconds: number;
    };
    shouldShowNoDataMessage?: boolean; // Para indicar si mostrar el mensaje de GCBA no reporta datos
}

// --- DATOS LOCALES --- 
type RouteToStopsData = Record<string, StopOnLine[]>;
interface AverageDuration { from_stop_id: string; to_stop_id: string; average_duration_seconds: number; sample_size: number; }
interface LineAverageDurations { [lineShortName: string]: AverageDuration[]; }
interface AverageDurationsData { lineAverageDurations: LineAverageDurations; }

// --- INTERFACE PARA FRECUENCIAS ---
interface Frequency {
  trip_id: string;
  start_time: string;
  end_time: string;
  headway_secs: number;
  exact_times: number;
}

// --- HELPERS ---
function loadLocalJsonData<T>(filePathFromPublic: string): T | null {
    const fullPath = path.join(process.cwd(), 'public', filePathFromPublic);
    if (!fs.existsSync(fullPath)) {
        console.error(`[API /api/realtime] Error: Archivo local no encontrado - ${fullPath}`);
        return null; 
    }
    try {
        const fileData = fs.readFileSync(fullPath, 'utf8');
        return JSON.parse(fileData) as T;
    } catch (error) {
        console.error(`[API /api/realtime] Error al leer/parsear archivo local ${filePathFromPublic}:`, error);
        return null; 
    }
}

function getTotalTravelTime(
    startStopId: string, 
    endStopId: string, 
    stopSequence: StopOnLine[], 
    averageDurations: AverageDuration[] | undefined
): number | null {
    if (!averageDurations) return null;
    const startIndex = stopSequence.findIndex(s => s.stopId === startStopId);
    const endIndex = stopSequence.findIndex(s => s.stopId === endStopId);
    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
        return null;
    }
    let totalDuration = 0;
    for (let i = startIndex; i < endIndex; i++) {
        const currentStop = stopSequence[i];
        const nextStop = stopSequence[i + 1];
        const segmentDuration = averageDurations.find(d => d.from_stop_id === currentStop.stopId && d.to_stop_id === nextStop.stopId);
        if (!segmentDuration) {
            console.warn(`[getTotalTravelTime] No se encontró duración promedio para el segmento: ${currentStop.stopId} -> ${nextStop.stopId}`);
            return null;
        }
        totalDuration += segmentDuration.average_duration_seconds;
    }
    return totalDuration; 
}

// Función para obtener la frecuencia actual basada en el trip_id y la hora actual
function getCurrentFrequency(tripId: string, frequencies: Frequency[]): Frequency | null {
    if (!frequencies || !frequencies.length) return null;
    
    // Obtener la hora actual
    const now = new Date();
    const currentTime = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    
    // Buscar la frecuencia que corresponde al trip_id y al rango horario actual
    return frequencies.find(f => {
        if (f.trip_id !== tripId) return false;
        
        // Convertir los tiempos a segundos para comparar
        const startTimeParts = f.start_time.split(':').map(Number);
        const endTimeParts = f.end_time.split(':').map(Number);
        const currentTimeParts = currentTime.split(':').map(Number);
        
        const startSeconds = startTimeParts[0] * 3600 + startTimeParts[1] * 60 + (startTimeParts[2] || 0);
        const endSeconds = endTimeParts[0] * 3600 + endTimeParts[1] * 60 + (endTimeParts[2] || 0);
        const currentSeconds = currentTimeParts[0] * 3600 + currentTimeParts[1] * 60 + currentTimeParts[2];
        
        return currentSeconds >= startSeconds && currentSeconds <= endSeconds;
    }) || null;
}

// --- Handler GET ---
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const routeIdParam = searchParams.get('routeId');
    const stopIdParam = searchParams.get('stopId'); 
    const directionIdParam = searchParams.get('direction'); 

    if (!routeIdParam || !stopIdParam || !directionIdParam) {
      console.error("[API /api/realtime] Error: Parámetros incompletos.");
      return NextResponse.json({ error: 'Se requieren routeId, stopId y direction' }, { status: 400 });
    }

    const CLIENT_ID = process.env.SUBTE_API_CLIENT_ID;
    const CLIENT_SECRET = process.env.SUBTE_API_CLIENT_SECRET;
    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error("[API /api/realtime] Error: Credenciales API no configuradas.");
      return NextResponse.json({ error: 'Error de config del servidor (realtime).' },{ status: 500 });
    }

    const DWELL_TIME_SECONDS = 24;
    const NUMBER_OF_ESTIMATES_TO_GENERATE = 3; // Para tener hasta 3 estimados (total 4 arribos con el real)
    const MAX_ARRIVALS_TO_RETURN = 4;
    
    // Definir las líneas que tienen reportes válidos
    const LINES_WITH_VALID_REPORTS = new Set(['LineaA', 'LineaB', 'LineaE']);
    const shouldShowNoDataMessage = !LINES_WITH_VALID_REPORTS.has(routeIdParam);
   
    // *** Fetch a la API externa *** 
    console.log(`[API /api/realtime] Iniciando fetch a API de transporte para Subtes.`);
    const externalResponse = await fetch(
      `https://apitransporte.buenosaires.gob.ar/subtes/forecastGTFS?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
      { method: 'GET', headers: { 'Accept': 'application/json' }, next: { revalidate: 20 } } 
    );
    if (!externalResponse.ok) { 
        const errorBody = await externalResponse.text(); 
        console.error(`[API /api/realtime] Error desde API externa: ${externalResponse.status} ${externalResponse.statusText}. Body: ${errorBody.substring(0,500)}`); 
        const errorMsg = `Error ${externalResponse.status} al contactar servicio de subterráneos.`;
        return NextResponse.json({ error: errorMsg }, { status: 502 });
    }
    const externalData: ExternalApiResponse = await externalResponse.json();
    if (!externalData || !externalData.Header || !externalData.Entity) { 
         console.error("[API /api/realtime] Error: Respuesta de API externa inválida o incompleta.");
         throw new Error("Respuesta inválida del servicio de subterráneos.");
     }

    // *** Cargar datos locales necesarios ***
    const routeToStopsDefinition = loadLocalJsonData<RouteToStopsData>('data/route_to_stops.json');
    const averageDurationsData = loadLocalJsonData<AverageDurationsData>('data/tiempopromedioentreestaciones.json'); 
    const frequenciesData = loadLocalJsonData<Frequency[]>('data/frequencies.json');
    
    if (!routeToStopsDefinition || !averageDurationsData) {
        console.error("[API /api/realtime] Error: No se pudieron cargar route_to_stops o tiempopromedioentreestaciones.");
        return NextResponse.json({ error: 'Error interno del servidor al cargar datos de ruta.' }, { status: 500 });
    }

    // *** Procesamiento ***
    const headerTime = externalData.Header.timestamp;
    const directionKey = `${routeIdParam}_${directionIdParam}`; 
    const currentStopSequence = routeToStopsDefinition[directionKey] || [];
    if (currentStopSequence.length === 0) {
         console.warn(`No se encontró secuencia de paradas para ${routeIdParam} dirección ${directionIdParam}`);
         return NextResponse.json({ arrivals: [], lineStopsWithArrivals: [], timestamp: headerTime * 1000 }); 
    }

    const lineShortName = routeIdParam.replace(/^Linea/, ''); 
    const targetDirectionIdNum = parseInt(directionIdParam, 10); 
    const bestArrivalPerStopId = new Map<string, ArrivalBase>();
    
    // --- 1. Poblar bestArrivalPerStopId ---
    externalData.Entity.forEach((entity) => {
        const tripInfo = entity.Linea;
        let tripDirectionIdNum: number | null = null;
        if (tripInfo.Direction_ID !== undefined && tripInfo.Direction_ID !== null) {
            const parsedNum = parseInt(tripInfo.Direction_ID.toString(), 10);
            if (!isNaN(parsedNum)) tripDirectionIdNum = parsedNum;
        }
        if (tripInfo.Route_Id === routeIdParam && tripDirectionIdNum === targetDirectionIdNum) {
            tripInfo.Estaciones.forEach(stationDataFromTrip => {
                if (stationDataFromTrip.arrival?.time) { 
                    const arrivalTimeAtStation = stationDataFromTrip.arrival.time;
                    const delayAtStation = stationDataFromTrip.arrival?.delay ?? 0; 
                    
                    // ----- LÓGICA DE isValidReport CORRECTA Y RESTAURADA -----
                    let isValidReport: boolean;
                    if (LINES_WITH_VALID_REPORTS.has(tripInfo.Route_Id)) {
                        // Para Líneas A, B, E, cualquier reporte con tiempo de arribo es considerado válido
                        // ya que la API externa puede enviar estos incluso con delay 0 y tiempo igual al header.
                        isValidReport = true; 
                    } else {
                        // Para otras líneas, mantener la lógica original de filtrado más estricta
                        isValidReport = delayAtStation > 0 || (arrivalTimeAtStation !== headerTime);
                    }
                    // ----- FIN LÓGICA isValidReport -----

                    if (isValidReport) {
                        const estimatedArrivalTimeForStation = headerTime + delayAtStation;
                        if (estimatedArrivalTimeForStation >= headerTime - 60) { // Considerar arribos hasta 60s en el pasado
                            let arrivalStatusForStation: ArrivalBase['status'] = 'unknown';
                            if (delayAtStation === 0) arrivalStatusForStation = 'on-time';
                            else if (delayAtStation < 0 && delayAtStation >= -180) arrivalStatusForStation = 'early';
                            else if (delayAtStation < -180 || delayAtStation > 180) arrivalStatusForStation = 'delayed';
                            
                            const currentArrivalInfo: ArrivalBase = {
                                estimatedArrivalTime: estimatedArrivalTimeForStation, delaySeconds: delayAtStation, status: arrivalStatusForStation
                            };
                            const existingBest = bestArrivalPerStopId.get(stationDataFromTrip.stop_id);
                            if (!existingBest || currentArrivalInfo.estimatedArrivalTime < existingBest.estimatedArrivalTime) {
                                bestArrivalPerStopId.set(stationDataFromTrip.stop_id, currentArrivalInfo);
                            }
                        }
                    }
                }
            });
        }
    });

    // --- 2. Construir lista de arribos para la parada seleccionada (targetStopId) ---
    const finalArrivals: Arrival[] = [];
    const targetStopIndex = currentStopSequence.findIndex(s => s.stopId === stopIdParam);

    if (targetStopIndex === -1) { 
        console.warn(`Parada seleccionada ${stopIdParam} no encontrada en la secuencia de la ruta ${routeIdParam}`);
        return NextResponse.json({ arrivals: [], lineStopsWithArrivals: [], timestamp: headerTime * 1000 });
    }

    // --- 2.A. Añadir Arribo Real (directo) a targetStopId ---
    const arrivalAtTarget = bestArrivalPerStopId.get(stopIdParam);
    let ultimoTiempoDeArriboRelevanteEnTarget = -Infinity; 
    let tripIdForFrequency = '';

    if (arrivalAtTarget && arrivalAtTarget.estimatedArrivalTime > headerTime) {
        let tripDetailsSourceEntity = externalData.Entity.find(e => e.Linea.Route_Id === routeIdParam && parseInt(e.Linea.Direction_ID.toString(),10) === targetDirectionIdNum && e.Linea.Estaciones.some(s => s.stop_id === stopIdParam && s.arrival?.time && arrivalAtTarget.estimatedArrivalTime && s.arrival.time === (arrivalAtTarget.estimatedArrivalTime - arrivalAtTarget.delaySeconds)));
        if (!tripDetailsSourceEntity) { tripDetailsSourceEntity = externalData.Entity.find(e => e.Linea.Route_Id === routeIdParam && parseInt(e.Linea.Direction_ID.toString(),10) === targetDirectionIdNum); }
        
        // Guardar el trip_id para buscar la frecuencia
        if (tripDetailsSourceEntity && tripDetailsSourceEntity.Linea.Trip_Id) {
            tripIdForFrequency = tripDetailsSourceEntity.Linea.Trip_Id;
        }
        
        finalArrivals.push({
            ...arrivalAtTarget,
            tripId: tripDetailsSourceEntity?.ID || `REAL_${stopIdParam}_${arrivalAtTarget.estimatedArrivalTime}`,
            routeId: routeIdParam,
            departureTimeFromTerminal: tripDetailsSourceEntity?.Linea.start_time,
            vehicleId: tripDetailsSourceEntity?.ID,
            isEstimate: false,
        });
        ultimoTiempoDeArriboRelevanteEnTarget = arrivalAtTarget.estimatedArrivalTime;
    }
    
    // --- 2.B. Buscar Quiebres y Proyectar (Iterando HACIA ATRÁS) ---
    let ultimoTiempoDeArriboReportado = arrivalAtTarget ? arrivalAtTarget.estimatedArrivalTime : Infinity;
    const durationsForLine = averageDurationsData.lineAverageDurations[lineShortName];

    if (durationsForLine) { 
        for (let N = 1; N <= targetStopIndex && finalArrivals.length < MAX_ARRIVALS_TO_RETURN; N++) {
            const currentIndex = targetStopIndex - N;
            const currentStop = currentStopSequence[currentIndex];
            const arrivalAtCurrentStop = bestArrivalPerStopId.get(currentStop.stopId);

            if (!arrivalAtCurrentStop || arrivalAtCurrentStop.estimatedArrivalTime <= headerTime) {
                ultimoTiempoDeArriboReportado = Infinity; 
                continue;
            }

            if (arrivalAtCurrentStop.estimatedArrivalTime > ultimoTiempoDeArriboReportado) {
                const travelTime_CurrentToTarget = getTotalTravelTime(currentStop.stopId, stopIdParam, currentStopSequence, durationsForLine);
                if (travelTime_CurrentToTarget !== null) {
                    const numIntermediateDwells = N; 
                    const projectedArrivalTime = arrivalAtCurrentStop.estimatedArrivalTime + travelTime_CurrentToTarget + (numIntermediateDwells * DWELL_TIME_SECONDS);
                    if (projectedArrivalTime > headerTime && projectedArrivalTime > ultimoTiempoDeArriboRelevanteEnTarget) {
                        finalArrivals.push({
                            status: arrivalAtCurrentStop.status, // Heredar status
                            delaySeconds: arrivalAtCurrentStop.delaySeconds, // Heredar delay
                            tripId: `ESTIMATE_${N}_FROM_${currentStop.stopId}`,
                            routeId: routeIdParam, 
                            estimatedArrivalTime: projectedArrivalTime, 
                            isEstimate: true,
                        });
                        ultimoTiempoDeArriboRelevanteEnTarget = projectedArrivalTime;
                    }
                }
            }
            ultimoTiempoDeArriboReportado = arrivalAtCurrentStop.estimatedArrivalTime;
        }
    }

    // --- 3. Post-Procesamiento Final de Arribos ---
    finalArrivals.sort((a, b) => a.estimatedArrivalTime - b.estimatedArrivalTime);
    const limitedFinalArrivals = finalArrivals.slice(0, MAX_ARRIVALS_TO_RETURN);

    // --- 4. Construir Datos para StopLineView ---
    let lineStopsWithArrivalsData: ApiStopWithCalculatedArrival[] = [];
    lineStopsWithArrivalsData = currentStopSequence.map((baseStop: StopOnLine): ApiStopWithCalculatedArrival => ({
        stopId: baseStop.stopId, stopName: baseStop.stopName, sequence: baseStop.sequence,
        nextArrival: bestArrivalPerStopId.get(baseStop.stopId) 
    }));
    
    // --- 5. Buscar información de frecuencia ---
    let frequency = null;
    if (frequenciesData && tripIdForFrequency) {
        const currentFrequency = getCurrentFrequency(tripIdForFrequency, frequenciesData);
        if (currentFrequency) {
            frequency = {
                startTime: currentFrequency.start_time,
                endTime: currentFrequency.end_time,
                headwaySeconds: currentFrequency.headway_secs
            };
        }
    }
    
    // --- 6. Crear y Devolver Respuesta Exitosa ---
    const responsePayload: RealtimeApiRouteResponse = {
      arrivals: limitedFinalArrivals, 
      lineStopsWithArrivals: lineStopsWithArrivalsData,
      timestamp: headerTime * 1000,
      frequency: frequency ?? undefined,
      shouldShowNoDataMessage: shouldShowNoDataMessage 
    };
    return NextResponse.json(responsePayload);

  // Catch general
  } catch (error: unknown) {
    let errorMessage = 'Error inesperado al procesar la solicitud en tiempo real.';
    if (error instanceof Error) errorMessage = error.message;
    else if (typeof error === 'string') errorMessage = error;
    console.error(`[API /api/realtime] CATCH GENERAL ERROR: ${errorMessage}`, error);
    return NextResponse.json({ error: errorMessage }, { status: 500 }); 
  }
}