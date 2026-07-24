'use client';

/**
 * COMPONENTE DE ESCANEO DE CÓDIGOS DE BARRAS
 * Usa html5-qrcode con deviceId obtenido vía getUserMedia (como PhotoOCR)
 *
 * FIX (23/07): el useEffect no tenía protección contra doble-invocación
 * (React Strict Mode / remounts), lo que causaba 2 cámaras abriéndose a la
 * vez y el scannerRef quedando en un estado inconsistente. Se agrega un
 * flag `cancelled` que se revisa después de cada `await`, para que si el
 * efecto se desmonta/remonta a mitad de la inicialización, la ejecución
 * vieja se aborte limpiamente en vez de dejar una cámara huérfana corriendo.
 */

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { createClient } from '@supabase/supabase-js';
import { INVENTORY_SUPABASE_CONFIG } from '../../../../../../supabase.inventory.config';
import { MdClose, MdCheckCircle, MdWarning, MdError } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';

const inventorySupabase = createClient(
  INVENTORY_SUPABASE_CONFIG.url,
  INVENTORY_SUPABASE_CONFIG.anonKey
);

interface BarcodeScannerProps {
  sessionId: string;
  programId: string;
  onAssetScanned: (assetId: string | null, code: string, result: 'found' | 'mismatch_site' | 'unknown_code', source: 'scan') => void;
  onClose: () => void;
}

export default function BarcodeScanner({ sessionId, programId, onAssetScanned, onClose }: BarcodeScannerProps) {
  const { t } = useI18n();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Evita registrar el mismo código varias veces: mientras el código
  // sigue en cuadro, el decodificador lo detecta repetidas veces por
  // segundo. Este flag bloquea detecciones nuevas hasta que termine el
  // cooldown después de la última.
  const isProcessingRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [scanAttempts, setScanAttempts] = useState(0);
  const [lastResult, setLastResult] = useState<{code: string; message: string; type: 'success' | 'warning' | 'error'} | null>(null);
  const [cameraInfo, setCameraInfo] = useState<string>(t('inv_scanner_initializing'));
  const [errorInfo, setErrorInfo] = useState<string>('');

  useEffect(() => {
    // Flag de cancelación: se marca true en el cleanup. Cada punto del
    // arranque async revisa este flag antes de continuar, para que un
    // remount (Strict Mode u otro) no deje 2 cámaras corriendo a la vez.
    let cancelled = false;

    async function init() {
      try {
        // FIX (23/07, 3ra ronda): se elimina el truco de "stream temporal
        // para descubrir el deviceId y reusarlo". En iOS Safari el
        // deviceId no es confiable para reutilizar entre llamadas
        // separadas a getUserMedia — al pedir la cámara otra vez con ese
        // mismo deviceId, Safari puede no honrarlo y cae en silencio a la
        // cámara frontal en vez de lanzar un error. Se pide directamente
        // facingMode: {exact: 'environment'} en una sola llamada.
        if (process.env.NODE_ENV === 'development') {
          console.log('Initializing barcode scanner with html5-qrcode (facingMode directo)...');
        }

        // Antes de pedir la cámara, se enumeran las disponibles: sirve
        // para el nivel 'device' de abajo, que apunta directo a una
        // cámara real por su ID (evita que el navegador elija sola una
        // cámara virtual como "OBS Virtual Camera" cuando no hay cámara
        // trasera disponible, típico en laptops).
        let detectedCameras: { id: string; label: string }[] = [];
        try {
          detectedCameras = await Html5Qrcode.getCameras();
          if (detectedCameras.length === 0) {
            setCameraInfo(t('inv_scanner_no_camera_detected'));
          }
        } catch (camErr) {
          console.error('Error al enumerar cámaras (getCameras):', camErr);
        }

        // Palabras clave de cámaras "virtuales" conocidas (software, no
        // hardware real) — se evitan a propósito al elegir cámara en el
        // nivel 'device'. Lista no exhaustiva, cubre los casos más
        // comunes (OBS, Snap Camera, ManyCam, DroidCam).
        const VIRTUAL_CAMERA_HINTS = ['obs', 'virtual', 'snap camera', 'manycam', 'droidcam'];
        function pickRealCamera() {
          const real = detectedCameras.filter(
            c => !VIRTUAL_CAMERA_HINTS.some(hint => c.label.toLowerCase().includes(hint))
          );
          return real[0] || detectedCameras[0] || null;
        }

        const html5QrCode = new Html5Qrcode('barcode-reader');

        // Config compartida entre el intento con cámara trasera y el
        // reintento sin restricción de cámara (ver más abajo).
        const scanConfig = {
          // AJUSTE (23/07, calibración): fps bajado de 30 a 15 — a 30
          // el navegador compite por CPU/GPU entre "decodificar cada
          // cuadro" y "el enfoque automático nativo del teléfono",
          // sobre todo pidiendo 1920x1080. Con menos cuadros por
          // segundo, cada intento se procesa más rápido y le deja más
          // margen a la cámara para enfocar.
          fps: 15,
          // Recuadro con forma real de código de barras (rectángulo
          // ancho y bajo) en vez de un cuadro genérico — una vez que el
          // código está aproximadamente alineado dentro de esta franja,
          // debería "enganchar" más rápido que con un recuadro grande.
          qrbox: function (viewfinderWidth: number, viewfinderHeight: number) {
            const width = Math.min(viewfinderWidth * 0.85, 500);
            const height = Math.min(viewfinderHeight * 0.22, 160);
            return { width, height };
          },
          aspectRatio: 1.777778,
          disableFlip: false,
          // @ts-ignore
          formatsToSupport: [
            0,  // CODE_128
            1,  // CODE_39
            2,  // EAN_13
            3,  // EAN_8
            13, // UPC_A
            14, // UPC_E
          ]
        };

        // html5-qrcode ignora el primer parámetro (facingMode/deviceId)
        // cuando también se le pasa `videoConstraints`; usa SOLO lo que
        // venga dentro de `videoConstraints` como constraints reales de
        // getUserMedia. El facingMode debe ir DENTRO de ese objeto.
        //
        // Importante: html5-qrcode a veces rechaza sus promesas con
        // STRINGS PLANOS en vez de objetos Error (confirmado en su código
        // fuente), así que no basta con mirar `err.name`/`err.message` —
        // hay que revisar también el texto del error tal cual.
        function isOverconstrained(err: any) {
          if (err?.name === 'OverconstrainedError') return true;
          const text = typeof err === 'string' ? err : String(err?.message ?? err ?? '');
          return /overconstrained/i.test(text);
        }

        // 4 niveles de exigencia, de más estricto a más permisivo. Cada
        // uno solo se intenta si el anterior falló específicamente por
        // OverconstrainedError (cámara/resolución no disponible) — un
        // error de otro tipo (permiso denegado, cámara ocupada, etc.) se
        // deja pasar de inmediato al catch de afuera, sin reintentos.
        //
        // 1) Rear: cámara trasera exacta + resolución mínima exigida —
        //    el comportamiento de siempre en celular, SIN TOCAR.
        // 2) Device: apunta EXPLÍCITAMENTE a la cámara real por su
        //    deviceId (vía pickRealCamera(), evitando cámaras virtuales
        //    como "OBS Virtual Camera"), en vez de dejar que html5-qrcode
        //    elija sola cuál abrir. Solo resolución ideal, sin mínimos.
        // 3) Default: sin deviceId ni facingMode, con resolución mínima —
        //    respaldo por si pickRealCamera() no encontró nada útil.
        // 4) Bare: sin ninguna restricción más allá de "dame una cámara
        //    de video". Última red de seguridad antes de mostrar el
        //    error real al usuario.
        async function startScanner(level: 'rear' | 'device' | 'default' | 'bare') {
          let videoConstraints: any;
          let cameraIdOrConfig: any = {};

          if (level === 'rear') {
            videoConstraints = {
              facingMode: { exact: 'environment' },
              width: { ideal: 1280, min: 960 },
              height: { ideal: 720, min: 540 }
            };
            cameraIdOrConfig = { facingMode: { exact: 'environment' } };
          } else if (level === 'device') {
            const cam = pickRealCamera();
            if (!cam) throw { name: 'OverconstrainedError', message: 'No hay cámaras detectadas para elegir por deviceId' };
            videoConstraints = {
              deviceId: { exact: cam.id },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            };
          } else if (level === 'default') {
            videoConstraints = {
              width: { ideal: 1280, min: 960 },
              height: { ideal: 720, min: 540 }
            };
          } else {
            // Bare: sin width/height/facingMode/deviceId — deja que el
            // navegador entregue lo que la cámara disponible pueda dar.
            videoConstraints = {};
          }

          await html5QrCode.start(
            cameraIdOrConfig,
            { ...scanConfig, videoConstraints },
            onScanSuccess,
            onScanFailure
          );
        }

        try {
          await startScanner('rear');
        } catch (err: any) {
          if (!isOverconstrained(err)) throw err;
          // En computadoras/laptops (sin cámara trasera), exigir
          // `facingMode: {exact: 'environment'}` lanza OverconstrainedError
          // — no es un caso raro, pasa siempre desde una compu de
          // escritorio en vez de un teléfono. Se reintenta con niveles
          // cada vez más permisivos.
          setCameraInfo(t('inv_scanner_rear_unavailable'));
          try {
            await startScanner('device');
          } catch (err2: any) {
            if (!isOverconstrained(err2)) throw err2;
            try {
              await startScanner('default');
            } catch (err3: any) {
              if (!isOverconstrained(err3)) throw err3;
              // Última red de seguridad: algunas webcams (viejas o
              // virtuales) tampoco soportan la resolución mínima pedida —
              // se reintenta sin ninguna restricción de resolución.
              await startScanner('bare');
            }
          }
        }

        if (cancelled) {
          // Terminó de arrancar justo cuando nos desmontaban — apagarla de inmediato,
          // no dejarla como cámara huérfana corriendo en segundo plano.
          if (process.env.NODE_ENV === 'development') {
            console.log('Init finished after unmount — stopping orphaned scanner');
          }
          try {
            await html5QrCode.stop();
            html5QrCode.clear();
          } catch (e) {
            console.error('Error stopping orphaned scanner:', e);
          }
          return;
        }

        // Solo llegamos aquí si el efecto sigue vivo — esta es la única
        // instancia real que debe quedar activa.
        scannerRef.current = html5QrCode;

        // Diagnóstico: leer qué cámara quedó REALMENTE activa directo del
        // <video> que html5-qrcode insertó en el DOM (más confiable que
        // inferirlo de un stream separado que ya no existe).
        setTimeout(() => {
          try {
            const videoEl = document.querySelector('#barcode-reader video') as HTMLVideoElement | null;
            const stream = videoEl?.srcObject as MediaStream | undefined;
            const track = stream?.getVideoTracks()[0];
            if (track) {
              const s = track.getSettings();
              if (process.env.NODE_ENV === 'development') {
                console.log('CÁMARA REALMENTE ACTIVA:', track.label, s.facingMode);
              }
              setCameraInfo(t('inv_scanner_camera_active', { label: track.label || t('inv_unknown'), facing: s.facingMode || 'unknown' }));
            }
          } catch (e) {
            console.error('Error leyendo cámara activa del DOM:', e);
          }
        }, 300);

        if (process.env.NODE_ENV === 'development') {
          console.log('Scanner started successfully with facingMode directo');
        }
        setScanning(true);
        setErrorInfo('');
      } catch (err: any) {
        if (cancelled) return; // no mostrar errores de una ejecución ya cancelada
        // Un OverconstrainedError trae `.constraint` con el nombre exacto
        // de la restricción que no se pudo cumplir (ej. "width",
        // "facingMode") — se muestra también en pantalla para diagnosticar
        // sin depender de la consola del navegador.
        console.error('Error starting scanner:', err, 'constraint:', err?.constraint);
        // html5-qrcode a veces rechaza con un string plano en vez de un
        // Error — hay que cubrir ambos casos al extraer el mensaje.
        const errorMsg = (typeof err === 'string' ? err : (err?.message || err?.name)) || t('inv_unknown_error');
        const constraintInfo = err?.constraint ? t('inv_constraint_suffix', { constraint: err.constraint }) : '';
        setCameraInfo(t('inv_scanner_error_starting'));
        setErrorInfo(`🔴 ${t('inv_critical_error_prefix')} ${errorMsg}${constraintInfo}`);
        setLastResult({
          code: '',
          message: `${t('inv_error_starting_camera_prefix')} ${errorMsg}${constraintInfo}`,
          type: 'error'
        });
      }
    }

    // FIX (23/07, 2da ronda): en vez de llamar init() de inmediato, se
    // difiere con setTimeout(0). React Strict Mode monta → desmonta →
    // vuelve a montar este efecto de forma SINCRÓNICA (sin que pase
    // ningún macrotask entre medio). Al envolver el arranque real en un
    // setTimeout(0), el primer montaje "fantasma" programa el timer pero
    // se cancela (clearTimeout) antes de que llegue a dispararse — nunca
    // llega a pedir la cámara. Solo el montaje real (el segundo) alcanza
    // a disparar su timer y pide la cámara una sola vez. Esto evita que 2
    // getUserMedia() concurrentes confundan al navegador sobre qué cámara
    // entregar (causaba el banner diciendo "trasera" mientras el video
    // mostraba la cámara frontal).
    const timer = setTimeout(() => {
      if (!cancelled) init();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Si para cuando se desmonta ya había una instancia real activa
      // (scannerRef.current asignado), apagarla también aquí.
      if (scannerRef.current) {
        const toStop = scannerRef.current;
        scannerRef.current = null;
        toStop.stop()
          .then(() => toStop.clear())
          .catch((e) => console.error('Error stopping scanner on cleanup:', e));
      }
      setScanning(false);
    };
  }, []);

  async function stopScanner() {
    if (process.env.NODE_ENV === 'development') {
      console.log('Stopping scanner (manual call)...');
    }

    if (scannerRef.current) {
      const toStop = scannerRef.current;
      scannerRef.current = null;
      try {
        await toStop.stop();
        toStop.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }

    setScanning(false);
  }

  async function onScanSuccess(decodedText: string) {
    // AJUSTE (23/07): mientras el código sigue dentro del recuadro, el
    // decodificador lo va a detectar varias veces por segundo — sin este
    // bloqueo, un solo acercamiento registraba el mismo activo 2-3 veces
    // en la sesión de auditoría. Se ignoran detecciones nuevas mientras
    // se procesa la actual, y se pausa el escaneo un momento después de
    // cada detección para dar tiempo a alejar el código antes de seguir.
    if (isProcessingRef.current) {
      return;
    }
    isProcessingRef.current = true;

    if (scannerRef.current) {
      try {
        scannerRef.current.pause(false); // false = no pausa el video, solo el análisis
      } catch (e) {
        // puede fallar si ya estaba pausado por alguna razón — no es crítico
      }
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('✓ Barcode detected:', decodedText);
      }

      // Validar que sea un código de 16 dígitos
      if (decodedText.length !== 16 || !/^\d{16}$/.test(decodedText)) {
        console.warn('Invalid code format:', decodedText, 'length:', decodedText.length);
        setLastResult({
          code: decodedText,
          message: t('inv_invalid_code_format', { code: decodedText }),
          type: 'error'
        });
        return;
      }

      // Buscar el activo en la BD
      const { data: asset, error } = await inventorySupabase
        .from('assets')
        .select('id, full_code, description, brand, current_program_id')
        .eq('full_code', decodedText)
        .single();

      if (error || !asset) {
        // Código no encontrado
        setLastResult({
          code: decodedText,
          message: t('inv_code_not_found'),
          type: 'error'
        });
        onAssetScanned(null, decodedText, 'unknown_code', 'scan');
        return;
      }

      // Verificar si pertenece a la sede correcta
      if (asset.current_program_id !== programId) {
        // Encontrado pero en otra sede
        const { data: program } = await inventorySupabase
          .from('programs')
          .select('name')
          .eq('id', asset.current_program_id)
          .single();

        setLastResult({
          code: decodedText,
          message: t('inv_asset_other_site', { site: program?.name || t('inv_unknown') }),
          type: 'warning'
        });
        onAssetScanned(asset.id, decodedText, 'mismatch_site', 'scan');
        return;
      }

      // Encontrado correctamente
      setLastResult({
        code: decodedText,
        message: `✓ ${asset.description}${asset.brand ? ` - ${asset.brand}` : ''}`,
        type: 'success'
      });
      onAssetScanned(asset.id, decodedText, 'found', 'scan');
    } finally {
      // Cooldown de 2.5s antes de volver a aceptar detecciones — tiempo
      // para alejar el instrumento ya escaneado y tomar el siguiente.
      setTimeout(() => {
        setLastResult(null);
        isProcessingRef.current = false;
        if (scannerRef.current) {
          try {
            scannerRef.current.resume();
          } catch (e) {
            console.error('Error resuming scanner after cooldown:', e);
          }
        }
      }, 2500);
    }
  }

  function onScanFailure(error: string) {
    // Incrementar contador de intentos (para mostrar que está escaneando)
    setScanAttempts(prev => {
      const next = prev + 1;
      if (next % 100 === 0 && process.env.NODE_ENV === 'development') {
        console.log('Scanning... attempts:', next);
      }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('inv_scanner_title')}</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <MdClose size={24} />
        </button>
      </div>

      {/* Scanner View */}
      <div className="flex-1 relative">
        {/* Contenedor para html5-qrcode */}
        <div id="barcode-reader" className="w-full h-full"></div>

        {/* Camera Info - DIAGNÓSTICO VISIBLE */}
        <div className="absolute top-4 left-4 right-4 bg-yellow-500 text-black p-3 rounded-lg text-sm font-bold shadow-lg z-10">
          <p className="text-center">{cameraInfo}</p>
        </div>

        {/* Error Info - ERRORES VISIBLES */}
        {errorInfo && (
          <div className="absolute top-20 left-4 right-4 bg-red-500 text-white p-3 rounded-lg text-sm font-bold shadow-lg z-10">
            <p className="text-center">{errorInfo}</p>
          </div>
        )}

        {/* Overlay Instructions */}
        <div className={`absolute ${errorInfo ? 'top-36' : 'top-20'} left-4 right-4 bg-black bg-opacity-70 text-white p-3 rounded-lg text-sm`}>
          <p>{t('inv_scanner_instructions')}</p>
          <p className="text-xs text-gray-300 mt-1">{t('inv_scanner_formats')}</p>
          {scanning && (
            <div className="mt-2 flex items-center gap-2">
              <div className="animate-pulse w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-xs text-green-400">{t('inv_scanning_attempts', { n: scanAttempts })}</span>
            </div>
          )}
        </div>

        {/* Last Result */}
        {lastResult && (
          <div className={`absolute bottom-4 left-4 right-4 p-4 rounded-lg flex items-start gap-3 ${
            lastResult.type === 'success' ? 'bg-green-600' :
            lastResult.type === 'warning' ? 'bg-yellow-600' :
            'bg-red-600'
          }`}>
            {lastResult.type === 'success' && <MdCheckCircle size={24} className="flex-shrink-0 text-white" />}
            {lastResult.type === 'warning' && <MdWarning size={24} className="flex-shrink-0 text-white" />}
            {lastResult.type === 'error' && <MdError size={24} className="flex-shrink-0 text-white" />}
            <div className="flex-1 text-white">
              <div className="font-medium">{lastResult.message}</div>
              <div className="text-sm opacity-90">{lastResult.code}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
