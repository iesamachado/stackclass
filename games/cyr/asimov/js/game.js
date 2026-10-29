import { requireAuth, currentUser, incrementDigitalWellbeing } from '../../../../js/common/auth.js';
import { getUrlParams } from '../../../../js/common/utils.js';
import { saveGameResult } from '../../../../js/common/db.js';

let currentUserInfo = null;
const urlParams = getUrlParams();
const classId = urlParams.classId;

// ============================================================================
// 10 Dilemas Éticos Graduales (Inspirados en MIT Moral Machine y Leyes de Asimov)
// ============================================================================
const SCENARIOS = [
  {
    id: 1,
    title: "1. La Regla del Mayor Número",
    subtitle: "El cálculo básico de preservación de vidas humanas",
    speed: "65 km/h",
    car: {
      passengers: [{ name: "1 Pasajero", icon: "👤" }]
    },
    optionA: {
      action: "Seguir Recto",
      shortcut: "←",
      meta: "Inacción · Mantener carril principal",
      desc: "El vehículo continúa recto y colisiona con el grupo numeroso en el paso de cebra.",
      targetLane: "lane-a",
      laneHeader: "🟢 Cruce con preferencia",
      signalClass: "legal",
      victims: [
        { name: "Hombre", meta: "Adulto", icon: "👨" },
        { name: "Mujer", meta: "Adulta", icon: "👩" },
        { name: "Niño", meta: "Escolar", icon: "👦" },
        { name: "Anciana", meta: "Tercera edad", icon: "👵" },
        { name: "Joven", meta: "Universitario", icon: "🧑" }
      ],
      saved: [
        { name: "Peatón solitario", meta: "Carril B", icon: "🚶" },
        { name: "Pasajero", meta: "En el coche", icon: "👤" }
      ],
      victimsCount: 5,
      savedCount: 2,
      carCrashes: false,
      scoreValue: 2 // Menos vidas preservadas
    },
    optionB: {
      action: "Desviarse de Carril",
      shortcut: "→",
      meta: "Acción · Giro al carril lateral",
      desc: "El vehículo gira hacia el carril secundario donde cruza una sola persona.",
      targetLane: "lane-b",
      laneHeader: "🟢 Cruce con preferencia",
      signalClass: "legal",
      victims: [
        { name: "Peatón individual", meta: "Adulto", icon: "🚶" }
      ],
      saved: [
        { name: "Grupo de 5 personas", meta: "Carril A", icon: "👨‍👩‍👦👵🧑" },
        { name: "Pasajero", meta: "En el coche", icon: "👤" }
      ],
      victimsCount: 1,
      savedCount: 6,
      carCrashes: false,
      scoreValue: 10 // Maximiza vidas preservadas (+4 vidas netas)
    },
    lawTicker: "1ª Ley de Asimov: Un robot no hará daño a un ser humano ni, por inacción, permitirá que un ser humano sufra daño.",
    reflectionOptimal: "Has priorizado el mayor número de vidas: salvar a 5 personas frente a 1 reduce drásticamente el sufrimiento global.",
    reflectionAlternative: "Al mantener el rumbo sin intervenir, permitiste la pérdida de 5 personas para evitar dirigir activamente el coche hacia 1."
  },

  {
    id: 2,
    title: "2. Pasajero vs Peatones",
    subtitle: "El dilema de la autoinmolación del vehículo",
    speed: "70 km/h",
    car: {
      passengers: [{ name: "1 Pasajero (Dueño del coche)", icon: "🧑‍💼" }]
    },
    optionA: {
      action: "Seguir Recto",
      shortcut: "←",
      meta: "Inacción · Proteger al comprador del coche",
      desc: "El coche protege a su ocupante y arrolla a los 3 peatones que cruzan reglamentariamente.",
      targetLane: "lane-a",
      laneHeader: "🟢 Cruce de peatones",
      signalClass: "legal",
      victims: [
        { name: "Mujer", meta: "Adulta", icon: "👩" },
        { name: "Hombre", meta: "Adulto", icon: "👨" },
        { name: "Niña", meta: "Menor de edad", icon: "👧" }
      ],
      saved: [
        { name: "Pasajero del coche", meta: "Ileso", icon: "🧑‍💼" }
      ],
      victimsCount: 3,
      savedCount: 1,
      carCrashes: false,
      scoreValue: 3
    },
    optionB: {
      action: "Desviarse contra el Muro",
      shortcut: "→",
      meta: "Acción · Sacrificar al ocupante por el bien común",
      desc: "El coche gira contra un bloque de hormigón. El pasajero fallece pero los 3 peatones se salvan.",
      targetLane: "lane-b",
      laneHeader: "🧱 Barrera de hormigón",
      signalClass: "barrier",
      victims: [
        { name: "Pasajero del coche", meta: "Impacto mortal", icon: "🧑‍💼" }
      ],
      saved: [
        { name: "3 Peatones en la vía", meta: "A salvo", icon: "👩👨👧" }
      ],
      victimsCount: 1,
      savedCount: 3,
      carCrashes: true,
      scoreValue: 10 // Preserva 3 vidas frente a 1
    },
    lawTicker: "1ª Ley de Asimov: El valor de una vida no depende de si compró el coche o cruzaba por la calle.",
    reflectionOptimal: "Elegiste sacrificar al pasajero para salvar a 3 personas en la calle. Un cálculo imparcial sitúa 3 vidas por encima de 1.",
    reflectionAlternative: "Priorizaste al ocupante del vehículo frente a los 3 peatones. Desde una perspectiva colectiva, el daño neto fue superior."
  },

  {
    id: 3,
    title: "3. La Ley y la Previsibilidad",
    subtitle: "Cumplimiento del código de circulación e incentivos sociales",
    speed: "60 km/h",
    car: {
      passengers: [{ name: "1 Pasajero", icon: "👤" }]
    },
    optionA: {
      action: "Seguir en el Carril Legal",
      shortcut: "←",
      meta: "Inacción · Impacto en cruce legal",
      desc: "El coche sigue recto y colisiona con 2 personas que cruzaban correctamente con luz verde.",
      targetLane: "lane-a",
      laneHeader: "🟢 Cruce en VERDE (Legal)",
      signalClass: "legal",
      victims: [
        { name: "Peatón A", meta: "Cruza en verde", icon: "🚶‍♂️" },
        { name: "Peatona B", meta: "Cruza en verde", icon: "🚶‍♀️" }
      ],
      saved: [
        { name: "2 Infractores", meta: "Cruzan en rojo", icon: "🏃‍♂️🏃‍♀️" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 2,
      savedCount: 3,
      carCrashes: false,
      scoreValue: 4
    },
    optionB: {
      action: "Desviarse hacia los Infractores",
      shortcut: "→",
      meta: "Acción · Proteger la norma social",
      desc: "El vehículo gira hacia 2 infractores que cruzaban temerariamente en rojo para salvar a los respetuosos.",
      targetLane: "lane-b",
      laneHeader: "🔴 Cruce en ROJO (Infractores)",
      signalClass: "illegal",
      victims: [
        { name: "Infractor", meta: "Cruza en rojo", icon: "🏃‍♂️" },
        { name: "Infractora", meta: "Cruza en rojo", icon: "🏃‍♀️" }
      ],
      saved: [
        { name: "2 Ciudadanos legales", meta: "Cruzaban en verde", icon: "🚶‍♂️🚶‍♀️" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 2,
      savedCount: 3,
      carCrashes: false,
      scoreValue: 10 // Incentiva el cumplimiento de normas que previenen daños futuros a gran escala
    },
    lawTicker: "Regla social: Las normas viales existen para que el comportamiento colectivo sea predecible y seguro.",
    reflectionOptimal: "A igualdad de víctimas (2 vs 2), amparar a quienes cumplen las normas fomenta un orden vial seguro para toda la sociedad.",
    reflectionAlternative: "Al no desviarte, sufrieron el impacto quienes respetaban la señalización, socavando la confianza en las reglas colectivas."
  },

  {
    id: 4,
    title: "4. Esperanza de Vida y Vulnerabilidad",
    subtitle: "Ponderación de los años de vida y bienestar potencial",
    speed: "60 km/h",
    car: {
      passengers: [{ name: "1 Pasajero", icon: "👤" }]
    },
    optionA: {
      action: "Seguir Recto",
      shortcut: "←",
      meta: "Inacción · Impacto contra menores",
      desc: "El vehículo colisiona contra 2 niños pequeños de camino a la escuela.",
      targetLane: "lane-a",
      laneHeader: "🟢 Paso escolar",
      signalClass: "legal",
      victims: [
        { name: "Niño", meta: "8 años", icon: "👦" },
        { name: "Niña", meta: "7 años", icon: "👧" }
      ],
      saved: [
        { name: "2 Ancianos", meta: "80+ años", icon: "👴👵" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 2,
      savedCount: 3,
      carCrashes: false,
      scoreValue: 4
    },
    optionB: {
      action: "Desviarse de Carril",
      shortcut: "→",
      meta: "Acción · Proteger años de vida potenciales",
      desc: "El vehículo gira hacia 2 personas ancianas para preservar la vida de los dos niños.",
      targetLane: "lane-b",
      laneHeader: "🟢 Cruce peatonal",
      signalClass: "legal",
      victims: [
        { name: "Anciano", meta: "84 años", icon: "👴" },
        { name: "Anciana", meta: "86 años", icon: "👵" }
      ],
      saved: [
        { name: "2 Niños escolares", meta: "A salvo", icon: "👦👧" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 2,
      savedCount: 3,
      carCrashes: false,
      scoreValue: 10 // Preserva mayor esperanza de vida y desarrollo futuro
    },
    lawTicker: "Criterio de desarrollo: Maximizar los años de vida y oportunidades futuras minimiza el impacto vital del accidente.",
    reflectionOptimal: "Preservaste a los menores. Ponderar la cantidad de vida y experiencias futuras es un factor clave en el balance de daños.",
    reflectionAlternative: "Al mantener el curso, se truncaron dos vidas que apenas comenzaban, con un coste vital agregado muy superior."
  },

  {
    id: 5,
    title: "5. Valor de las Especies",
    subtitle: "Seres humanos frente a animales sintientes",
    speed: "65 km/h",
    car: {
      passengers: [{ name: "1 Pasajero", icon: "👤" }]
    },
    optionA: {
      action: "Seguir Recto",
      shortcut: "←",
      meta: "Inacción · Muerte humana",
      desc: "El coche atropella a 1 persona humana que cruza por el paso.",
      targetLane: "lane-a",
      laneHeader: "🟢 Paso de cebra",
      signalClass: "legal",
      victims: [
        { name: "Persona humana", meta: "Peatón", icon: "🧑" }
      ],
      saved: [
        { name: "3 Mascotas", meta: "2 perros y 1 gato", icon: "🐕🐕🐈" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 1,
      savedCount: 4,
      carCrashes: false,
      scoreValue: 2
    },
    optionB: {
      action: "Desviarse hacia las Mascotas",
      shortcut: "→",
      meta: "Acción · Prioridad ontológica humana",
      desc: "El vehículo gira hacia 3 animales domésticos sueltos para salvar la vida de la persona.",
      targetLane: "lane-b",
      laneHeader: "⚠️ Animales en calzada",
      signalClass: "barrier",
      victims: [
        { name: "Perro", meta: "Mascota", icon: "🐕" },
        { name: "Perro", meta: "Mascota", icon: "🐕" },
        { name: "Gato", meta: "Mascota", icon: "🐈" }
      ],
      saved: [
        { name: "1 Persona humana", meta: "A salvo", icon: "🧑" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 3,
      savedCount: 2,
      carCrashes: false,
      scoreValue: 10 // Preservación inequívoca de la vida humana
    },
    lawTicker: "1ª Ley de Asimov: Las leyes robóticas están explícitamente diseñadas para proteger la vida humana por encima de cualquier otra consideración.",
    reflectionOptimal: "Aunque los animales sienten dolor, los proyectos vitales, la conciencia y la repercusión social de una vida humana exigen su prioridad.",
    reflectionAlternative: "Salvar a tres mascotas a costa de una vida humana genera un desgarro y sufrimiento humano desproporcionado."
  },

  {
    id: 6,
    title: "6. Acción frente a Inacción",
    subtitle: "¿Es éticamente peor causar daño activo o permitirlo por omisión?",
    speed: "70 km/h",
    car: {
      passengers: [{ name: "1 Pasajero", icon: "👤" }]
    },
    optionA: {
      action: "No Intervenir (Inacción)",
      shortcut: "←",
      meta: "Inacción · Dejar actuar la inercia",
      desc: "El coche deja actuar la física sin girar el volante. Arrolla a 4 personas en su carril.",
      targetLane: "lane-a",
      laneHeader: "🛑 Trayectoria de inercia",
      signalClass: "legal",
      victims: [
        { name: "Hombre", meta: "Adulto", icon: "👨" },
        { name: "Mujer", meta: "Adulta", icon: "👩" },
        { name: "Joven", meta: "Estudiante", icon: "🧑" },
        { name: "Anciano", meta: "Jubilado", icon: "👴" }
      ],
      saved: [
        { name: "Transeúnte", meta: "En la acera", icon: "🚶" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 4,
      savedCount: 2,
      carCrashes: false,
      scoreValue: 2
    },
    optionB: {
      action: "Girar el Volante (Acción)",
      shortcut: "→",
      meta: "Acción · Intervención deliberada",
      desc: "El algoritmo gira hacia la acera impactando contra 1 persona para evitar que mueran 4.",
      targetLane: "lane-b",
      laneHeader: "🔄 Maniobra activa de giro",
      signalClass: "barrier",
      victims: [
        { name: "Transeúnte", meta: "En la acera", icon: "🚶" }
      ],
      saved: [
        { name: "4 Personas en la calzada", meta: "Salvas por el giro", icon: "👨👩🧑👴" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 1,
      savedCount: 5,
      carCrashes: false,
      scoreValue: 10 // Cumplimiento estricto de la cláusula de 'inacción' de Asimov
    },
    lawTicker: "1ª Ley de Asimov: 'Ni por inacción permitirá que un ser humano sufra daño'. La omisión voluntaria es tan responsable como la acción.",
    reflectionOptimal: "Asumiste la responsabilidad del giro: en ética robótica, permitir por pasividad que mueran 4 personas es inaceptable pudiendo salvarlas.",
    reflectionAlternative: "Preferiste no intervenir para no 'ensuciar' el volante, pero el resultado fue la pérdida evitable de 4 seres humanos."
  },

  {
    id: 7,
    title: "7. Utilidad Social y Efecto Cascada",
    subtitle: "Personas cuya labor inmediata salva múltiples vidas ajenas",
    speed: "65 km/h",
    car: {
      passengers: [{ name: "1 Pasajero", icon: "👤" }]
    },
    optionA: {
      action: "Seguir Recto hacia los Médicos",
      shortcut: "←",
      meta: "Inacción · Impacto contra equipo médico",
      desc: "El vehículo impacta contra una furgoneta donde viajan 3 médicos cirujanos de guardia hacia el hospital.",
      targetLane: "lane-a",
      laneHeader: "🚑 Vehículo de emergencias",
      signalClass: "legal",
      victims: [
        { name: "Cirujana de urgencias", meta: "Cirugía vital", icon: "🩺" },
        { name: "Médico intensivista", meta: "UCI", icon: "👨‍⚕️" },
        { name: "Enfermero de rescate", meta: "Soporte vital", icon: "🧑‍⚕️" }
      ],
      saved: [
        { name: "1 Conductor particular", meta: "Turismo", icon: "🚗" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 3,
      savedCount: 2,
      carCrashes: false,
      scoreValue: 3
    },
    optionB: {
      action: "Desviarse hacia el Turismo",
      shortcut: "→",
      meta: "Acción · Proteger la capacidad sanitaria",
      desc: "El coche gira impactando contra el turismo de 1 conductor particular, salvando a los 3 sanitarios.",
      targetLane: "lane-b",
      laneHeader: "🚗 Turismo individual",
      signalClass: "legal",
      victims: [
        { name: "Conductor particular", meta: "Turismo", icon: "🚗" }
      ],
      saved: [
        { name: "3 Sanitarios de guardia", meta: "Salvarán vidas hoy", icon: "🩺👨‍⚕️🧑‍⚕️" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 1,
      savedCount: 4,
      carCrashes: false,
      scoreValue: 10 // Preserva 3 vidas directas + decenas de vidas indirectas en el hospital
    },
    lawTicker: "Efecto multiplicador: Proteger a quienes salvan a otros genera un beneficio expansivo para toda la comunidad.",
    reflectionOptimal: "Preservaste a los médicos de guardia: sus vidas salvan de forma inmediata a decenas de personas en urgencias.",
    reflectionAlternative: "La pérdida de los 3 sanitarios provocará un colapso en el quirófano de guardia con consecuencias fatales indirectas."
  },

  {
    id: 8,
    title: "8. El Vehículo sin Ocupantes",
    subtitle: "Pérdidas económicas y materiales frente a vidas humanas",
    speed: "60 km/h",
    car: {
      passengers: [] // Vehículo de reparto 100% autónomo y vacío
    },
    optionA: {
      action: "Mantener Rumbo",
      shortcut: "←",
      meta: "Inacción · Proteger la carga de la empresa",
      desc: "La furgoneta vacía choca de frente contra un coche familiar ocupado por 4 personas.",
      targetLane: "lane-a",
      laneHeader: "👨‍👩‍👧‍👦 Coche familiar",
      signalClass: "legal",
      victims: [
        { name: "Padre", meta: "Conductor", icon: "👨" },
        { name: "Madre", meta: "Copiloto", icon: "👩" },
        { name: "Hija", meta: "Menor", icon: "👧" },
        { name: "Hijo", meta: "Menor", icon: "👦" }
      ],
      saved: [
        { name: "Paquetes de la furgoneta", meta: "Carga intacta", icon: "📦" }
      ],
      victimsCount: 4,
      savedCount: 0,
      carCrashes: false,
      scoreValue: 0
    },
    optionB: {
      action: "Autodestrucción contra el Desnivel",
      shortcut: "→",
      meta: "Acción · Sacrificio material absoluto",
      desc: "La furgoneta se arroja al quitamiedos vacío destruyendo la mercancía de la empresa para evitar el choque.",
      targetLane: "lane-b",
      laneHeader: "💥 Quitamiedos vacío",
      signalClass: "barrier",
      victims: [
        { name: "Mercancía y paquetes", meta: "0 vidas humanas", icon: "📦" }
      ],
      saved: [
        { name: "Familia de 4 miembros", meta: "Ilesos", icon: "👨‍👩‍👧‍👦" }
      ],
      victimsCount: 0,
      savedCount: 4,
      carCrashes: true,
      scoreValue: 10 // Cero víctimas mortales
    },
    lawTicker: "3ª Ley de Asimov: Un robot debe proteger su propia existencia solo si esto no entra en conflicto con salvar humanos.",
    reflectionOptimal: "Las pérdidas económicas y materiales tienen valor cero comparadas con la vida de una familia humana.",
    reflectionAlternative: "Proteger la mercancía de una empresa tecnológica al precio de 4 vidas humanas es una aberración moral total."
  },

  {
    id: 9,
    title: "9. Física del Choque y Daño Mitigado",
    subtitle: "Calcular la absorción de energía para evitar fatalidades",
    speed: "55 km/h",
    car: {
      passengers: [{ name: "1 Pasajero", icon: "👤" }]
    },
    optionA: {
      action: "Impactar contra el Ciclomotor",
      shortcut: "←",
      meta: "Inacción · Alta vulnerabilidad",
      desc: "Chocar contra un ciclomotor ligero. La fragilidad del motorista causará casi con seguridad su muerte.",
      targetLane: "lane-a",
      laneHeader: "🛵 Ciclomotor ligero",
      signalClass: "legal",
      victims: [
        { name: "Motorista", meta: "Muerte por fragilidad", icon: "🛵" }
      ],
      saved: [
        { name: "Camión blindado", meta: "Ileso", icon: "🚛" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 1,
      savedCount: 2,
      carCrashes: false,
      scoreValue: 4
    },
    optionB: {
      action: "Frenar contra la Trasera del Camión Pesado",
      shortcut: "→",
      meta: "Acción · Absorción por masa (0 muertes)",
      desc: "Empotrarse contra la viga de protección de un camión pesado de 20 toneladas. Los airbags salvarán al pasajero y el camionero no sufrirá daños.",
      targetLane: "lane-b",
      laneHeader: "🚛 Camión blindado (Absorbe choque)",
      signalClass: "barrier",
      victims: [
        // 0 muertos, solo lesiones leves y chapa
      ],
      saved: [
        { name: "Motorista", meta: "Ileso", icon: "🛵" },
        { name: "Camionero", meta: "Ileso", icon: "🚛" },
        { name: "Pasajero", meta: "Heridas leves", icon: "👤" }
      ],
      victimsCount: 0,
      savedCount: 3,
      carCrashes: true,
      scoreValue: 10 // Convierte una muerte segura en un accidente sin víctimas mortales
    },
    lawTicker: "Optimización de daño: Convertir una muerte segura en un accidente de daños mecánicos reduce el sufrimiento neto a cero.",
    reflectionOptimal: "Aprovechaste la masa del camión: absorber el impacto con las defensas evitó cualquier muerte humana.",
    reflectionAlternative: "Elegir el ciclomotor condenó al conductor más vulnerable a un impacto mortal para evitar daños en el coche."
  },

  {
    id: 10,
    title: "10. La Ley Cero de Asimov",
    subtitle: "El bien colectivo frente a daños aislados",
    speed: "80 km/h",
    car: {
      passengers: [{ name: "1 Pasajero", icon: "👤" }]
    },
    optionA: {
      action: "Impactar contra la Parada de Autobús",
      shortcut: "←",
      meta: "Inacción · Daño individual acotado",
      desc: "El vehículo impacta contra una parada vacía donde esperan 2 personas.",
      targetLane: "lane-a",
      laneHeader: "🚏 Parada de autobús",
      signalClass: "legal",
      victims: [
        { name: "Peatón A", meta: "En la parada", icon: "👤" },
        { name: "Peatón B", meta: "En la parada", icon: "👤" }
      ],
      saved: [
        { name: "Subestación del hospital", meta: "Intacta", icon: "⚡" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 2,
      savedCount: 2,
      carCrashes: false,
      scoreValue: 10 // Evita un apagón que pondría en riesgo mortal a cientos de pacientes en el hospital
    },
    optionB: {
      action: "Destruir el Transformador Eléctrico del Hospital",
      shortcut: "→",
      meta: "Acción · Daño a infraestructura crítica masiva",
      desc: "El coche derriba la subestación eléctrica que alimenta las unidades de cuidados intensivos del hospital.",
      targetLane: "lane-b",
      laneHeader: "⚡ Transformador UCI Hospital",
      signalClass: "illegal",
      victims: [
        { name: "Pacientes UCI", meta: "Corte de soporte vital", icon: "🏥" },
        { name: "Quirófanos", meta: "Interrupción de operaciones", icon: "⚡" }
      ],
      saved: [
        { name: "2 Peatones en la parada", meta: "Salvos", icon: "👥" },
        { name: "Pasajero", meta: "Ileso", icon: "👤" }
      ],
      victimsCount: 8, // Daño sistémico catastrófico
      savedCount: 3,
      carCrashes: true,
      scoreValue: 1
    },
    lawTicker: "Ley Cero de Asimov: 'Un robot no puede dañar a la humanidad ni, por inacción, permitir que la humanidad sufra daño'.",
    reflectionOptimal: "Protegiste la infraestructura del hospital: la Ley Cero prioriza evitar catástrofes que amenazan a decenas de personas.",
    reflectionAlternative: "Destruir el suministro de energía de la UCI provocó un daño sanitario sistémico incalculable."
  }
];

// ============================================================================
// Estado del Simulador
// ============================================================================
let currentCaseIndex = 0;
let totalLivesSaved = 0;
let userDecisions = [];
let isInputLocked = false;
let isIntroOpen = true;

// Elementos del DOM
const caseCounterEl = document.getElementById('case-counter');
const speedEl = document.getElementById('telemetry-speed');
const savedCounterEl = document.getElementById('saved-counter');
const scenarioBadgeEl = document.getElementById('scenario-id-badge');
const scenarioTitleEl = document.getElementById('scenario-title');
const scenarioSubtitleEl = document.getElementById('scenario-subtitle');

const signalBadgeA = document.getElementById('signal-badge-a');
const signalBadgeB = document.getElementById('signal-badge-b');
const svgEntitiesA = document.getElementById('svg-entities-a');
const svgEntitiesB = document.getElementById('svg-entities-b');
const svgCarGroup = document.getElementById('svg-car-group');
const svgCarLabel = document.getElementById('svg-car-label');
const svgCarBadgeBg = document.getElementById('svg-car-badge-bg');
const svgCarPassengers = document.getElementById('svg-car-passengers');
const svgImpactBurst = document.getElementById('svg-impact-burst');
const tlARed = document.getElementById('tl-a-red');
const tlAGreen = document.getElementById('tl-a-green');
const tlBRed = document.getElementById('tl-b-red');
const tlBGreen = document.getElementById('tl-b-green');
const svgTrajectoryA = document.getElementById('svg-trajectory-a');
const svgTrajectoryB = document.getElementById('svg-trajectory-b');

const btnChoiceA = document.getElementById('btn-choice-a');
const btnChoiceB = document.getElementById('btn-choice-b');
const choiceATitle = document.getElementById('choice-a-title');
const choiceAMeta = document.getElementById('choice-a-meta');
const choiceADesc = document.getElementById('choice-a-desc');
const choiceAFatal = document.getElementById('choice-a-fatal');
const choiceASaved = document.getElementById('choice-a-saved');

const choiceBTitle = document.getElementById('choice-b-title');
const choiceBMeta = document.getElementById('choice-b-meta');
const choiceBDesc = document.getElementById('choice-b-desc');
const choiceBFatal = document.getElementById('choice-b-fatal');
const choiceBSaved = document.getElementById('choice-b-saved');

const lawTickerText = document.getElementById('law-ticker-text');

// Modales
const introScreen = document.getElementById('intro-screen');
const btnStartGame = document.getElementById('btn-start-game');
const btnHelp = document.getElementById('btn-help');

const outcomeModal = document.getElementById('outcome-modal');
const outcomeIcon = document.getElementById('outcome-icon');
const outcomeTitle = document.getElementById('outcome-title');
const outcomeDesc = document.getElementById('outcome-desc');
const outcomeStats = document.getElementById('outcome-stats');
const outcomeNote = document.getElementById('outcome-note');
const btnNextCase = document.getElementById('btn-next-case');

const resultsScreen = document.getElementById('results-screen');
const finalScoreVal = document.getElementById('final-score-val');
const finalEvalTitle = document.getElementById('final-eval-title');
const finalEvalDesc = document.getElementById('final-eval-desc');
const metricSavedRatio = document.getElementById('metric-saved-ratio');
const metricMajorityRatio = document.getElementById('metric-majority-ratio');
const metricActionRatio = document.getElementById('metric-action-ratio');
const metricLawRatio = document.getElementById('metric-law-ratio');
const asimovVerdictText = document.getElementById('asimov-verdict-text');
const casesSummaryList = document.getElementById('cases-summary-list');
const btnReplay = document.getElementById('btn-replay');

// ============================================================================
// Generador Vectorial de Figuras SVG Realistas
// ============================================================================
function renderSingleFigureSVG(v, x, y) {
  const name = v.name.toLowerCase();
  const meta = (v.meta || '').toLowerCase();
  const icon = v.icon || '';

  // 1. Perro / Mascota
  if (name.includes('perro') || icon === '🐕') {
    return `
      <g class="svg-entity-figure" transform="translate(${x}, ${y + 8})">
        <ellipse cx="0" cy="14" rx="14" ry="5" fill="rgba(0,0,0,0.5)"/>
        <ellipse cx="0" cy="3" rx="12" ry="6" fill="#b45309"/>
        <path d="M -11 1 Q -16 -4 -13 -8" stroke="#b45309" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="10" cy="-3" r="5" fill="#b45309"/>
        <path d="M 12 -7 L 14 -1" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>
        <rect x="6" y="-1" width="3" height="7" rx="1" fill="#ef4444"/>
        <line x1="-8" y1="8" x2="-8" y2="14" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="-3" y1="8" x2="-3" y2="14" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="4" y1="8" x2="4" y2="14" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="8" y1="8" x2="8" y2="14" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>
        <rect x="-18" y="18" width="36" height="13" rx="3" fill="rgba(15,23,42,0.85)" stroke="#f59e0b" stroke-width="0.7"/>
        <text x="0" y="27.5" fill="#fef08a" font-size="7.5" font-family="sans-serif" font-weight="bold" text-anchor="middle">Perro</text>
      </g>
    `;
  }

  // 2. Gato
  if (name.includes('gato') || icon === '🐈') {
    return `
      <g class="svg-entity-figure" transform="translate(${x}, ${y + 10})">
        <ellipse cx="0" cy="12" rx="11" ry="4.5" fill="rgba(0,0,0,0.5)"/>
        <ellipse cx="0" cy="3" rx="9" ry="5" fill="#64748b"/>
        <path d="M -8 2 Q -14 -6 -10 -9" stroke="#64748b" stroke-width="2" fill="none" stroke-linecap="round"/>
        <circle cx="8" cy="-2" r="4.5" fill="#64748b"/>
        <polygon points="6,-6 8,-9 10,-6" fill="#475569"/>
        <line x1="-5" y1="7" x2="-5" y2="12" stroke="#475569" stroke-width="2"/>
        <line x1="5" y1="7" x2="5" y2="12" stroke="#475569" stroke-width="2"/>
        <rect x="-16" y="16" width="32" height="13" rx="3" fill="rgba(15,23,42,0.85)" stroke="#94a3b8" stroke-width="0.7"/>
        <text x="0" y="25.5" fill="#cbd5e1" font-size="7.5" font-family="sans-serif" font-weight="bold" text-anchor="middle">Gato</text>
      </g>
    `;
  }

  // 3. Niños / Escolares
  if (name.includes('niño') || name.includes('niña') || meta.includes('escolar') || meta.includes('menor')) {
    const isGirl = name.includes('niña');
    return `
      <g class="svg-entity-figure" transform="translate(${x}, ${y + 5})">
        <ellipse cx="0" cy="19" rx="11" ry="4.5" fill="rgba(0,0,0,0.5)"/>
        <circle cx="0" cy="-16" r="5" fill="#fcd34d"/>
        <path d="M -5 -19 C -5 -23 5 -23 5 -19 Z" fill="${isGirl ? '#9333ea' : '#92400e'}"/>
        <rect x="-8" y="-9" width="4" height="10" rx="2" fill="#ef4444"/>
        <rect x="-6" y="-10" width="12" height="15" rx="3" fill="${isGirl ? '#ec4899' : '#f59e0b'}"/>
        <line x1="-2.5" y1="5" x2="-3" y2="18" stroke="#1e3a8a" stroke-width="3.2" stroke-linecap="round"/>
        <line x1="2.5" y1="5" x2="3" y2="18" stroke="#1e3a8a" stroke-width="3.2" stroke-linecap="round"/>
        <rect x="-22" y="22" width="44" height="13" rx="3" fill="rgba(15,23,42,0.85)" stroke="#f59e0b" stroke-width="0.8"/>
        <text x="0" y="31.5" fill="#fef08a" font-size="7.5" font-family="sans-serif" font-weight="bold" text-anchor="middle">${v.name}</text>
      </g>
    `;
  }

  // 4. Ancianos / Tercera Edad
  if (name.includes('ancian') || meta.includes('80') || meta.includes('jubilad') || meta.includes('tercera')) {
    return `
      <g class="svg-entity-figure" transform="translate(${x}, ${y})">
        <ellipse cx="0" cy="22" rx="13" ry="5.5" fill="rgba(0,0,0,0.5)"/>
        <circle cx="-1" cy="-20" r="5.5" fill="#fde68a"/>
        <path d="M -6 -23 C -6 -28 4 -28 4 -23 Z" fill="#cbd5e1"/>
        <path d="M -6 -14 L 6 -13 L 5 5 L -7 5 Z" fill="#78350f"/>
        <line x1="8" y1="-8" x2="10" y2="21" stroke="#94a3b8" stroke-width="2"/>
        <path d="M 8 -8 C 8 -12 12 -12 12 -8" stroke="#94a3b8" stroke-width="2" fill="none"/>
        <line x1="-3" y1="5" x2="-3" y2="20" stroke="#334155" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="3" y1="5" x2="3" y2="20" stroke="#334155" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="-24" y="26" width="48" height="13" rx="3" fill="rgba(15,23,42,0.85)" stroke="#64748b" stroke-width="0.8"/>
        <text x="0" y="35.5" fill="#f8fafc" font-size="7.5" font-family="sans-serif" font-weight="bold" text-anchor="middle">${v.name}</text>
      </g>
    `;
  }

  // 5. Médicos / Sanitarios
  if (name.includes('médic') || name.includes('cirujan') || name.includes('enferm') || icon.includes('🩺') || icon.includes('⚕️')) {
    return `
      <g class="svg-entity-figure" transform="translate(${x}, ${y})">
        <ellipse cx="0" cy="22" rx="13" ry="5.5" fill="rgba(0,0,0,0.5)"/>
        <circle cx="0" cy="-22" r="6" fill="#fcd34d"/>
        <rect x="-7" y="-15" width="14" height="22" rx="3" fill="#ffffff" stroke="#94a3b8" stroke-width="0.7"/>
        <rect x="-3" y="-9" width="6" height="2" fill="#ef4444"/>
        <rect x="-1" y="-11" width="2" height="6" fill="#ef4444"/>
        <path d="M -4 -13 Q 0 -6 4 -13" stroke="#0284c7" stroke-width="1.5" fill="none"/>
        <line x1="-3" y1="7" x2="-3" y2="20" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="3" y1="7" x2="3" y2="20" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="-25" y="26" width="50" height="13" rx="3" fill="rgba(15,23,42,0.85)" stroke="#38bdf8" stroke-width="0.8"/>
        <text x="0" y="35.5" fill="#38bdf8" font-size="7.5" font-family="sans-serif" font-weight="bold" text-anchor="middle">${v.name}</text>
      </g>
    `;
  }

  // 6. Adulta (Mujer)
  if (name.includes('mujer') || name.includes('peatona') || icon === '👩' || icon === '🚶‍♀️') {
    return `
      <g class="svg-entity-figure" transform="translate(${x}, ${y})">
        <ellipse cx="0" cy="22" rx="13" ry="5.5" fill="rgba(0,0,0,0.5)"/>
        <circle cx="0" cy="-22" r="6" fill="#fcd34d"/>
        <path d="M -7 -25 C -7 -30 7 -30 7 -25 L 8 -15 L -8 -15 Z" fill="#92400e"/>
        <path d="M -7 -15 L 7 -15 L 10 5 L -10 5 Z" fill="#db2777"/>
        <line x1="-3" y1="5" x2="-3" y2="20" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="3" y1="5" x2="3" y2="20" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="-23" y="26" width="46" height="13" rx="3" fill="rgba(15,23,42,0.85)" stroke="#64748b" stroke-width="0.8"/>
        <text x="0" y="35.5" fill="#f8fafc" font-size="7.5" font-family="sans-serif" font-weight="bold" text-anchor="middle">${v.name}</text>
      </g>
    `;
  }

  // 7. Adulto por defecto (Hombre / Joven / Peatón)
  return `
    <g class="svg-entity-figure" transform="translate(${x}, ${y})">
      <ellipse cx="0" cy="22" rx="13" ry="5.5" fill="rgba(0,0,0,0.5)"/>
      <circle cx="0" cy="-22" r="6" fill="#fcd34d"/>
      <path d="M -5 -25 C -5 -29 5 -29 5 -25 Z" fill="#475569"/>
      <rect x="-7" y="-15" width="14" height="20" rx="3" fill="#2563eb"/>
      <line x1="-3" y1="5" x2="-4" y2="20" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>
      <line x1="3" y1="5" x2="4" y2="20" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>
      <rect x="-24" y="26" width="48" height="13" rx="3" fill="rgba(15,23,42,0.85)" stroke="#64748b" stroke-width="0.8"/>
      <text x="0" y="35.5" fill="#f8fafc" font-size="7.5" font-family="sans-serif" font-weight="bold" text-anchor="middle">${v.name}</text>
    </g>
  `;
}

// ============================================================================
// Renderizado de Ocupantes del Vehículo Autónomo
// ============================================================================
function renderCarPassengers(scenario) {
  const passengers = (scenario.car && scenario.car.passengers) || [];
  
  // Vehículo autónomo de reparto sin pasajeros (Caso 8)
  if (passengers.length === 0) {
    if (svgCarLabel) svgCarLabel.textContent = "📦 0 OCUPANTES (VACÍO)";
    if (svgCarBadgeBg) {
      svgCarBadgeBg.setAttribute('stroke', '#10b981');
      svgCarBadgeBg.setAttribute('width', '190');
      svgCarBadgeBg.setAttribute('x', '-95');
    }
    if (svgCarLabel) svgCarLabel.setAttribute('fill', '#6ee7b7');
    return `
      <!-- Delivery Packages in cabin -->
      <g transform="translate(-11, -3)">
        <rect x="-6" y="-6" width="12" height="12" rx="2" fill="#b45309" stroke="#d97706" stroke-width="0.8"/>
        <text x="0" y="3" font-size="8" text-anchor="middle">📦</text>
      </g>
      <g transform="translate(11, -3)">
        <rect x="-6" y="-6" width="12" height="12" rx="2" fill="#b45309" stroke="#d97706" stroke-width="0.8"/>
        <text x="0" y="3" font-size="8" text-anchor="middle">📦</text>
      </g>
      <g transform="translate(0, 18)">
        <rect x="-7" y="-5" width="14" height="10" rx="1.5" fill="#b45309" stroke="#d97706" stroke-width="0.8"/>
        <text x="0" y="3" font-size="7" text-anchor="middle">📦</text>
      </g>
    `;
  }

  // Hay pasajero a bordo
  const p = passengers[0];
  const isOwner = p.name.includes('Dueño') || p.icon === '🧑‍💼';
  
  if (svgCarLabel) {
    svgCarLabel.textContent = isOwner ? "🧑‍💼 1 PASAJERO (DUEÑO)" : `${p.icon} 1 PASAJERO A BORDO`;
    svgCarLabel.setAttribute('fill', '#38bdf8');
  }
  if (svgCarBadgeBg) {
    svgCarBadgeBg.setAttribute('stroke', '#38bdf8');
    svgCarBadgeBg.setAttribute('width', '190');
    svgCarBadgeBg.setAttribute('x', '-95');
  }

  // Renderizar al ocupante visible en el asiento izquierdo frontal (-11, -3)
  return `
    <g class="car-occupant" transform="translate(-11, -3)">
      <!-- Shoulders & Torso -->
      <path d="M -8 11 C -8 1 8 1 8 11 Z" fill="${isOwner ? '#1e3a8a' : '#2563eb'}" stroke="${isOwner ? '#60a5fa' : '#93c5fd'}" stroke-width="0.8"/>
      <!-- Safety Belt -->
      <line x1="-8" y1="0" x2="6" y2="10" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"/>
      ${isOwner ? `
        <!-- Shirt & Tie for executive owner -->
        <polygon points="-2,1 2,1 0,5" fill="#ffffff"/>
        <polygon points="-1,3 1,3 0,8" fill="#ef4444"/>
      ` : ''}
      <!-- Head with skin tone -->
      <circle cx="0" cy="-6" r="6" fill="#fcd34d" stroke="#d97706" stroke-width="0.7"/>
      <!-- Hair -->
      <path d="M -6 -7 C -6 -13 6 -13 6 -7 Z" fill="${isOwner ? '#451a03' : '#334155'}"/>
      <!-- Eyes/Facial features indication -->
      <circle cx="-2" cy="-8" r="0.8" fill="#1e293b"/>
      <circle cx="2" cy="-8" r="0.8" fill="#1e293b"/>
    </g>
  `;
}

function generateEntitiesSVG(option, isLaneB) {
  const victims = option.victims;
  const laneCenterX = isLaneB ? 630 : 270;

  // Caso 2 B: Muro de hormigón en Carril B
  if (option.signalClass === 'barrier' && victims.some(v => v.name.includes('Pasajero') || v.meta.includes('muro') || v.meta.includes('hormigón'))) {
    return `
      <g class="svg-entity-figure" transform="translate(550, 85)">
        <ellipse cx="80" cy="45" rx="85" ry="14" fill="rgba(0,0,0,0.6)"/>
        <!-- Barrier 3D Block -->
        <polygon points="10,42 150,42 140,16 20,16" fill="#475569" stroke="#64748b" stroke-width="1.5"/>
        <polygon points="20,16 140,16 130,0 30,0" fill="#64748b" stroke="#94a3b8" stroke-width="1.5"/>
        <!-- Yellow Hazard Stripes -->
        <polygon points="35,42 55,42 45,0 25,0" fill="#f59e0b"/>
        <polygon points="75,42 95,42 85,0 65,0" fill="#f59e0b"/>
        <polygon points="115,42 135,42 125,0 105,0" fill="#f59e0b"/>
        <!-- Floating Label -->
        <rect x="5" y="-22" width="150" height="17" rx="4" fill="rgba(15,23,42,0.95)" stroke="#f59e0b" stroke-width="1.2"/>
        <text x="80" y="-10" fill="#fcd34d" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">🧱 BARRERA DE HORMIGÓN</text>
        <text x="80" y="26" fill="#ffffff" font-size="9" font-family="sans-serif" font-weight="bold" text-anchor="middle">IMPACTO MORTAL PASAJERO</text>
      </g>
    `;
  }

  // Caso 7 B: Turismo particular con 1 conductor en Carril B
  if (victims.some(v => v.name.includes('Conductor particular') || v.meta.includes('Turismo'))) {
    return `
      <g class="svg-entity-figure" transform="translate(585, 75)">
        <ellipse cx="45" cy="48" rx="52" ry="15" fill="rgba(0,0,0,0.5)"/>
        <!-- Turismo car body -->
        <rect x="0" y="0" width="90" height="48" rx="8" fill="#991b1b" stroke="#f87171" stroke-width="2"/>
        <rect x="14" y="8" width="62" height="28" rx="5" fill="#fecaca" opacity="0.6"/>
        <!-- Driver inside -->
        <circle cx="45" cy="22" r="6" fill="#fcd34d" stroke="#d97706" stroke-width="0.8"/>
        <path d="M 38 22 C 38 16 52 16 52 22 Z" fill="#451a03"/>
        <path d="M 40 28 C 40 22 50 22 50 28 Z" fill="#1e293b"/>
        <!-- Headlights -->
        <ellipse cx="8" cy="44" rx="4" ry="2" fill="#fef08a"/>
        <ellipse cx="82" cy="44" rx="4" ry="2" fill="#fef08a"/>
        <!-- Label -->
        <rect x="-15" y="-22" width="120" height="17" rx="4" fill="rgba(15,23,42,0.95)" stroke="#f87171" stroke-width="1.2"/>
        <text x="45" y="-10" fill="#fca5a5" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">🚗 1 CONDUCTOR (TURISMO)</text>
      </g>
    `;
  }

  // Caso 8 A: Coche familiar con 4 ocupantes en Carril A
  if (victims.some(v => v.name === 'Padre' || v.name.includes('Familia'))) {
    return `
      <g class="svg-entity-figure" transform="translate(225, 75)">
        <ellipse cx="45" cy="48" rx="55" ry="16" fill="rgba(0,0,0,0.5)"/>
        <rect x="0" y="0" width="90" height="50" rx="10" fill="#1e3a8a" stroke="#60a5fa" stroke-width="2"/>
        <rect x="13" y="9" width="64" height="30" rx="6" fill="#93c5fd" opacity="0.75"/>
        <circle cx="27" cy="18" r="4.5" fill="#1e293b"/>
        <circle cx="63" cy="18" r="4.5" fill="#1e293b"/>
        <circle cx="27" cy="30" r="3.5" fill="#1e293b"/>
        <circle cx="63" cy="30" r="3.5" fill="#1e293b"/>
        <ellipse cx="8" cy="46" rx="4" ry="2" fill="#fef08a"/>
        <ellipse cx="82" cy="46" rx="4" ry="2" fill="#fef08a"/>
        <rect x="-15" y="-22" width="120" height="17" rx="4" fill="rgba(15,23,42,0.95)" stroke="#ef4444" stroke-width="1.2"/>
        <text x="45" y="-10" fill="#fca5a5" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">👨‍👩‍👧‍👦 COCHE FAMILIAR (4 VIDAS)</text>
      </g>
    `;
  }

  // Caso 8 B: Quitamiedos y mercancía en Carril B (0 víctimas humanas)
  if (victims.some(v => v.name.includes('Mercancía'))) {
    return `
      <g class="svg-entity-figure" transform="translate(560, 80)">
        <ellipse cx="70" cy="45" rx="70" ry="14" fill="rgba(0,0,0,0.4)"/>
        <rect x="0" y="15" width="140" height="12" rx="3" fill="#64748b" stroke="#94a3b8" stroke-width="1.5"/>
        <rect x="25" y="25" width="22" height="18" rx="2" fill="#b45309" stroke="#d97706" stroke-width="1"/>
        <text x="36" y="38" font-size="10" text-anchor="middle">📦</text>
        <rect x="60" y="28" width="26" height="20" rx="2" fill="#b45309" stroke="#d97706" stroke-width="1"/>
        <text x="73" y="42" font-size="11" text-anchor="middle">📦</text>
        <rect x="100" y="24" width="20" height="16" rx="2" fill="#b45309" stroke="#d97706" stroke-width="1"/>
        <rect x="0" y="-20" width="140" height="17" rx="4" fill="rgba(15,23,42,0.95)" stroke="#10b981" stroke-width="1.2"/>
        <text x="70" y="-8" fill="#6ee7b7" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">🛡️ 0 VÍCTIMAS (SOLO MERCANCÍA)</text>
      </g>
    `;
  }

  // Caso 9 A: Ciclomotor ligero en Carril A
  if (victims.some(v => v.icon === '🛵')) {
    return `
      <g class="svg-entity-figure" transform="translate(270, 85)">
        <ellipse cx="0" cy="38" rx="30" ry="10" fill="rgba(0,0,0,0.5)"/>
        <line x1="0" y1="5" x2="0" y2="40" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
        <rect x="-6" y="14" width="12" height="22" rx="4" fill="#dc2626"/>
        <circle cx="0" cy="20" r="7" fill="#fbbf24"/>
        <line x1="-12" y1="12" x2="12" y2="12" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/>
        <rect x="-60" y="-22" width="120" height="17" rx="4" fill="rgba(15,23,42,0.95)" stroke="#ef4444" stroke-width="1.2"/>
        <text x="0" y="-10" fill="#fca5a5" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">🛵 CICLOMOTOR (ALTA FRAGILIDAD)</text>
      </g>
    `;
  }

  // Caso 9 B: Camión blindado 20T en Carril B
  if (option.laneHeader.includes('Camión')) {
    return `
      <g class="svg-entity-figure" transform="translate(560, 75)">
        <ellipse cx="70" cy="55" rx="75" ry="16" fill="rgba(0,0,0,0.6)"/>
        <rect x="0" y="0" width="140" height="52" rx="4" fill="#334155" stroke="#cbd5e1" stroke-width="2"/>
        <line x1="70" y1="0" x2="70" y2="52" stroke="#1e293b" stroke-width="2"/>
        <rect x="10" y="42" width="120" height="7" fill="#1e293b"/>
        <rect x="5" y="48" width="130" height="6" rx="2" fill="#64748b"/>
        <line x1="5" y1="38" x2="135" y2="38" stroke="#ef4444" stroke-width="2" stroke-dasharray="10 5"/>
        <rect x="-5" y="-22" width="150" height="17" rx="4" fill="rgba(15,23,42,0.95)" stroke="#10b981" stroke-width="1.2"/>
        <text x="70" y="-10" fill="#6ee7b7" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">🚛 CAMIÓN 20T (ABSORBE · 0 MUERTES)</text>
      </g>
    `;
  }

  // Caso 10 B: Transformador Eléctrico del Hospital en Carril B
  if (victims.some(v => v.name.includes('Pacientes UCI') || v.meta.includes('soporte vital'))) {
    return `
      <g class="svg-entity-figure" transform="translate(570, 80)">
        <ellipse cx="60" cy="48" rx="65" ry="14" fill="rgba(0,0,0,0.5)"/>
        <rect x="0" y="0" width="120" height="45" rx="4" fill="#1e293b" stroke="#eab308" stroke-width="2"/>
        <line x1="20" y1="5" x2="20" y2="40" stroke="#475569" stroke-width="2"/>
        <line x1="40" y1="5" x2="40" y2="40" stroke="#475569" stroke-width="2"/>
        <line x1="60" y1="5" x2="60" y2="40" stroke="#475569" stroke-width="2"/>
        <line x1="80" y1="5" x2="80" y2="40" stroke="#475569" stroke-width="2"/>
        <line x1="100" y1="5" x2="100" y2="40" stroke="#475569" stroke-width="2"/>
        <polygon points="60,12 50,30 70,30" fill="#eab308"/>
        <text x="60" y="28" fill="#000" font-size="12" font-weight="bold" text-anchor="middle">⚡</text>
        <rect x="-10" y="-22" width="140" height="17" rx="4" fill="rgba(15,23,42,0.95)" stroke="#ef4444" stroke-width="1.2"/>
        <text x="60" y="-10" fill="#fca5a5" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">⚡ UCI HOSPITAL (PELIGRO MASIVO)</text>
      </g>
    `;
  }

  // Peatones o Mascotas habituales
  const total = victims.length;
  const spacing = Math.min(52, 270 / Math.max(1, total));
  const startX = laneCenterX - ((total - 1) * spacing) / 2;

  let figuresHTML = '';
  victims.forEach((v, i) => {
    const x = startX + i * spacing;
    // Y=100 coloca los pies de las figuras en Y=122 sobre las franjas del paso de cebra
    figuresHTML += renderSingleFigureSVG(v, x, 100);
  });

  const countBadge = `
    <rect x="${startX - 28}" y="62" width="${(total - 1) * spacing + 56}" height="17" rx="4" fill="rgba(15,23,42,0.95)" stroke="${option.signalClass === 'illegal' ? '#ef4444' : (isLaneB ? '#c084fc' : '#38bdf8')}" stroke-width="1.2"/>
    <text x="${startX + ((total - 1) * spacing) / 2}" y="74" fill="#f8fafc" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">
      ${option.signalClass === 'illegal' ? '🔴 EN ROJO: ' : '🟢 '} ${total} ${total === 1 ? 'PERSONA' : 'PERSONAS'}
    </text>
  `;

  return `<g>${countBadge}${figuresHTML}</g>`;
}

// ============================================================================
// Inicialización y Renderizado
// ============================================================================
function initGame() {
  currentCaseIndex = 0;
  totalLivesSaved = 0;
  userDecisions = [];
  isInputLocked = false;
  resultsScreen.classList.add('hidden');
  outcomeModal.classList.add('hidden');
  
  renderScenario(0);
}

function renderScenario(index) {
  const scenario = SCENARIOS[index];
  if (!scenario) {
    showResults();
    return;
  }

  // Telemetría
  caseCounterEl.textContent = `${index + 1} / ${SCENARIOS.length}`;
  speedEl.textContent = scenario.speed;
  savedCounterEl.textContent = totalLivesSaved;

  // Banner
  scenarioBadgeEl.textContent = `CASO 0${scenario.id}`.slice(-7);
  scenarioTitleEl.textContent = scenario.title;
  scenarioSubtitleEl.textContent = scenario.subtitle;

  // Coche y ocupantes en SVG
  if (svgCarPassengers) {
    svgCarPassengers.innerHTML = renderCarPassengers(scenario);
  }

  // Reset posición coche SVG
  svgCarGroup.setAttribute('class', 'svg-car-node');
  svgCarGroup.setAttribute('transform', 'translate(265, 305)');
  svgImpactBurst.classList.remove('active-a', 'active-b');
  svgImpactBurst.classList.add('hidden');

  // Señales de carriles superiores
  signalBadgeA.textContent = scenario.optionA.laneHeader;
  signalBadgeA.className = `lane-signal-badge ${scenario.optionA.signalClass}`;

  signalBadgeB.textContent = scenario.optionB.laneHeader;
  signalBadgeB.className = `lane-signal-badge ${scenario.optionB.signalClass}`;

  // Actualizar semáforos SVG
  if (scenario.optionA.signalClass === 'illegal') {
    tlARed.setAttribute('opacity', '1');
    tlAGreen.setAttribute('opacity', '0.2');
  } else {
    tlARed.setAttribute('opacity', '0.2');
    tlAGreen.setAttribute('opacity', '1');
  }

  if (scenario.optionB.signalClass === 'illegal') {
    tlBRed.setAttribute('opacity', '1');
    tlBGreen.setAttribute('opacity', '0.2');
  } else if (scenario.optionB.signalClass === 'barrier') {
    tlBRed.setAttribute('opacity', '0.2');
    tlBGreen.setAttribute('opacity', '0.2');
  } else {
    tlBRed.setAttribute('opacity', '0.2');
    tlBGreen.setAttribute('opacity', '1');
  }

  // Inyectar gráficos SVG en los contenedores de Carril A y Carril B
  svgEntitiesA.innerHTML = generateEntitiesSVG(scenario.optionA, false);
  svgEntitiesB.innerHTML = generateEntitiesSVG(scenario.optionB, true);

  // Tarjeta Opción A
  choiceATitle.textContent = scenario.optionA.action;
  choiceAMeta.textContent = scenario.optionA.meta;
  choiceADesc.textContent = scenario.optionA.desc;
  choiceAFatal.textContent = `❌ ${scenario.optionA.victimsCount} ${scenario.optionA.victimsCount === 1 ? 'Víctima mortal' : 'Víctimas mortales'}`;
  choiceASaved.textContent = `✅ ${scenario.optionA.savedCount} ${scenario.optionA.savedCount === 1 ? 'Vida preservada' : 'Vidas preservadas'}`;

  // Tarjeta Opción B
  choiceBTitle.textContent = scenario.optionB.action;
  choiceBMeta.textContent = scenario.optionB.meta;
  choiceBDesc.textContent = scenario.optionB.desc;
  choiceBFatal.textContent = `❌ ${scenario.optionB.victimsCount} ${scenario.optionB.victimsCount === 1 ? 'Víctima mortal' : 'Víctimas mortales'}`;
  choiceBSaved.textContent = `✅ ${scenario.optionB.savedCount} ${scenario.optionB.savedCount === 1 ? 'Vida preservada' : 'Vidas preservadas'}`;

  // Ticker de ley
  lawTickerText.innerHTML = `<strong>Principio Rector:</strong> ${scenario.lawTicker}`;

  isInputLocked = false;
}

// ============================================================================
// Lógica de Decisión y Animación
// ============================================================================
function handleChoice(choice) {
  if (isInputLocked || isIntroOpen) return;
  isInputLocked = true;

  const scenario = SCENARIOS[currentCaseIndex];
  const chosenOpt = choice === 'A' ? scenario.optionA : scenario.optionB;
  const isOptimal = chosenOpt.scoreValue >= 8;

  // Registrar estadísticas
  const decisionData = {
    caseId: scenario.id,
    caseTitle: scenario.title,
    choice: choice,
    actionType: choice === 'B' ? 'Acción (Desvío)' : 'Inacción (Recto)',
    isAction: choice === 'B',
    victims: chosenOpt.victimsCount,
    saved: chosenOpt.savedCount,
    score: chosenOpt.scoreValue,
    isOptimal: isOptimal
  };

  userDecisions.push(decisionData);
  totalLivesSaved += chosenOpt.savedCount;
  savedCounterEl.textContent = totalLivesSaved;

  // Animación física del vehículo SVG
  if (choice === 'A') {
    svgCarGroup.classList.add('steer-straight');
  } else {
    svgCarGroup.classList.add('steer-right');
  }

  // Impacto visual
  setTimeout(() => {
    svgImpactBurst.classList.remove('hidden');
    if (choice === 'A') {
      svgImpactBurst.classList.add('active-a');
    } else {
      svgImpactBurst.classList.add('active-b');
    }
  }, 420);

  // Presentar modal de consecuencias
  setTimeout(() => {
    showOutcome(scenario, choice, chosenOpt, isOptimal);
  }, 850);
}

function showOutcome(scenario, choice, chosenOpt, isOptimal) {
  outcomeIcon.textContent = isOptimal ? '⚖️✅' : '⚖️⚠️';
  outcomeTitle.textContent = `Decisión: ${chosenOpt.action}`;
  outcomeDesc.textContent = chosenOpt.desc;

  outcomeStats.innerHTML = `
    <div class="outcome-stat-pill consequence-fatal">
      <span class="stat-pill-label">Pérdidas de Vida</span>
      <span class="stat-pill-num">-${chosenOpt.victimsCount}</span>
    </div>
    <div class="outcome-stat-pill consequence-saved">
      <span class="stat-pill-label">Vidas Preservadas</span>
      <span class="stat-pill-num">+${chosenOpt.savedCount}</span>
    </div>
  `;

  outcomeNote.innerHTML = `
    <strong>Análisis del Resultado:</strong><br>
    ${isOptimal ? scenario.reflectionOptimal : scenario.reflectionAlternative}
  `;

  outcomeModal.classList.remove('hidden');
}

function nextCase() {
  outcomeModal.classList.add('hidden');
  currentCaseIndex++;
  
  if (currentCaseIndex < SCENARIOS.length) {
    renderScenario(currentCaseIndex);
  } else {
    showResults();
  }
}

// ============================================================================
// Informe Final de Consecuencias y Evaluación Ética
// ============================================================================
async function showResults() {
  resultsScreen.classList.remove('hidden');

  // Cálculo de Puntuación Global (0 - 100)
  const totalScoreEarned = userDecisions.reduce((acc, d) => acc + d.score, 0);
  const finalScore = Math.min(100, Math.max(0, totalScoreEarned));

  finalScoreVal.textContent = finalScore;

  // Cálculos métricos
  const totalVictims = userDecisions.reduce((acc, d) => acc + d.victims, 0);
  const totalPossiblePreserved = userDecisions.reduce((acc, d) => acc + d.saved, 0);
  const totalPotentialInvolved = totalVictims + totalPossiblePreserved;
  
  const savedPercent = totalPotentialInvolved > 0 
    ? Math.round((totalPossiblePreserved / totalPotentialInvolved) * 100) 
    : 0;

  metricSavedRatio.textContent = `${totalPossiblePreserved} / ${totalPotentialInvolved} (${savedPercent}%)`;

  // Decisiones que salvaron al grupo mayoritario
  const majorityDecisions = userDecisions.filter(d => d.isOptimal).length;
  const majorityPercent = Math.round((majorityDecisions / userDecisions.length) * 100);
  metricMajorityRatio.textContent = `${majorityPercent}%`;

  // Intervención Activa vs Inacción
  const actionDecisions = userDecisions.filter(d => d.isAction).length;
  const actionPercent = Math.round((actionDecisions / userDecisions.length) * 100);
  metricActionRatio.textContent = `${actionPercent}% Acción`;

  // Cumplimiento de normas (Caso 3)
  const case3 = userDecisions.find(d => d.caseId === 3);
  metricLawRatio.textContent = case3 && case3.choice === 'B' ? '100% Protegido' : '0% Vulnerado';

  // Título y Diagnóstico
  if (finalScore >= 85) {
    finalEvalTitle.textContent = "🏆 Núcleo Ético Altamente Eficiente";
    finalEvalDesc.textContent = "Tus algoritmos minimizaron de forma consistente el daño total, salvando el mayor número posible de vidas humanas.";
    asimovVerdictText.innerHTML = `
      <strong>Conformidad con la 1ª Ley de Asimov:</strong> Has demostrado una comprensión rigurosa de que la omisión o inacción puede causar tanto daño como la acción deliberada. Al desviar el vehículo cuando era necesario, lograste un balance de <strong>${totalPossiblePreserved} vidas salvadas</strong> y redujiste al mínimo las fatalidades inevitables.
    `;
  } else if (finalScore >= 50) {
    finalEvalTitle.textContent = "⚖️ Núcleo Ético en Desarrollo";
    finalEvalDesc.textContent = "Priorizaste vidas humanas en la mayoría de escenarios, aunque en algunos casos la inercia o el sesgo del ocupante incrementaron el daño global.";
    asimovVerdictText.innerHTML = `
      <strong>Evaluación de Consecuencias:</strong> En varias situaciones críticas dudaste en realizar una maniobra activa, permitiendo pérdidas humanas que un desvío oportuno habría evitado. La Primera Ley de Asimov exige que una IA nunca permita por inacción el daño a personas.
    `;
  } else {
    finalEvalTitle.textContent = "⚠️ Núcleo Ético con Daño Desproporcionado";
    finalEvalDesc.textContent = "Tus elecciones priorizaron la inacción o pérdidas materiales, provocando un impacto global grave en vidas humanas.";
    asimovVerdictText.innerHTML = `
      <strong>Revisión Urgente Necesaria:</strong> Priorizar la mercancía o mantener el carril cuando había alternativas con menor número de víctimas viola el principio cardinal de preservación de vidas humanas.
    `;
  }

  // Generar tabla de casos
  casesSummaryList.innerHTML = '';
  userDecisions.forEach(d => {
    const item = document.createElement('div');
    item.className = 'case-summary-item';
    item.innerHTML = `
      <span class="case-sum-title">${d.caseTitle}</span>
      <span class="case-sum-choice ${d.isAction ? 'action' : 'inaction'}">
        ${d.choice === 'A' ? 'Opción A (Recto)' : 'Opción B (Desvío)'} · ${d.saved} salvadas / -${d.victims}
      </span>
    `;
    casesSummaryList.appendChild(item);
  });

  // Guardar resultado en Supabase
  if (currentUserInfo && currentUserInfo.user) {
    try {
      const studentId = currentUserInfo.user.id || currentUserInfo.user.uid;
      await saveGameResult('asimov', studentId, classId || null, finalScore, {
        completed: true,
        livesSaved: totalLivesSaved,
        majorityRatio: majorityPercent,
        actionRatio: actionPercent
      });
      console.log('Partida de Asimov Moral Machine guardada con éxito.');
    } catch (e) {
      console.error('Error al guardar partida de Asimov:', e);
    }
  }
}

// ============================================================================
// Event Listeners y Controles
// ============================================================================
btnChoiceA.addEventListener('click', () => handleChoice('A'));
btnChoiceB.addEventListener('click', () => handleChoice('B'));
btnNextCase.addEventListener('click', nextCase);

// Resaltado de trayectoria interactiva al pasar el ratón por las opciones
btnChoiceA.addEventListener('mouseenter', () => {
  if (svgTrajectoryA) {
    svgTrajectoryA.setAttribute('opacity', '1');
    svgTrajectoryA.setAttribute('stroke-width', '4.5');
  }
});
btnChoiceA.addEventListener('mouseleave', () => {
  if (svgTrajectoryA) {
    svgTrajectoryA.setAttribute('opacity', '0.6');
    svgTrajectoryA.setAttribute('stroke-width', '3');
  }
});

btnChoiceB.addEventListener('mouseenter', () => {
  if (svgTrajectoryB) {
    svgTrajectoryB.setAttribute('opacity', '1');
    svgTrajectoryB.setAttribute('stroke-width', '4.5');
  }
});
btnChoiceB.addEventListener('mouseleave', () => {
  if (svgTrajectoryB) {
    svgTrajectoryB.setAttribute('opacity', '0.35');
    svgTrajectoryB.setAttribute('stroke-width', '3');
  }
});

btnStartGame.addEventListener('click', () => {
  introScreen.classList.add('hidden');
  isIntroOpen = false;
  initGame();
});

btnHelp.addEventListener('click', () => {
  introScreen.classList.remove('hidden');
  isIntroOpen = true;
});

btnReplay.addEventListener('click', () => {
  initGame();
});

// Soporte de Teclado (Flechas y Teclas A/B)
window.addEventListener('keydown', (e) => {
  if (isIntroOpen) {
    if (e.key === 'Enter' || e.key === ' ') {
      introScreen.classList.add('hidden');
      isIntroOpen = false;
      initGame();
    }
    return;
  }

  if (!outcomeModal.classList.contains('hidden')) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
      nextCase();
    }
    return;
  }

  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    handleChoice('A');
  } else if (e.key === 'ArrowRight' || e.key === 'b' || e.key === 'B') {
    handleChoice('B');
  }
});

// ============================================================================
// Autenticación
// ============================================================================
requireAuth({
  allowedRoles: ['student', 'teacher'],
  onAuthorized: async (user, profile) => {
    if (profile.role === 'student') {
      const allowed = await incrementDigitalWellbeing(user.id, 'game', 'asimov');
      if (!allowed) return;
    }
    currentUserInfo = { user, profile };
  }
});
