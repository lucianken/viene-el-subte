// src/app/api/realtime/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// --- INTERFACES ---
interface ExternalApiArrivalDepartureInfo {
  time?: number; 
  delay?: number; 
}
interface ExternalApiStation {
  stop_id: string; 
  stop_name: string;
  arrival?: ExternalApiArrivalDepartureInfo;
  departure?: ExternalApiArrivalDepartureInfo;
}
interface ExternalApiTripLinea {
  Trip_Id: string;
  Route_Id: string;
  Direction_ID: number | string; 
  start_time: string;
  start_date: string;
  Estaciones: ExternalApiStation[];
}
interface ExternalApiEntity {
  ID: string; 
  Linea: ExternalApiTripLinea;
}
interface ExternalApiResponse {
  Header: { timestamp: number }; 
  Entity: ExternalApiEntity[];   
}

// --- INTERFACES PARA NUESTRA RESPUESTA ---
interface Arrival {
  tripId: string; 
  routeId: string;
  headsign: string; 
  estimatedArrivalTime: number; // Timestamp en SEGUNDOS
  delaySeconds: number; 
  status: 'on-time' | 'delayed' | 'early' | 'unknown';
  departureTimeFromTerminal?: string; 
  vehicleId?: string; 
}
interface StopOnLine { 
  stopId: string;
  stopName: string;
  sequence: number; 
}
// ELIMINADO: interface VehiclePosition ya que no se usa y 'vehicles' se envía vacío.

type RouteToStopsData = Record<string, { stopId: string; stopName: string; sequence: number }[]>;
interface LocalTrip {
    route_id: string;
    service_id: string;
    trip_id: string;
    trip_headsign?: string;
    trip_short_name?: string; 
    direction_id: string | number; 
    block_id?: string;
    shape_id?: string;
}

// --- Funciones Helper ---
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

// --- Handler GET ---
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const routeIdParam = searchParams.get('routeId');
  const stopIdParam = searchParams.get('stopId'); 
  const directionIdParam = searchParams.get('direction'); 

  console.log(`[API /api/realtime] Request: R:${routeIdParam}, S:${stopIdParam}, D:${directionIdParam}`);

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

  try { 
    console.log(`[API /api/realtime] Iniciando fetch a API de transporte para Subtes.`);
    const externalResponse = await fetch(
      `https://apitransporte.buenosaires.gob.ar/subtes/forecastGTFS?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
      { 
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 20 }
      } 
    );

    if (!externalResponse.ok) {
      const errorBody = await externalResponse.text(); 
      console.error(`[API /api/realtime] Error desde API externa: ${externalResponse.status} ${externalResponse.statusText}. Respuesta: ${errorBody.substring(0, 500)}...`); 
      let errorMsg = `Error ${externalResponse.status} al contactar servicio de subterráneos.`;
      if (externalResponse.status === 401 || externalResponse.status === 403) {
          errorMsg = "Error de autenticación con el servicio de subterráneos. Revisa las credenciales.";
      } else if (externalResponse.status === 429) {
          errorMsg = "Límite de peticiones excedido al servicio de subterráneos.";
      }
      return NextResponse.json({ error: errorMsg }, { status: 502 });
    }

    const externalData: ExternalApiResponse = await externalResponse.json();
    
    // Validación básica de la respuesta
    if (!externalData || !externalData.Header || !externalData.Entity) {
        console.error("[API /api/realtime] Error: Respuesta de API externa inválida o incompleta.");
        throw new Error("Respuesta inválida del servicio de subterráneos.");
    }

    // Formatear timestamp del header como hora legible
    const headerTime = externalData.Header.timestamp;
    const headerDate = new Date(headerTime * 1000);
    const headerTimeFormatted = headerDate.toLocaleTimeString('es-AR');
    
    console.log(`[API /api/realtime] Respuesta API externa OK: Timestamp ${headerTime}, Hora ${headerTimeFormatted}, Entidades ${externalData.Entity.length}`);

    const processedArrivals: Arrival[] = [];
    const targetDirectionIdNum = parseInt(directionIdParam, 10);
    const localTripsData = loadLocalJsonData<LocalTrip[]>('data/trips.json'); 

    console.log(`[API /api/realtime] Procesando entidades para R:${routeIdParam}, D:${targetDirectionIdNum}. Parada usuario:${stopIdParam}`);

    // Procesar las entidades para encontrar arribos a la parada solicitada
    externalData.Entity.forEach((entity: ExternalApiEntity) => {
      const tripInfo = entity.Linea;
      let tripDirectionIdNum: number | null = null;
      
      if (tripInfo.Direction_ID !== undefined && tripInfo.Direction_ID !== null) {
          const parsedNum = parseInt(tripInfo.Direction_ID.toString(), 10);
          if (!isNaN(parsedNum)) tripDirectionIdNum = parsedNum;
      }
    
      // Solo procesar si coincide línea y dirección
      if (tripInfo.Route_Id === routeIdParam && tripDirectionIdNum === targetDirectionIdNum) {
        // Buscar la parada específica que interesa al usuario
        const targetStation = tripInfo.Estaciones.find(est => est.stop_id === stopIdParam);
        
        if (targetStation && targetStation.arrival?.time) {
          const arrivalTime = targetStation.arrival.time;
          const delayInSeconds = targetStation.arrival?.delay !== undefined ? Number(targetStation.arrival.delay) : 0;
          
          // CAMBIO CLAVE: Verificar si es un reporte real o no
          const isValidReport = delayInSeconds > 0 || (arrivalTime !== headerTime);
          
          if (isValidReport) {
            // Solo procesar si el arribo es futuro o muy reciente (últimos 60 segundos)
            const estimatedArrivalTime = headerTime + delayInSeconds;
            
            if (estimatedArrivalTime >= headerTime - 60) {
              // Determinar estado del arribo
              let arrivalStatus: Arrival['status'] = 'unknown';
              if (delayInSeconds === 0) arrivalStatus = 'on-time';
              else if (delayInSeconds < 0 && delayInSeconds >= -180) arrivalStatus = 'early'; // Ajustar umbrales si es necesario
              else if (delayInSeconds < -180 || delayInSeconds > 180) arrivalStatus = 'delayed'; // Ajustar umbrales si es necesario
              
              // Determinar destino final
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
                      // Si no hay info en localTripsData, usamos la última estación como terminal
                      officialTripHeadsign = tripInfo.Estaciones[tripInfo.Estaciones.length - 1]?.stop_name || 'Desconocido';
                  }
              } else {
                  officialTripHeadsign = tripInfo.Estaciones[tripInfo.Estaciones.length - 1]?.stop_name || 'Desconocido';
              }
              
              processedArrivals.push({
                tripId: entity.ID, // Usar entity.ID que es el trip_id en GTFS-RT
                routeId: tripInfo.Route_Id,
                headsign: officialTripHeadsign,
                estimatedArrivalTime: estimatedArrivalTime, // Este es el tiempo ya calculado
                delaySeconds: delayInSeconds,
                status: arrivalStatus,
                departureTimeFromTerminal: tripInfo.start_time, // De la API externa
                vehicleId: entity.ID // Puede ser el mismo que tripId si no hay vehicle_id separado
              });
            }
          } else {
            // No hay reporte válido para esta estación
            console.log(`[API /api/realtime] Sin reporte válido para estación ${targetStation.stop_name} (R:${tripInfo.Route_Id} D:${tripDirectionIdNum})`);
          }
        }
      }
    });

    // Ordenamos los arribos por tiempo estimado (más cercano primero)
    processedArrivals.sort((a, b) => a.estimatedArrivalTime - b.estimatedArrivalTime);
    
    // Logging y procesamiento final
    if (processedArrivals.length > 0) {
        console.log(`[API /api/realtime] Próximas llegadas para ${stopIdParam} (R:${routeIdParam} D:${directionIdParam}):`);
        processedArrivals.forEach((arr: Arrival) => {
            const arrivalD = new Date(arr.estimatedArrivalTime * 1000);
            const serverNow = new Date();
            const minutesDiff = Math.max(0, Math.round((arrivalD.getTime() - serverNow.getTime()) / (1000 * 60)));
            console.log(`  - Trip ${arr.tripId} (Hacia ${arr.headsign}): ${minutesDiff} min (ETA: ${arrivalD.toLocaleTimeString('es-AR')}, Header: ${headerTimeFormatted}, Delay: ${arr.delaySeconds}s)`);
        });
    } else {
        console.log(`[API /api/realtime] No se encontraron llegadas futuras para ${stopIdParam} (R:${routeIdParam} D:${directionIdParam}).`);
    }

    // Obtener información de todas las paradas para esta línea/dirección
    const routeToStops = loadLocalJsonData<RouteToStopsData>('data/route_to_stops.json');
    let stopsForLineView: StopOnLine[] = [];
    if (routeToStops) {
      const directionKey = `${routeIdParam}_${directionIdParam}`;
      stopsForLineView = routeToStops[directionKey] || [];
    }

    // Devolvemos la respuesta
    return NextResponse.json({
      arrivals: processedArrivals,
      stops: stopsForLineView,
      vehicles: [], // Array vacío para mantener la estructura de respuesta esperada
      timestamp: externalData.Header.timestamp * 1000 // Convertir a milisegundos como espera el frontend
    });

  } catch (error: unknown) { // CORREGIDO: de 'any' a 'unknown'
    let errorMessage = 'Error al procesar datos en tiempo real.';
    let errorStack = undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    console.error(`[API /api/realtime] CATCH BLOCK ERROR: ${errorMessage}`, errorStack || error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}