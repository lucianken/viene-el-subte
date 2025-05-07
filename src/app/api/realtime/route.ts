// src/app/api/realtime/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// --- INTERFACES EXTERNAS --- (sin cambios)
interface ExternalApiArrivalDepartureInfo { time?: number; delay?: number; }
interface ExternalApiStation { stop_id: string; stop_name: string; arrival?: ExternalApiArrivalDepartureInfo; departure?: ExternalApiArrivalDepartureInfo; }
interface ExternalApiTripLinea { Trip_Id: string; Route_Id: string; Direction_ID: number | string; start_time: string; start_date: string; Estaciones: ExternalApiStation[]; }
interface ExternalApiEntity { ID: string; Linea: ExternalApiTripLinea; }
interface ExternalApiResponse { Header: { timestamp: number }; Entity: ExternalApiEntity[]; }

// --- INTERFACES PARA NUESTRA RESPUESTA (LADO API) ---
interface Arrival { // Para la parada principal (ArrivalsView)
  tripId: string; routeId: string; headsign: string; estimatedArrivalTime: number; delaySeconds: number; status: 'on-time' | 'delayed' | 'early' | 'unknown'; departureTimeFromTerminal?: string; vehicleId?: string;
}
interface StopOnLine { stopId: string; stopName: string; sequence: number; } // De route_to_stops.json

// NUEVA: Información de arribo para la lista de paradas de la línea
interface ApiArrivalInfoForStopList {
    estimatedArrivalTime: number; // SEGUNDOS
    delaySeconds: number;
    status: 'on-time' | 'delayed' | 'early' | 'unknown';
}
// NUEVA: Parada de la línea con su posible próximo arribo
interface ApiStopWithCalculatedArrival extends StopOnLine {
    nextArrival?: ApiArrivalInfoForStopList;
}

// NUEVA: Interfaz de la respuesta completa de esta API
interface RealtimeApiRouteResponse {
  arrivals: Arrival[]; // Arribos para la parada seleccionada (ArrivalsView)
  lineStopsWithArrivals: ApiStopWithCalculatedArrival[]; // Paradas de la línea con sus arribos (StopLineView)
  // vehicles: [], // Si es parte de tu estructura
  timestamp: number; // Timestamp de la API externa, en MILISEGUNDOS para el frontend
}

// --- DATOS LOCALES ---
type RouteToStopsData = Record<string, StopOnLine[]>;
interface LocalTrip { route_id: string; service_id: string; trip_id: string; trip_headsign?: string; trip_short_name?: string; direction_id: string | number; block_id?: string; shape_id?: string; }

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const routeIdParam = searchParams.get('routeId');
  const stopIdParam = searchParams.get('stopId'); // Parada seleccionada por el usuario
  const directionIdParam = searchParams.get('direction'); 

  if (!routeIdParam || !stopIdParam || !directionIdParam) {
    return NextResponse.json({ error: 'Se requieren routeId, stopId y direction' }, { status: 400 });
  }

  const CLIENT_ID = process.env.SUBTE_API_CLIENT_ID;
  const CLIENT_SECRET = process.env.SUBTE_API_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
      return NextResponse.json({ error: 'Error de config del servidor (realtime).' },{ status: 500 });
  }

  try { 
    const externalResponse = await fetch(
      `https://apitransporte.buenosaires.gob.ar/subtes/forecastGTFS?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
      { method: 'GET', headers: { 'Accept': 'application/json' }, next: { revalidate: 20 } } 
    );

    if (!externalResponse.ok) { /* ... (manejo de error sin cambios) ... */ }
    const externalData: ExternalApiResponse = await externalResponse.json();
    if (!externalData || !externalData.Header || !externalData.Entity) { /* ... (manejo de error sin cambios) ... */ }

    const headerTime = externalData.Header.timestamp; // Timestamp base en SEGUNDOS
    const localTripsData = loadLocalJsonData<LocalTrip[]>('data/trips.json'); 
    const routeToStopsDefinition = loadLocalJsonData<RouteToStopsData>('data/route_to_stops.json');

    const processedArrivalsForSelectedStop: Arrival[] = []; // Para ArrivalsView
    const targetDirectionIdNum = parseInt(directionIdParam, 10);
    
    // NUEVO: Mapa para rastrear el mejor arribo para cada stop_id de la línea/dirección
    const bestArrivalPerStopId = new Map<string, ApiArrivalInfoForStopList>();

    externalData.Entity.forEach((entity) => { // Iterar sobre cada "tren/servicio"
      const tripInfo = entity.Linea;
      let tripDirectionIdNum: number | null = null;
      if (tripInfo.Direction_ID !== undefined && tripInfo.Direction_ID !== null) {
          const parsedNum = parseInt(tripInfo.Direction_ID.toString(), 10);
          if (!isNaN(parsedNum)) tripDirectionIdNum = parsedNum;
      }
    
      // **INICIO DE TU LÓGICA EXISTENTE (con adaptaciones mínimas)**
      // Solo procesar si coincide línea y dirección solicitada por el frontend
      if (tripInfo.Route_Id === routeIdParam && tripDirectionIdNum === targetDirectionIdNum) {
        
        // Iterar sobre las estaciones de ESTE tren específico
        tripInfo.Estaciones.forEach(stationDataFromTrip => {
            if (stationDataFromTrip.arrival?.time) {
                const arrivalTimeAtStation = stationDataFromTrip.arrival.time;
                const delayAtStation = stationDataFromTrip.arrival?.delay !== undefined ? Number(stationDataFromTrip.arrival.delay) : 0;
                const isValidReport = delayAtStation > 0 || (arrivalTimeAtStation !== headerTime);

                if (isValidReport) {
                    const estimatedArrivalTimeForStation = headerTime + delayAtStation;
                    if (estimatedArrivalTimeForStation >= headerTime - 60) { // Futuro o muy reciente
                        
                        let arrivalStatusForStation: ApiArrivalInfoForStopList['status'] = 'unknown';
                        if (delayAtStation === 0) arrivalStatusForStation = 'on-time';
                        else if (delayAtStation < 0 && delayAtStation >= -180) arrivalStatusForStation = 'early';
                        else if (delayAtStation < -180 || delayAtStation > 180) arrivalStatusForStation = 'delayed';

                        // DATOS PARA StopLineView:
                        const currentArrivalInfo: ApiArrivalInfoForStopList = {
                            estimatedArrivalTime: estimatedArrivalTimeForStation,
                            delaySeconds: delayAtStation,
                            status: arrivalStatusForStation
                        };

                        // Guardar/actualizar el mejor arribo para esta stationDataFromTrip.stop_id
                        const existingBest = bestArrivalPerStopId.get(stationDataFromTrip.stop_id);
                        if (!existingBest || currentArrivalInfo.estimatedArrivalTime < existingBest.estimatedArrivalTime) {
                            bestArrivalPerStopId.set(stationDataFromTrip.stop_id, currentArrivalInfo);
                        }

                        // DATOS PARA ArrivalsView (solo si es la parada seleccionada):
                        // TU LÓGICA EXISTENTE PARA PROCESAR ARRIBOS A `stopIdParam`
                        if (stationDataFromTrip.stop_id === stopIdParam) {
                            let officialTripHeadsign = "Desconocido";
                            if (localTripsData) {
                                const matchingLocalTrip = localTripsData.find((t: LocalTrip) =>
                                    t.route_id === tripInfo.Route_Id &&
                                    t.direction_id?.toString() === tripDirectionIdNum?.toString() &&
                                    t.trip_headsign && t.trip_headsign.trim() !== ""
                                );
                                if (matchingLocalTrip?.trip_headsign) {
                                    officialTripHeadsign = matchingLocalTrip.trip_headsign;
                                } else {
                                    officialTripHeadsign = tripInfo.Estaciones[tripInfo.Estaciones.length - 1]?.stop_name || 'Desconocido';
                                }
                            } else {
                                officialTripHeadsign = tripInfo.Estaciones[tripInfo.Estaciones.length - 1]?.stop_name || 'Desconocido';
                            }
                            
                            processedArrivalsForSelectedStop.push({
                                tripId: entity.ID, routeId: tripInfo.Route_Id, headsign: officialTripHeadsign,
                                estimatedArrivalTime: estimatedArrivalTimeForStation, delaySeconds: delayAtStation, status: arrivalStatusForStation,
                                departureTimeFromTerminal: tripInfo.start_time, vehicleId: entity.ID
                            });
                        }
                    }
                }
            }
        });
      }
      // **FIN DE TU LÓGICA EXISTENTE (con adaptaciones mínimas)**
    });

    processedArrivalsForSelectedStop.sort((a, b) => a.estimatedArrivalTime - b.estimatedArrivalTime);
    
    // CONSTRUIR LA LISTA DE PARADAS PARA StopLineView
    let lineStopsWithArrivalsData: ApiStopWithCalculatedArrival[] = [];
    if (routeToStopsDefinition) {
      const directionKey = `${routeIdParam}_${directionIdParam}`;
      const baseStopsForLine = routeToStopsDefinition[directionKey] || [];
      
      lineStopsWithArrivalsData = baseStopsForLine.map(baseStop => ({
        ...baseStop, // stopId, stopName, sequence
        nextArrival: bestArrivalPerStopId.get(baseStop.stopId) // Puede ser undefined
      }));
    }

    const responsePayload: RealtimeApiRouteResponse = {
      arrivals: processedArrivalsForSelectedStop,
      lineStopsWithArrivals: lineStopsWithArrivalsData,
      timestamp: externalData.Header.timestamp * 1000 
    };

    return NextResponse.json(responsePayload);

  } catch (error: unknown) {
    let errorMessage = 'Error al procesar datos en tiempo real.';
    if (error instanceof Error) errorMessage = error.message;
    else if (typeof error === 'string') errorMessage = error;
    console.error(`[API /api/realtime] CATCH BLOCK ERROR: ${errorMessage}`, error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}