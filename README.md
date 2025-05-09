      
# ¿Dónde está el Subte? - PWA de Transporte Público

Una Aplicación Web Progresiva (PWA) para consultar información en tiempo real y estimada sobre los subterráneos de Buenos Aires.

![Captura de Pantalla de la App (Opcional)](./screenshot.png) <!-- Reemplaza con una captura si tienes -->

## Tabla de Contenidos

- [Introducción](#introducción)
- [Características](#características)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Prerrequisitos](#prerrequisitos)
- [Instalación](#instalación)
- [Ejecución](#ejecución)
  - [Modo Desarrollo](#modo-desarrollo)
  - [Build para Producción](#build-para-producción)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Fuentes de Datos](#fuentes-de-datos)
- [Lógica Clave](#lógica-clave)
  - [Obtención de Datos en Tiempo Real](#obtención-de-datos-en-tiempo-real)
  - [Estimación de Próximos Arribos](#estimación-de-próximos-arribos)
  - [Cálculo de Frecuencias](#cálculo-de-frecuencias)
- [Scripts Utilitarios](#scripts-utilitarios)
- [Despliegue (Deploy)](#despliegue-deploy)
- [Posibles Mejoras Futuras](#posibles-mejoras-futuras)
- [Contribuciones](#contribuciones)
- [Licencia](#licencia)

## Introducción

"¿Dónde está el Subte?" es una PWA diseñada para ofrecer a los usuarios del subterráneo de Buenos Aires información actualizada sobre los próximos arribos. La aplicación combina datos en tiempo real proporcionados por la API de Transporte del GCBA con datos estáticos GTFS y cálculos de estimación para ofrecer una visión más completa de los servicios.

El objetivo es proporcionar una herramienta rápida, accesible y fácil de usar para planificar viajes en subte.

## Características

*   **Selección de Línea, Parada y Dirección:** Interfaz intuitiva para filtrar la información deseada.
*   **Próximos Arribos en Tiempo Real:** Muestra el próximo arribo reportado directamente por la API para la parada seleccionada.
*   **Estimación de Arribos Subsiguientes:** Calcula y muestra hasta 3 arribos estimados adicionales, basados en los reportes de paradas anteriores y tiempos de viaje promedio.
*   **Visualización de Recorrido de Línea:** Muestra todas las paradas de la línea seleccionada en la dirección elegida, con el próximo arribo estimado para cada una.
*   **Información de Frecuencia:** Muestra la frecuencia estimada de trenes para la franja horaria actual en la línea seleccionada.
*   **Barra de Búsqueda:** Permite buscar paradas por nombre.
*   **Diseño Responsivo y PWA:** Optimizado para dispositivos móviles y con capacidades de PWA (instalable, offline básico si se implementa).
*   **Manejo Específico por Línea:** Considera particularidades en el reporte de datos para ciertas líneas (A, B, C, E).

## Tecnologías Utilizadas

*   **Framework Frontend:** Next.js (con React)
*   **Lenguaje:** TypeScript
*   **Estilos:** Tailwind CSS
*   **Linting/Formateo:** ESLint, Prettier (implícito si se usa)
*   **Gestor de Paquetes:** npm o yarn
*   **Fuente de Datos GTFS:** Archivos estáticos (ver [Fuentes de Datos](#fuentes-de-datos))
*   **API Externa:** API de Transporte del GCBA para datos en tiempo real.
*   **Despliegue:** Vercel (u otra plataforma compatible con Next.js)

## Prerrequisitos

*   Node.js (versión recomendada: LTS, ej. 18.x o superior)
*   npm (v6+) o yarn (v1.22+)
*   Credenciales para la API de Transporte del GCBA (si se requiere acceso restringido). Estas deben configurarse como variables de entorno.

## Instalación

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/tu-repositorio.git
    cd tu-repositorio
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    # o
    yarn install
    ```

3.  **Configurar Variables de Entorno:**
    Crea un archivo `.env.local` en la raíz del proyecto y añade las credenciales necesarias para la API de Transporte del GCBA:
    ```env
    SUBTE_API_CLIENT_ID=TU_CLIENT_ID
    SUBTE_API_CLIENT_SECRET=TU_CLIENT_SECRET
    ```
    Reemplaza `TU_CLIENT_ID` y `TU_CLIENT_SECRET` con tus credenciales reales.

4.  **Procesar Datos GTFS:**
    La aplicación utiliza datos GTFS preprocesados en formato JSON ubicados en `public/data/`. Para generar o actualizar estos archivos desde los archivos GTFS en formato `.txt` (ubicados en la carpeta `gtfs/`), ejecuta el script de procesamiento:
    ```bash
    node ./ruta/a/tu/script-de-procesamiento.js 
    # Ejemplo: node ./scripts/process-gtfs.js (si tu script está en una carpeta 'scripts')
    ```
    Asegúrate de tener los archivos GTFS (`stops.txt`, `routes.txt`, `trips.txt`, `frequencies.txt`, `stop_times.txt`, etc.) en la carpeta `gtfs/` antes de ejecutar el script.

## Ejecución

### Modo Desarrollo

Para iniciar la aplicación en modo desarrollo con recarga en caliente:
```bash
npm run dev
# o
yarn dev

    

IGNORE_WHEN_COPYING_START
Use code with caution. Markdown
IGNORE_WHEN_COPYING_END

La aplicación estará disponible en http://localhost:3000.
Build para Producción

Para compilar la aplicación para producción:

      
npm run build
# o
yarn build

    

IGNORE_WHEN_COPYING_START
Use code with caution. Bash
IGNORE_WHEN_COPYING_END

Esto generará una versión optimizada en la carpeta .next/. Para ejecutar esta versión localmente:

      
npm start
# o
yarn start

    

IGNORE_WHEN_COPYING_START
Use code with caution. Bash
IGNORE_WHEN_COPYING_END
Estructura del Proyecto

      
.
├── gtfs/                      # Archivos GTFS fuente (txt)
├── public/
│   └── data/                  # Datos GTFS procesados (JSON)
│       ├── stops.json
│       ├── routes.json
│       ├── trips.json
│       ├── frequencies.json
│       ├── tiempopromedioentreestaciones.json (si se usa)
│       ├── route_to_stops.json
│       └── ... (otros archivos JSON generados)
├── src/
│   ├── app/
│   │   ├── api/               # Rutas de API de Next.js (backend)
│   │   │   ├── realtime/
│   │   │   │   └── route.ts   # Lógica principal para datos en tiempo real y estimados
│   │   │   ├── directions/
│   │   │   │   └── route.ts   # API para obtener direcciones/headsigns
│   │   │   └── ... (otras rutas API)
│   │   ├── layout.tsx
│   │   └── page.tsx           # Página principal de la aplicación
│   ├── components/            # Componentes de React reutilizables
│   │   ├── ArrivalsView.tsx
│   │   ├── StopLineView.tsx
│   │   ├── DirectionSelector.tsx
│   │   └── ...
│   ├── types/                 # Definiciones de tipos TypeScript globales
│   │   └── index.ts
│   └── ... (otros archivos y carpetas)
├── .env.local                 # Variables de entorno locales (NO subir a Git)
├── next.config.js
├── package.json
├── README.md
└── ... (otros archivos de configuración)

    

IGNORE_WHEN_COPYING_START
Use code with caution.
IGNORE_WHEN_COPYING_END
Fuentes de Datos

    Datos GTFS Estáticos: Proporcionados por BA Data - Transporte. Estos archivos (stops.txt, routes.txt, trips.txt, frequencies.txt, stop_times.txt, etc.) se procesan mediante un script para generar los archivos JSON utilizados por la aplicación, ubicados en public/data/.

        stops.json: Información de paradas.

        routes.json: Información de líneas/rutas.

        trips.json: Información de viajes (usado para trip_id representativo).

        frequencies.json: Intervalos de frecuencia para los servicios.

        route_to_stops.json: Mapeo de rutas y direcciones a su secuencia de paradas.

        tiempopromedioentreestaciones.json: Tiempos de viaje promedio entre paradas consecutivas (generado externamente o por un script adicional).

    API de Transporte del GCBA: Se utiliza para obtener datos en tiempo real (próximo arribo reportado para cada parada de cada tren en servicio). Endpoint: https://apitransporte.buenosaires.gob.ar/subtes/forecastGTFS.

Lógica Clave
Obtención de Datos en Tiempo Real

La ruta /api/realtime/route.ts es responsable de:

    Recibir routeId, stopId, y directionId como parámetros.

    Realizar una llamada a la API externa de Transporte del GCBA.

    Procesar la respuesta para extraer el arribo más próximo reportado para cada parada de la línea y dirección solicitadas (almacenado en bestArrivalPerStopId).

    Filtrar los reportes según la línea (comportamiento especial para A, B, C, E).

Estimación de Próximos Arribos

Para la parada seleccionada por el usuario (stopIdParam), además del arribo real, la API /api/realtime calcula hasta 3 arribos estimados adicionales:

    Se identifica el arribo real directo a stopIdParam.

    Se itera hacia atrás desde la parada anterior a stopIdParam.

    Se detectan "quiebres" en los tiempos de arribo reportados: si el arribo a una parada P-anterior es posterior al arribo reportado en P-siguienteEnRecorrido, se considera que el arribo en P-anterior corresponde a un tren diferente.

    Desde estos puntos de quiebre, se proyecta el tiempo de llegada a stopIdParam utilizando:

        El tiempo de arribo reportado en la parada de origen del quiebre.

        La suma de los tiempos de viaje promedio (de tiempopromedioentreestaciones.json) entre las paradas.

        Un tiempo de detención fijo (dwell time) de 24 segundos por cada parada intermedia.

    Los arribos (real y estimados) se ordenan y se devuelven los primeros 4.

Cálculo de Frecuencias

Para el primer arribo real, la API /api/realtime:

    Busca un trip_id representativo en public/data/trips.json que coincida con la routeId y directionId del arribo.

    Con este trip_id y la hora actual, consulta public/data/frequencies.json.

    Encuentra la franja horaria (start_time, end_time) que contiene la hora actual y extrae el headway_secs.

    Esta información de frecuencia se añade al objeto del primer arribo real en la respuesta de la API.

Scripts Utilitarios

    [nombre-de-tu-script-gtfs].js: Script de Node.js para procesar los archivos GTFS .txt de la carpeta gtfs/ y generar los archivos .json necesarios en public/data/. Utiliza papaparse para el parseo de CSV.

Despliegue (Deploy)

La aplicación está configurada para un despliegue sencillo en Vercel:

    Conecta tu repositorio de Git (GitHub, GitLab, Bitbucket) a Vercel.

    Configura las variables de entorno en Vercel ( SUBTE_API_CLIENT_ID, SUBTE_API_CLIENT_SECRET).

    Asegúrate de que el comando de build sea el correcto (generalmente npm run build o yarn build).

    El script de procesamiento de GTFS debe ejecutarse antes del build si los archivos JSON no están versionados en Git. Si están versionados, Vercel los usará directamente.

Posibles Mejoras Futuras

    Notificaciones Push: Para alertas de servicio o llegada de trenes.

    Modo Offline: Mejorar la funcionalidad offline con Service Workers para datos estáticos.

    Favoritos: Permitir a los usuarios guardar líneas/paradas favoritas.

    Mapa Interactivo: Visualizar la posición estimada de los trenes en un mapa (requeriría datos de shapes.txt y más lógica).

    Alertas de Servicio del GCBA: Integrar alertas de interrupciones o demoras.

    Internacionalización (i18n): Soportar múltiples idiomas.

    Pruebas Unitarias y de Integración.

Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue para discutir cambios mayores o envía un Pull Request con tus mejoras. Asegúrate de seguir las guías de estilo y de que las pruebas (si existen) pasen.
Licencia

Este proyecto está bajo la Licencia MIT.