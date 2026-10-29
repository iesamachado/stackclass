// ============================================================
// cifrado.js — Lógica de cifrado/descifrado César y Vigenère
// ============================================================

const ALPHABET_ES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ─── Cifrado César ────────────────────────────────────────────
const Caesar = {
  /**
   * Cifra texto con César(n)
   * @param {string} text  - Texto original (mayúsculas)
   * @param {number} shift - Desplazamiento (1-25)
   * @returns {string} Texto cifrado
   */
  encrypt(text, shift) {
    shift = ((shift % 26) + 26) % 26;
    return text.toUpperCase().split('').map(ch => {
      const idx = ALPHABET_ES.indexOf(ch);
      return idx >= 0 ? ALPHABET_ES[(idx + shift) % 26] : ch;
    }).join('');
  },

  /**
   * Descifra texto César
   */
  decrypt(text, shift) {
    return this.encrypt(text, 26 - shift);
  },

  /**
   * Fuerza bruta: prueba todos los desplazamientos
   * @returns {Array<{shift, text}>}
   */
  bruteForce(cipherText) {
    return Array.from({ length: 26 }, (_, i) => ({
      shift: i,
      text:  this.decrypt(cipherText, i)
    }));
  }
};

// ─── Cifrado Vigenère ─────────────────────────────────────────
const Vigenere = {
  /**
   * Normaliza la clave: solo letras A-Z
   */
  normalizeKey(key) {
    return key.toUpperCase().replace(/[^A-Z]/g, '');
  },

  /**
   * Cifra texto con Vigenère
   * @param {string} text - Texto original
   * @param {string} key  - Clave (letras A-Z)
   */
  encrypt(text, key) {
    const normKey = this.normalizeKey(key);
    if (!normKey.length) return text;

    let keyIdx = 0;
    return text.toUpperCase().split('').map(ch => {
      const charIdx = ALPHABET_ES.indexOf(ch);
      if (charIdx < 0) return ch;
      const shift   = ALPHABET_ES.indexOf(normKey[keyIdx % normKey.length]);
      keyIdx++;
      return ALPHABET_ES[(charIdx + shift) % 26];
    }).join('');
  },

  /**
   * Descifra texto Vigenère
   */
  decrypt(text, key) {
    const normKey = this.normalizeKey(key);
    if (!normKey.length) return text;

    let keyIdx = 0;
    return text.toUpperCase().split('').map(ch => {
      const charIdx = ALPHABET_ES.indexOf(ch);
      if (charIdx < 0) return ch;
      const shift   = ALPHABET_ES.indexOf(normKey[keyIdx % normKey.length]);
      keyIdx++;
      return ALPHABET_ES[((charIdx - shift) + 26) % 26];
    }).join('');
  }
};

// ─── Análisis de Frecuencias ──────────────────────────────────
const FrequencyAnalyzer = {
  /**
   * Calcula frecuencias de letras en un texto
   * @param {string} text
   * @returns {Array<{char, count, percent}>} ordenado por frecuencia desc
   */
  analyze(text) {
    const counts = {};
    let total = 0;

    text.toUpperCase().split('').forEach(ch => {
      if (ALPHABET_ES.includes(ch)) {
        counts[ch] = (counts[ch] || 0) + 1;
        total++;
      }
    });

    return ALPHABET_ES.split('').map(ch => ({
      char:    ch,
      count:   counts[ch] || 0,
      percent: total > 0 ? ((counts[ch] || 0) / total * 100) : 0
    })).sort((a, b) => b.count - a.count);
  },

  /**
   * Frecuencias estándar del español (%)
   * Fuente: RAE / estudios lingüísticos
   */
  SPANISH_FREQS: {
    'E': 13.72, 'A': 12.53, 'O': 8.68, 'S': 7.98, 'N': 7.01,
    'R': 6.87,  'I': 6.25,  'L': 4.97, 'D': 4.63, 'T': 4.60,
    'U': 3.93,  'C': 3.88,  'M': 3.15, 'P': 2.51, 'B': 1.42,
    'G': 1.00,  'V': 0.90,  'Y': 0.90, 'Q': 0.88, 'H': 0.70,
    'F': 0.69,  'Z': 0.52,  'J': 0.44, 'X': 0.22, 'K': 0.01,
    'W': 0.01
  },

  /**
   * Sugiere sustituciones basadas en frecuencias
   * @param {string} cipherText
   * @returns {Object} mapa sugerido {charCifrado: charSugerido}
   */
  suggestSubstitutions(cipherText) {
    const cipherFreqs = this.analyze(cipherText);
    const spanishOrder = Object.entries(this.SPANISH_FREQS)
      .sort((a, b) => b[1] - a[1])
      .map(([ch]) => ch);

    const suggestions = {};
    cipherFreqs.forEach((item, idx) => {
      if (item.count > 0 && spanishOrder[idx]) {
        suggestions[item.char] = spanishOrder[idx];
      }
    });

    return suggestions;
  }
};

// ─── Aplicar sustitución manual ───────────────────────────────
function applySubstitution(cipherText, substitutionMap) {
  return cipherText.split('').map(ch => {
    const upper = ch.toUpperCase();
    if (substitutionMap[upper]) {
      return ch === upper ? substitutionMap[upper] : substitutionMap[upper].toLowerCase();
    }
    return ch;
  }).join('');
}

// ─── Verificar solución (client-side) ────────────────────────
function verifySolution(userAnswer, correctAnswer) {
  const normalize = s => s.toUpperCase().replace(/\s+/g, ' ').trim();
  return normalize(userAnswer) === normalize(correctAnswer);
}

// ─── Generar mensaje cifrado custom ──────────────────────────
function generateCipherMessage(textoOriginal, tipoCifrado, clave) {
  const texto = textoOriginal.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (tipoCifrado === 'caesar') {
    return Caesar.encrypt(texto, parseInt(clave));
  } else if (tipoCifrado === 'vigenere') {
    return Vigenere.encrypt(texto, clave.toString());
  }
  return texto;
}

// ─── Sugerir desplazamientos César probables ──────────────────
function suggestCaesarShifts(cipherText) {
  const freqs = FrequencyAnalyzer.analyze(cipherText);
  const topLetter = freqs[0]?.char; // letra más frecuente en el texto cifrado
  if (!topLetter) return [];
  const topIdx = ALPHABET_ES.indexOf(topLetter);
  // Si la letra más frecuente es la 'E' cifrada → shift = (topIdx - 4 + 26) % 26
  // Si es la 'A' cifrada → shift = topIdx
  const shiftIfE = ((topIdx - 4) + 26) % 26;
  const shiftIfA = topIdx;
  return [
    { shift: shiftIfE, reason: `"${topLetter}" es probablemente la E (más común en español)` },
    { shift: shiftIfA, reason: `"${topLetter}" es probablemente la A (2ª más común)` }
  ].filter((v, i, arr) => arr.findIndex(x => x.shift === v.shift) === i); // dedup
}

// ─── Ataque por texto conocido para Vigenère ──────────────────
// Dado un texto cifrado y una palabra que sospechamos está en él,
// calcula qué fragmento de clave produciría cada posición.
function knownPlaintextVigenere(cipherText, guessWord) {
  const clean = cipherText.toUpperCase().replace(/[^A-Z]/g, '');
  const guess = guessWord.toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean || !guess) return [];

  const results = [];
  for (let startPos = 0; startPos <= clean.length - guess.length; startPos++) {
    let keyFragment = '';
    let valid = true;
    for (let i = 0; i < guess.length; i++) {
      const cIdx = ALPHABET_ES.indexOf(clean[startPos + i]);
      const pIdx = ALPHABET_ES.indexOf(guess[i]);
      if (cIdx < 0 || pIdx < 0) { valid = false; break; }
      keyFragment += ALPHABET_ES[(cIdx - pIdx + 26) % 26];
    }
    if (valid) results.push({ position: startPos, keyFragment });
  }
  return results;
}

// ─── Alias directos para cifrado ──────────────────────────────
function cifrarCesar(texto, desplazamiento) {
  return Caesar.encrypt(texto, desplazamiento);
}

function cifrarVigenere(texto, clave) {
  return Vigenere.encrypt(texto, clave);
}

// ─── Pool de Mensajes por Defecto ─────────────────────────────
const MENSAJES_POOL = [
  // Fácil (César simple)
  {
    id: 'facil_1',
    tematica: 'Misión Secreta',
    nivelDificultad: 'facil',
    tipoCifrado: 'caesar',
    clave: 3,
    textoOriginal: 'EL CODIGO SECRETO HA SIDO DESCIFRADO CON EXITO',
    textoCifrado: 'HO FRGLJR VHFUHWR KD VLGR GHVFUIUDGR FRQ HALWR'
  },
  {
    id: 'facil_2',
    tematica: 'Ciberseguridad',
    nivelDificultad: 'facil',
    tipoCifrado: 'caesar',
    clave: 4,
    textoOriginal: 'PROTEGE SIEMPRE TUS CONTRASENAS CON CARACTERES SEGUROS',
    textoCifrado: 'TVSXIKI WMIQTVI XYW GSRXVEWIREW GSR GEVEGXIVIW WIKYVSW'
  },
  {
    id: 'facil_3',
    tematica: 'Base Espacial',
    nivelDificultad: 'facil',
    tipoCifrado: 'caesar',
    clave: 2,
    textoOriginal: 'LA ESTACION ESPACIAL RECIBE LA TRANSMISION DE DATOS',
    textoCifrado: 'NC GUVCEKQP GURCEKCN TGEKDG NC VTCPUOKUKQP FG FCVQU'
  },
  {
    id: 'facil_4',
    tematica: 'Inteligencia Digital',
    nivelDificultad: 'facil',
    tipoCifrado: 'caesar',
    clave: 5,
    textoOriginal: 'TODO SISTEMA INFORMATICO REQUIERE COPIAS DE SEGURIDAD',
    textoCifrado: 'YTIT XNXYJRF NSKTWRFYNHT WJVZNJWJ HUTNFX IJ XJLZWNIPI'
  },
  {
    id: 'facil_5',
    tematica: 'Redes Seguras',
    nivelDificultad: 'facil',
    tipoCifrado: 'caesar',
    clave: 3,
    textoOriginal: 'LA INFORMACION VIAJA ENCRIPTADA POR LA FIBRA OPTICA',
    textoCifrado: 'OD LQIRUPDFLRQ YLDMD HQFULSWDGD SRU OD ILEUD RSWLFD'
  },

  // Medio (César avanzado)
  {
    id: 'medio_1',
    tematica: 'Protocolo Enigma',
    nivelDificultad: 'medio',
    tipoCifrado: 'caesar',
    clave: 13,
    textoOriginal: 'EL ALGORITMO ROT13 DIVIDE EL ALFABETO POR LA MITAD',
    textoCifrado: 'RY NYTBEVGZB EBG13 QVIVQR RY NYSNORGB CBE YN ZVGNY'
  },
  {
    id: 'medio_2',
    tematica: 'Interceptación Lunar',
    nivelDificultad: 'medio',
    tipoCifrado: 'caesar',
    clave: 7,
    textoOriginal: 'LA BASE LUNAR NECESITA SUMINISTROS DE ENERGIA DE INMEDIATO',
    textoCifrado: 'SH IHZL SBUHY ULJLZPAH ZBTPUPZAYVZ KL LULYNPH KL PUTLKPHAV'
  },
  {
    id: 'medio_3',
    tematica: 'Criptografía Clásica',
    nivelDificultad: 'medio',
    tipoCifrado: 'caesar',
    clave: 11,
    textoOriginal: 'JULIO CESAR USABA ESTE METODO PARA MENSAJES MILITARES',
    textoCifrado: 'UFWTZ NPDLC FDLML PDEP XPEZOZ ALCL XPYDNUPD XTWTELCPD'
  },
  {
    id: 'medio_4',
    tematica: 'Defensa de Redes',
    nivelDificultad: 'medio',
    tipoCifrado: 'caesar',
    clave: 9,
    textoOriginal: 'EL CORTAFUEGOS DETECTO ACCESOS NO AUTORIZADOS EN EL SERVIDOR',
    textoCifrado: 'NU LXACJODNPXB MNCNLCX JLLNBXB WX JDCXARIJMXB NW NU BNAERMXA'
  },
  {
    id: 'medio_5',
    tematica: 'Frecuencias Ocultas',
    nivelDificultad: 'medio',
    tipoCifrado: 'caesar',
    clave: 14,
    textoOriginal: 'EL ANALISIS DE FRECUENCIAS REVELA LAS VOCALES MAS COMUNES',
    textoCifrado: 'SZ OBOZWGWG RS TFSQISBQWOG FSJSZO ZOG JCQOZSG TOG QCAIBSE'
  },

  // Difícil (Vigenère)
  {
    id: 'dificil_1',
    tematica: 'Clave Polialfabética',
    nivelDificultad: 'dificil',
    tipoCifrado: 'vigenere',
    clave: 'ROBOT',
    textoOriginal: 'LA CLAVE SECRETA ABRE TODAS LAS PUERTAS DEL SISTEMA CENTRAL',
    textoCifrado: 'CO DZTMS TSVISUO TSFF HHUOT ZT DVSVHVH RSP TKHVOAE DFBYEON'
  },
  {
    id: 'dificil_2',
    tematica: 'Agente Doble',
    nivelDificultad: 'dificil',
    tipoCifrado: 'vigenere',
    clave: 'ENIGMA',
    textoOriginal: 'EL AGENTE DOBLE ACTIVA EL PROTOCOLO DE DESCONEXION TOTAL',
    textoCifrado: 'IY IMQNXR LUNLI NKZUVE RT VDOXUSOYW HR JMGOUZILWUZ ACZOT'
  },
  {
    id: 'dificil_3',
    tematica: 'Criptoanálisis',
    nivelDificultad: 'dificil',
    tipoCifrado: 'vigenere',
    clave: 'CYBER',
    textoOriginal: 'UN MENSAJE CIFRADO CON VIGENERE RESISTE LA FUERZA BRUTA SIMPLE',
    textoCifrado: 'WL NIEUYKI TKDSEUQ APR MKEFRVT IILGJTF NC WYYTCX DTWYC JGNRNX'
  },
  {
    id: 'dificil_4',
    tematica: 'Redes Globales',
    nivelDificultad: 'dificil',
    tipoCifrado: 'vigenere',
    clave: 'STACK',
    textoOriginal: 'LOS SERVIDORES PRINCIPALES DE LA NUBE ESTAN RESTRINGIDOS',
    textoCifrado: 'DHS UOJOIFYJXS RBAGCKZSEEU NW DN VMNW WLVTC JEKLBVQSILOA'
  },
  {
    id: 'dificil_5',
    tematica: 'Copia de Respaldo',
    nivelDificultad: 'dificil',
    tipoCifrado: 'vigenere',
    clave: 'TOKEN',
    textoOriginal: 'LA SEGURIDAD EN INTERNET DEPENDE DE BUENOS PROTOCOLOS',
    textoCifrado: 'EO CITNFSHNW SX MAMSBRRM ROTRGQR HR PNRBFB IKHGHPIZHH'
  }
];

if (typeof window !== 'undefined') {
  window.cifrarCesar = cifrarCesar;
  window.cifrarVigenere = cifrarVigenere;
  window.MENSAJES_POOL = MENSAJES_POOL;
}
