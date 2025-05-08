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
interface ApiArrivalInfoForStopList extends ArrivalBase {} 
interface ApiStopWithCalculatedArrival extends StopOnLine { nextArrival?: ApiArrivalInfoForStopList; }
interface RealtimeApiRouteResponse { 
    arrivals: Arrival[]; 
    lineStopsWithArrivals: ApiStopWithCalculatedArrival[]; 
    timestamp: number; // MILISEGUNDOS
}

// --- DATOS LOCALES --- 
type RouteToStopsData = Record<string, StopOnLine[]>;
// Interfaz LocalTrip eliminada si ya no se usa trips.json
interface AverageDuration { from_stop_id: string; to_stop_id: string; average_duration_seconds: number; sample_size: number; }
interface LineAverageDurations { [lineShortName: string]: AverageDuration[]; }
interface AverageDurationsData { lineAverageDurations: LineAverageDurations; }

// --- HELPERS ---
// loadLocalJsonData es necesaria para route_to_stops y tiempopromedio
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
        console.warn(`[getTotalTravelTime] Índices inválidos o fuera de orden: ${startStopId}(${startIndex}) -> ${endStopId}(${endIndex})`);
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

function calculateSubsequentArrivalEstimates(
    targetStopId: string,
    routeId: string,
    lineShortName: string,
    directionId: string, 
    stopSequence: StopOnLine[],
    bestArrivalPerStop: Map<string, ApiArrivalInfoForStopList>,
    averageDurationsData: AverageDurationsData | null,
    dwellTimeSeconds: number,
    maxEstimates: number,
    headerTimestamp: number
): Arrival[] { 
    const estimatedArrivals: Arrival[] = [];
    const targetStopIndex = stopSequence.findIndex(s => s.stopId === targetStopId);

    if (targetStopIndex < 1 || !averageDurationsData) { return estimatedArrivals; }
    const durationsForLine = averageDurationsData.lineAverageDurations[lineShortName];
    if (!durationsForLine) { return estimatedArrivals; }

    for (let i = 1; i <= maxEstimates; i++) {
        const prevStopIndex = targetStopIndex - i;
        if (prevStopIndex < 0) break; 
        const prevStopN = stopSequence[prevStopIndex];
        const arrivalAtPrevStopN = bestArrivalPerStop.get(prevStopN.stopId);
        if (arrivalAtPrevStopN) {
            const travelTime = getTotalTravelTime(prevStopN.stopId, targetStopId, stopSequence, durationsForLine);
            if (travelTime !== null) {
                const estimatedArrivalTimeAtTarget = arrivalAtPrevStopN.estimatedArrivalTime + travelTime + (i * dwellTimeSeconds);
                if (estimatedArrivalTimeAtTarget > headerTimestamp) {
                    estimatedArrivals.push({
                        tripId: `ESTIMATE_${i}_FROM_${prevStopN.stopId}`, routeId: routeId, 
                        estimatedArrivalTime: estimatedArrivalTimeAtTarget, delaySeconds: 0, status: 'unknown', isEstimate: true 
                    });
                }
            }
        }
    }
    return estimatedArrivals; 
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
    const NUMBER_OF_ESTIMATES_TO_GENERATE = 3;
   
    // *** Fetch a la API externa *** 
    console.log(`[API /api/realtime] Iniciando fetch a API de transporte para Subtes.`);
    const externalResponse = await fetch(
      `https://apitransporte.buenosaires.gob.ar/subtes/forecastGTFS?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
      { method: 'GET', headers: { 'Accept': 'application/json' }, next: { revalidate: 20 } } 
    );
    if (!externalResponse.ok) { 
        const errorBody = await externalResponse.text(); 
        console.error(`[API /api/realtime] Error desde API externa: ${externalResponse.status} ${externalResponse.statusText}.`); 
        let errorMsg = `Error ${externalResponse.status} al contactar servicio de subterráneos.`;
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
    const processedArrivalsForSelectedStop: Arrival[] = [];
    const targetDirectionIdNum = parseInt(directionIdParam, 10); 
    const bestArrivalPerStopId = new Map<string, ApiArrivalInfoForStopList>();

    // --- Bucle principal para poblar bestArrivalPerStopId y processedArrivalsForSelectedStop ---
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
                    const isValidReport = delayAtStation > 0 || (arrivalTimeAtStation !== headerTime);
                    if (isValidReport) {
                        const estimatedArrivalTimeForStation = headerTime + delayAtStation;
                        if (estimatedArrivalTimeForStation >= headerTime - 60) { 
                            let arrivalStatusForStation: ApiArrivalInfoForStopList['status'] = 'unknown';
                            if (delayAtStation === 0) arrivalStatusForStation = 'on-time';
                            else if (delayAtStation < 0 && delayAtStation >= -180) arrivalStatusForStation = 'early';
                            else if (delayAtStation < -180 || delayAtStation > 180) arrivalStatusForStation = 'delayed';
                            
                            const currentArrivalInfo: ApiArrivalInfoForStopList = {
                                estimatedArrivalTime: estimatedArrivalTimeForStation, delaySeconds: delayAtStation, status: arrivalStatusForStation
                            };
                            const existingBest = bestArrivalPerStopId.get(stationDataFromTrip.stop_id);
                            if (!existingBest || currentArrivalInfo.estimatedArrivalTime < existingBest.estimatedArrivalTime) {
                                bestArrivalPerStopId.set(stationDataFromTrip.stop_id, currentArrivalInfo);
                            }

                            if (stationDataFromTrip.stop_id === stopIdParam) {
                                processedArrivalsForSelectedStop.push({
                                    tripId: entity.ID, routeId: routeIdParam, 
                                    estimatedArrivalTime: estimatedArrivalTimeForStation, 
                                    delaySeconds: delayAtStation, status: arrivalStatusForStation,
                                    departureTimeFromTerminal: tripInfo.start_time, vehicleId: entity.ID, 
                                    isEstimate: false 
                                });
                            }
                        }
                    }
                }
            });
        }
    });
    processedArrivalsForSelectedStop.sort((a, b) => a.estimatedArrivalTime - b.estimatedArrivalTime);
    // --- Fin del bucle ---

    // *** Calcular Estimados ***
    const subsequentEstimates = calculateSubsequentArrivalEstimates(
        stopIdParam, routeIdParam, lineShortName, directionIdParam,
        currentStopSequence, bestArrivalPerStopId, averageDurationsData,
        DWELL_TIME_SECONDS, NUMBER_OF_ESTIMATES_TO_GENERATE, headerTime
    );

    // *** Combinar y Limpiar Arribos Finales ***
    const finalArrivals: Arrival[] = [];
    const realArrival1 = processedArrivalsForSelectedStop[0];
    if (realArrival1 && realArrival1.estimatedArrivalTime >= headerTime) { 
        finalArrivals.push(realArrival1); 
    }
    finalArrivals.push(...subsequentEstimates);
    finalArrivals.sort((a, b) => a.estimatedArrivalTime - b.estimatedArrivalTime);
    const limitedFinalArrivals = finalArrivals.slice(0, NUMBER_OF_ESTIMATES_TO_GENERATE + 1);

    // *** Construir Datos para StopLineView ***
    let lineStopsWithArrivalsData: ApiStopWithCalculatedArrival[] = [];
    lineStopsWithArrivalsData = currentStopSequence.map((baseStop: StopOnLine): ApiStopWithCalculatedArrival => ({
        stopId: baseStop.stopId, stopName: baseStop.stopName, sequence: baseStop.sequence,
        nextArrival: bestArrivalPerStopId.get(baseStop.stopId) 
    }));
    
    // *** Crear y Devolver Respuesta Exitosa ***
    const responsePayload: RealtimeApiRouteResponse = {
      arrivals: limitedFinalArrivals, 
      lineStopsWithArrivals: lineStopsWithArrivalsData,
      timestamp: headerTime * 1000 
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