// src/types/index.ts
export interface Stop {
  stop_id: string;
  stop_name: string;
  stop_lat?: string;
  stop_lon?: string;
  location_type?: string;
  parent_station?: string;
}

export interface Route {
  route_id: string;
  agency_id?: string;
  route_short_name: string;
  route_long_name: string;
  route_type?: string;
  route_color?: string;
  route_text_color?: string;
}
  
  export interface Trip {
    route_id: string;
    service_id: string;
    trip_id: string;
    trip_headsign?: string;
    direction_id: string;
    shape_id?: string;
  }
  
  export interface StopTime {
    trip_id: string;
    arrival_time: string;
    departure_time: string;
    stop_id: string;
    stop_sequence: string;
  }
  
  export interface Arrival {
    tripId: string;
    routeId: string;
    routeName: string;
    headsign: string;
    scheduledTime: string;
    estimatedTime: string;
    delay: number;
    status: "on-time" | "delayed" | "early";
    departureTime: string; // Hora de salida desde terminal
  }
  
  export interface DirectionInfo {
    id: string;
    headsign: string;
    directionId: string;
  }
  
  export interface StopWithRoute {
    stop: Stop;
    route: Route;
    direction: string;
  }
  
  export interface VehiclePosition {
    tripId: string;
    currentStopId: string | null;
    nextStopId: string | null;
    progressPercent: number;
  }
  
  export interface RouteStop {
    stopId: string;
    stopName: string;
    sequence: number;
  }