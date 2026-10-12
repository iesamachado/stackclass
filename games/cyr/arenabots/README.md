# ⚡ Arena de Bots

**Arena de Bots** es un juego de navegador interactivo y educativo diseñado específicamente para estudiantes de 1º de la ESO (12-13 años). Su objetivo principal es enseñar **lógica de programación básica** (secuencias, bucles, condicionales) de una forma visual y divertida mediante combates de robots en una arena.

## 🌟 Características Principales

- **Programación Visual Simplificada**: Los alumnos utilizan comandos sencillos (ej. `avanzar()`, `disparar()`, `escudo()`) para programar las rutinas de combate de su robot.
- **Sistema de Energía y Vida (HP)**: Requiere pensar de manera estratégica, ya que cada acción tiene un coste energético y usar el escudo en el momento adecuado es clave para ganar.
- **Taller de Robots**: Permite la personalización completa del avatar del robot (piezas, cara, textura) y su color neón, usando la API de DiceBear (Bottts).
- **Guardado en la Nube**: Integración con **Firebase** para iniciar sesión (mediante cuenta de Google) y guardar permanentemente los diseños y códigos en el perfil del jugador.

## 🛠️ Stack Tecnológico

El proyecto está construido sin frameworks pesados para maximizar el rendimiento y facilitar su comprensión:
- **Frontend**: HTML5, CSS3 (Variables, Flexbox, Grid) y Vanilla JavaScript (ES6 Modules).
- **Motor Gráfico**: Renderizado en 2D puro utilizando la API de `<canvas>` de HTML5.
- **Backend / BaaS**: Firebase Authentication (Google Auth) y Firebase Firestore.
- **Avatares**: DiceBear API.

## 📂 Estructura del Proyecto

```text
arenabots/
├── index.html            # Interfaz principal (UI, Modales, Canvas)
├── README.md             # Documentación del proyecto
├── css/
│   └── styles.css        # Estilos, animaciones neón, y UI ciberpunk
├── img/                  # (Opcional) Activos locales
└── js/
    ├── main.js             # Punto de entrada de la aplicación
    ├── UIManager.js        # Gestor de eventos del DOM y modales
    ├── GameEngine.js       # Motor lógico, parser de código y control del Canvas
    ├── Bot.js              # Clase que representa a los robots y dibuja sus estados
    ├── DataService.js      # Gestor de estados y configuraciones locales
    ├── FirebaseService.js  # Gestor de Autenticación y base de datos en la nube
    └── firebase-config.js  # Configuración y credenciales de Firebase
```

## 🚀 Instalación y Uso Local

Para ejecutar el proyecto en tu propio ordenador:

1. **Clona o descarga** este repositorio.
2. Inicia un **servidor web local** en la raíz del proyecto. Si tienes Python instalado, puedes abrir la terminal y ejecutar:
   ```bash
   python3 -m http.server 8765
   ```
3. Abre tu navegador y entra en: `http://localhost:8765`

## 🔑 Configuración de Firebase

Para que la base de datos y el inicio de sesión funcionen correctamente en tu entorno:
1. Crea un proyecto en la [Consola de Firebase](https://console.firebase.google.com/).
2. Habilita **Firestore Database** y **Authentication** (método: Google).
3. Obtén las credenciales de tu aplicación web de Firebase.
4. Abre el archivo `js/firebase-config.js` y reemplaza el objeto `firebaseConfig` con tus claves reales.

## 👩‍🏫 Enfoque Pedagógico

El juego está pensado para usarse en aulas de informática. El profesor puede proponer diferentes "retos" a los alumnos, tales como:
- "Crea un bot que siempre mantenga el escudo arriba si la vida baja del 30%".
- "Programa un radar de barrido constante que dispare inmediatamente si detecta un enemigo".
- "Sobrevive a un combate usando sólo 50 unidades de energía".
