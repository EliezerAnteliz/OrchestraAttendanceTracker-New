'use client';

/**
 * COMPONENTE DE FOTO + OCR
 * Usa Tesseract.js (gratuito) para leer texto de fotos
 * Fallback a búsqueda manual si OCR no funciona
 */

import { useState, useRef, useEffect } from 'react';
import { createWorker, PSM } from 'tesseract.js';
import { inventorySupabase } from '@/lib/inventorySupabaseClient';
import { MdClose, MdCameraAlt, MdSearch } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';


interface Asset {
  id: string;
  full_code: string | null;
  description: string;
  brand: string | null;
  serial_number: string | null;
  assigned_to_text: string | null;
  // Solo se llena en el candidato encontrado por código exacto de 16
  // dígitos (búsqueda global, sin filtrar por sede) — se usa para saber
  // si hay que reportar "found" o "mismatch_site" al seleccionarlo.
  current_program_id?: string;
}

interface PhotoOCRProps {
  sessionId: string;
  programId: string;
  onAssetSelected: (assetId: string, code: string, result: 'found' | 'mismatch_site', source: 'photo_assist') => void;
  onClose: () => void;
}

export default function PhotoOCR({ sessionId, programId, onAssetSelected, onClose }: PhotoOCRProps) {
  const { t } = useI18n();
  const [processing, setProcessing] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [candidates, setCandidates] = useState<Asset[]>([]);
  // Palabras/término usados para encontrar los candidatos actuales — se
  // usan para resaltar en cada tarjeta cuál dato fue el que hizo match,
  // así el usuario ve de un vistazo por qué apareció cada resultado.
  const [candidateHighlightTerms, setCandidateHighlightTerms] = useState<string[]>([]);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref "espejo" del stream — el efecto de limpieza al desmontar (más
  // abajo) solo corre una vez (deps=[]), así que su closure quedaría
  // "congelada" con el `stream` del primer render (null) si dependiera
  // del state directamente. El ref siempre tiene el valor más reciente,
  // así que la cámara sí se apaga de verdad al salir de la pantalla,
  // sin importar por qué camino se cierre (botón "Cancelar", la "X" del
  // encabezado, o que el padre desmonte este componente).
  const streamRef = useRef<MediaStream | null>(null);
  // Worker de Tesseract reutilizable — antes se creaba (y descargaba el
  // modelo de idioma) uno nuevo por cada foto y se destruía enseguida,
  // agregando 1-3 seg de latencia innecesaria en cada intento. Ahora se
  // crea una sola vez por sesión de esta pantalla y se reutiliza.
  const workerRef = useRef<Awaited<ReturnType<typeof createWorker>> | null>(null);
  const workerPromiseRef = useRef<Promise<Awaited<ReturnType<typeof createWorker>>> | null>(null);

  async function getOcrWorker() {
    if (workerRef.current) return workerRef.current;
    if (!workerPromiseRef.current) {
      workerPromiseRef.current = createWorker('eng').then((worker) => {
        workerRef.current = worker;
        return worker;
      });
    }
    return workerPromiseRef.current;
  }

  // Preprocesa la foto antes de pasarla a Tesseract: la reduce a un
  // tamaño manejable y la convierte a escala de grises con estiramiento
  // de contraste (normaliza la luminancia al rango completo 0-255). Las
  // fotos de celular de una etiqueta suelen tener luz pareja/bajo
  // contraste, y este paso mejora notablemente la lectura sin depender
  // de ningún servicio de pago — corre 100% en el navegador con canvas.
  async function preprocessImageForOcr(file: File): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const { data } = imageData;
        const gray = new Uint8ClampedArray(width * height);
        let min = 255;
        let max = 0;
        for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
          const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray[p] = g;
          if (g < min) min = g;
          if (g > max) max = g;
        }
        const range = Math.max(max - min, 1);
        for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
          const stretched = ((gray[p] - min) / range) * 255;
          data[i] = stretched;
          data[i + 1] = stretched;
          data[i + 2] = stretched;
        }
        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], 'photo-processed.jpg', { type: 'image/jpeg' }) : file);
        }, 'image/jpeg', 0.95);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  // Corre OCR con un modo de segmentación específico y devuelve el texto
  // limpio (sin saltos de línea/espacios repetidos).
  async function runOcr(worker: Awaited<ReturnType<typeof createWorker>>, image: File, psm: string) {
    await worker.setParameters({ tessedit_pageseg_mode: psm as any });
    const { data: { text } } = await worker.recognize(image);
    return text.replace(/\s+/g, ' ').trim();
  }

  async function handlePhotoCapture(file: File) {
    try {
      setProcessing(true);
      setOcrText('');
      setCandidates([]);
      setCandidateHighlightTerms([]);

      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) console.log('Starting OCR processing for file:', file.name, file.size, 'bytes');

      const worker = await getOcrWorker();
      const processedFile = await preprocessImageForOcr(file);

      // Primer intento: SINGLE_BLOCK (6) — asume un solo bloque uniforme
      // de texto, el mejor supuesto general para una foto acercada a una
      // etiqueta/tag. Si no encuentra casi nada, se reintenta con
      // SPARSE_TEXT (11) — busca texto disperso sin asumir un bloque
      // ordenado, mejor cuando la etiqueta mezcla logos/textos sueltos.
      // El modo por defecto de Tesseract (AUTO, pensado para páginas
      // completas de texto) rendía peor en este tipo de fotos.
      if (isDev) console.log('Tesseract worker ready, recognizing text (PSM: SINGLE_BLOCK)...');
      let cleanedText = await runOcr(worker, processedFile, PSM.SINGLE_BLOCK);
      if (isDev) console.log('OCR text (SINGLE_BLOCK):', cleanedText);

      if (cleanedText.length < 3) {
        if (isDev) console.log('Little/no text found, retrying with PSM: SPARSE_TEXT...');
        cleanedText = await runOcr(worker, processedFile, PSM.SPARSE_TEXT);
        if (isDev) console.log('OCR text (SPARSE_TEXT):', cleanedText);
      }

      setOcrText(cleanedText);

      // Buscar candidatos basados en el texto extraído
      await searchCandidates(cleanedText);

    } catch (err: any) {
      console.error('Error processing photo:', {
        message: err.message,
        stack: err.stack,
        fullError: err
      });
      setOcrText(t('inv_ocr_processing_error'));
    } finally {
      setProcessing(false);
    }
  }

  // Extrae palabras "útiles" del texto crudo del OCR para buscarlas por
  // separado en vez de usar todo el bloque de texto como una sola cadena.
  // Etiquetas manuscritas casi siempre traen ruido del OCR mezclado con
  // fragmentos correctos (ej. "VE Joo! wn Vo yb) ... Eliezer Anteliz
  // RIBS EELS") — buscar el bloque completo como substring nunca calza
  // contra un valor real de la base, aunque el OCR sí haya leído bien un
  // pedazo. Se prioriza lo que trae dígitos (más probable que sea un
  // serial/modelo, ej. "NYOSA14022") y lo más largo primero, con un tope
  // para no armar una consulta gigante.
  function extractSearchTokens(text: string): string[] {
    const tokens = text
      .split(/[^A-Za-z0-9]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const t of tokens) {
      const key = t.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(t);
      }
    }

    unique.sort((a, b) => {
      const aHasDigit = /\d/.test(a) ? 1 : 0;
      const bHasDigit = /\d/.test(b) ? 1 : 0;
      if (aHasDigit !== bHasDigit) return bHasDigit - aHasDigit;
      return b.length - a.length;
    });

    return unique.slice(0, 8);
  }

  // Puntúa qué tan "específico" fue el match de cada candidato: un token
  // que aparece en serial_number/full_code (identificadores casi únicos)
  // vale mucho más que uno que solo aparece en brand/description (ej.
  // "Nova" hace match contra CUALQUIER instrumento marca "Terranova").
  // Sin esto, una etiqueta de marca leída correctamente por el OCR
  // termina enterrando el candidato correcto entre puros instrumentos de
  // la misma marca. Los tokens con dígitos (más probable que sean parte
  // de un serial) pesan doble.
  function scoreCandidate(asset: Asset, tokens: string[]): number {
    let score = 0;
    for (const token of tokens) {
      const t = token.toLowerCase();
      const weight = /\d/.test(token) ? 2 : 1;
      if (asset.serial_number?.toLowerCase().includes(t)) score += weight * 5;
      if (asset.full_code?.toLowerCase().includes(t)) score += weight * 5;
      if (asset.assigned_to_text?.toLowerCase().includes(t)) score += weight * 3;
      if (asset.description?.toLowerCase().includes(t)) score += weight * 2;
      if (asset.brand?.toLowerCase().includes(t)) score += weight * 1;
    }
    return score;
  }

  // Resalta, dentro de un texto mostrado en una tarjeta de candidato, la
  // parte que hizo match con la búsqueda — así se ve de un vistazo POR
  // QUÉ apareció ese candidato en la lista, en vez de tener que leer
  // cada campo para adivinarlo.
  function highlightMatch(text: string | null, terms: string[]) {
    if (!text) return text;
    const escaped = terms.filter((t) => t.length >= 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (escaped.length === 0) return text;
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = text.split(regex);
    if (parts.length === 1) return text;
    return parts.map((part, i) => (
      i % 2 === 1
        ? <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">{part}</mark>
        : <span key={i}>{part}</span>
    ));
  }

  async function searchCandidates(text: string) {
    const isDev = process.env.NODE_ENV === 'development';
    if (!text || text.length < 3) {
      if (isDev) console.log('OCR text too short, showing manual search:', text);
      setShowManualSearch(true);
      return;
    }

    if (isDev) console.log('Searching candidates with OCR text:', text);

    try {
      // Extraer secuencia de 16 dígitos si existe (código de barras)
      const sixteenDigitMatch = text.match(/\d{16}/);
      const sixteenDigitCode = sixteenDigitMatch ? sixteenDigitMatch[0] : null;

      if (sixteenDigitCode) {
        if (isDev) console.log('Extracted 16-digit code from OCR:', sixteenDigitCode);

        // Buscar por código exacto primero — SIN filtrar por sede: un
        // full_code es único en todo el sistema, así que igual que el
        // Escaneo por cámara, si el activo existe hay que encontrarlo
        // sin importar a qué sede pertenezca. `handleSelectAsset` decide
        // "found" vs "mismatch_site" comparando `current_program_id`
        // contra la sede de esta sesión al momento de seleccionarlo.
        const { data: exactMatch, error: exactError } = await inventorySupabase
          .from('assets')
          .select('id, full_code, description, brand, serial_number, assigned_to_text, current_program_id')
          .eq('full_code', sixteenDigitCode)
          .limit(1);

        if (exactError) {
          console.error('Error searching by exact code:', exactError.message);
        }

        if (exactMatch && exactMatch.length > 0) {
          if (isDev) console.log('Exact match found by full_code:', exactMatch);
          setCandidates(exactMatch);
          setCandidateHighlightTerms([sixteenDigitCode]);
          return;
        } else if (isDev) {
          console.log('No exact match for 16-digit code, trying fuzzy search...');
        }
      }

      // Búsqueda difusa palabra por palabra en serial_number,
      // assigned_to_text, description, full_code, brand — en vez de
      // buscar todo el bloque de texto del OCR como una sola cadena
      // (eso nunca calza cuando hay ruido mezclado, el caso típico con
      // letra manuscrita).
      const tokens = extractSearchTokens(text);
      if (isDev) console.log('Search tokens extracted from OCR text:', tokens);

      if (tokens.length === 0) {
        if (isDev) console.log('No usable tokens extracted, showing manual search');
        setShowManualSearch(true);
        return;
      }

      const orConditions = tokens
        .map((t) => `serial_number.ilike.%${t}%,assigned_to_text.ilike.%${t}%,description.ilike.%${t}%,full_code.ilike.%${t}%,brand.ilike.%${t}%`)
        .join(',');

      const { data, error } = await inventorySupabase
        .from('assets')
        .select('id, full_code, description, brand, serial_number, assigned_to_text')
        .eq('current_program_id', programId)
        .or(orConditions)
        .limit(10);

      if (error) {
        console.error('Error searching candidates (Supabase error):', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          ocrText: text,
          tokens,
          programId: programId
        });
        throw error;
      }

      if (isDev) console.log('Fuzzy search completed. Results found:', data?.length || 0);

      if (!data || data.length === 0) {
        if (isDev) console.log('No candidates found, showing manual search');
        // Se precarga el buscador manual con la mejor pista encontrada
        // (el primer token, ya viene priorizado por dígitos/longitud) —
        // así el usuario solo tiene que confirmar o corregir, no escribir
        // todo desde cero.
        setManualSearchTerm(tokens[0] || '');
        setShowManualSearch(true);
      } else {
        if (isDev) console.log('Candidates found:', data);
        // Se ordena por especificidad del match (serial/código > nombre
        // asignado > descripción > marca) para que el candidato correcto
        // no quede enterrado entre varios de la misma marca.
        const sorted = [...data].sort((a, b) => scoreCandidate(b, tokens) - scoreCandidate(a, tokens));
        setCandidates(sorted);
        setCandidateHighlightTerms(tokens);
      }
    } catch (err: any) {
      if (isDev) {
        console.log('RAW ERROR:', err);
        console.log('error type:', typeof err, err instanceof Error);
      }
      console.error('Error searching candidates (caught):', {
        message: err.message,
        stack: err.stack,
        fullError: err
      });
      setShowManualSearch(true);
    }
  }

  async function handleManualSearch() {
    if (!manualSearchTerm || manualSearchTerm.length < 2) return;

    const isDev = process.env.NODE_ENV === 'development';
    try {
      setProcessing(true);
      const term = manualSearchTerm.toLowerCase();

      if (isDev) console.log('Manual search started with term:', term);

      const { data, error } = await inventorySupabase
        .from('assets')
        .select('id, full_code, description, brand, serial_number, assigned_to_text')
        .eq('current_program_id', programId)
        .or(`description.ilike.%${term}%,brand.ilike.%${term}%,serial_number.ilike.%${term}%,assigned_to_text.ilike.%${term}%,full_code.ilike.%${term}%`)
        .limit(20);

      if (error) {
        if (isDev) {
          console.log('RAW ERROR (manual search):', error);
          console.log('error type:', typeof error, error instanceof Error);
        }
        console.error('Manual search error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      if (isDev) console.log('Manual search results:', data?.length || 0);
      setCandidates(data || []);
      setCandidateHighlightTerms([manualSearchTerm]);
      setShowManualSearch(false);
    } catch (err: any) {
      if (isDev) console.log('RAW ERROR (manual search caught):', err);
      console.error('Error in manual search:', err);
    } finally {
      setProcessing(false);
    }
  }

  function handleSelectAsset(asset: Asset) {
    const code = asset.full_code || '';
    const result = asset.current_program_id && asset.current_program_id !== programId ? 'mismatch_site' : 'found';
    onAssetSelected(asset.id, code, result, 'photo_assist');
  }

  // Iniciar cámara
  async function startCamera() {
    try {
      if (process.env.NODE_ENV === 'development') console.log('Requesting camera access...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      if (process.env.NODE_ENV === 'development') console.log('Camera stream obtained:', mediaStream.active);
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert(t('inv_camera_access_error'));
    }
  }

  // Detener cámara
  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    setCameraActive(false);
  }

  // Capturar foto desde video
  async function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    
    // Convertir canvas a blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      
      stopCamera();
      
      // Crear File desde Blob
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      await handlePhotoCapture(file);
    }, 'image/jpeg', 0.95);
  }

  // Asignar stream al video cuando cambia
  useEffect(() => {
    if (stream && videoRef.current) {
      if (process.env.NODE_ENV === 'development') console.log('Assigning stream to video element');
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  }, [stream]);

  // Cleanup al cerrar — también libera el worker de Tesseract reutilizable
  // (usa el ref, no el state, por la misma razón que streamRef arriba).
  useEffect(() => {
    return () => {
      stopCamera();
      workerRef.current?.terminate();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">{t('inv_photo_ocr_title')}</h2>
            <button
              onClick={() => { stopCamera(); onClose(); }}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MdClose size={24} />
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            {t('inv_photo_ocr_desc')}
          </p>

          {/* Camera Buttons */}
          {!processing && candidates.length === 0 && !cameraActive && (
            <div className="space-y-2">
              <button
                onClick={startCamera}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors font-medium"
              >
                <MdCameraAlt size={24} />
                {t('inv_open_camera')}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('inv_select_from_gallery')}
              </button>
              <button
                onClick={() => setShowManualSearch(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <MdSearch size={20} />
                {t('inv_manual_search')}
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Se limpia el valor del input de inmediato — si no, seleccionar
              // la MISMA foto dos veces seguidas (ej. reintentar tras un OCR
              // fallido) no siempre dispara este evento de nuevo en todos los
              // navegadores, dejando el flujo trabado sin explicación visible.
              e.target.value = '';
              if (file) handlePhotoCapture(file);
            }}
            className="hidden"
          />
        </div>
      </div>

      {/* Camera View */}
      {cameraActive && !processing && (
        <div className="flex-1 flex flex-col bg-black overflow-hidden">
          {/* Video Container con altura limitada */}
          <div className="flex-1 relative bg-black overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          
          {/* Camera Controls - Footer Fijo */}
          <div className="flex-shrink-0 p-4 bg-gradient-to-t from-black via-black/90 to-black/70">
            <div className="flex gap-3 justify-center">
              <button
                onClick={stopCamera}
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={capturePhoto}
                className="px-8 py-3 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors font-medium flex items-center gap-2"
              >
                <MdCameraAlt size={24} />
                {t('inv_capture_photo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing State */}
      {processing && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C2492B] mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('inv_processing_image')}</p>
          </div>
        </div>
      )}

      {/* OCR Result */}
      {ocrText && !processing && (
        <div className="p-4 bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto">
            <div className="text-sm font-medium text-blue-900 mb-1">{t('inv_text_detected')}</div>
            <div className="text-sm text-blue-800">{ocrText}</div>
          </div>
        </div>
      )}

      {/* Manual Search */}
      {showManualSearch && !processing && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto">
            <div className="text-sm text-gray-700 mb-2">
              {ocrText ? t('inv_no_matches_search_manually') : t('inv_search_manually')}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t('inv_search_placeholder_ocr')}
                value={manualSearchTerm}
                onChange={(e) => setManualSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                autoFocus
              />
              <button
                onClick={handleManualSearch}
                className="px-4 py-2 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors"
              >
                {t('inv_search_button')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidates List */}
      {candidates.length > 0 && !processing && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto space-y-2">
            <div className="text-sm font-medium text-gray-700 mb-2">
              {t('inv_select_correct_asset', { n: candidates.length })}
            </div>
            {candidates.map((asset) => (
              <button
                key={asset.id}
                onClick={() => handleSelectAsset(asset)}
                className="w-full bg-white border border-gray-200 rounded-lg p-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="font-medium text-gray-900">{asset.description}</div>
                  {asset.current_program_id && asset.current_program_id !== programId && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium flex-shrink-0">
                      {t('inv_other_site_badge')}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {highlightMatch(asset.full_code, candidateHighlightTerms) || t('inv_no_code')}
                  {asset.brand && <> • {highlightMatch(asset.brand, candidateHighlightTerms)}</>}
                </div>
                {asset.serial_number && (
                  <div className="text-xs text-gray-500 mt-1">
                    {t('inv_serial_colon')} {highlightMatch(asset.serial_number, candidateHighlightTerms)}
                  </div>
                )}
                {asset.assigned_to_text && (
                  <div className="text-xs text-gray-500">
                    {t('inv_assigned_to_colon')} {highlightMatch(asset.assigned_to_text, candidateHighlightTerms)}
                  </div>
                )}
              </button>
            ))}

            <button
              onClick={() => {
                setCandidates([]);
                setCandidateHighlightTerms([]);
                setOcrText('');
                setShowManualSearch(true);
              }}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              {t('inv_none_of_these_search_again')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
