"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { api } from "@/lib/api";
import { Button, Input } from "@/components/ui";
import { toastError } from "@/lib/toast";
import {
  Camera, CameraOff, CheckCircle2, XCircle, Loader2, Keyboard, ScanLine, RefreshCw,
} from "lucide-react";

interface ScanResult {
  valid: boolean;
  message: string;
  ticket_id?: number;
  event?: string;
  ticket_type?: string;
  used_at?: string;
  scanned_at?: string;
}

interface HistoryItem extends ScanResult {
  code: string;
  at: number;
}

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function beep(ok: boolean) {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = ok ? 880 : 200;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.15 : 0.35));
    window.setTimeout(() => ctx.close().catch(() => {}), ok ? 250 : 500);
  } catch {
    /* audio no disponible */
  }
}

export default function TaquillaEscanearPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const processingRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [manual, setManual] = useState("");

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  const handleCode = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code || processingRef.current) return;
    const now = Date.now();
    // Ignora el mismo código repetido mientras está frente a la cámara.
    if (lastCodeRef.current && lastCodeRef.current.code === code && now - lastCodeRef.current.at < 3000) {
      return;
    }
    lastCodeRef.current = { code, at: now };
    processingRef.current = true;
    try {
      const res = await api.post<ScanResult>(`/admin/tickets/validate?code=${encodeURIComponent(code)}`, {});
      setResult(res);
      setHistory((prev) => [{ ...res, code, at: now }, ...prev].slice(0, 12));
      beep(res.valid);
      navigator.vibrate?.(res.valid ? 70 : [70, 60, 70]);
    } catch (e) {
      const res: ScanResult = {
        valid: false,
        message: e instanceof Error ? e.message : "Boleto no encontrado",
      };
      setResult(res);
      setHistory((prev) => [{ ...res, code, at: now }, ...prev].slice(0, 12));
      beep(false);
    } finally {
      processingRef.current = false;
    }
  }, []);

  // Bucle de decodificación: dibuja el frame en el canvas y busca un QR.
  // Se declara como función para poder reencolarse sin auto-referencia en deps.
  function scanFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const now = performance.now();
      if (now - lastTickRef.current > 200) {
        lastTickRef.current = now;
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const found = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
            if (found?.data) void handleCode(found.data);
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }

  useEffect(() => stopCamera, [stopCamera]);

  async function startCamera() {
    setStarting(true);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      lastTickRef.current = 0;
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch {
      toastError("No se pudo acceder a la cámara. Revisá los permisos o usá el ingreso manual.");
      stopCamera();
    } finally {
      setStarting(false);
    }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manual.trim();
    if (!code) return;
    lastCodeRef.current = null;
    void handleCode(code);
    setManual("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Escanear</h1>
        <p className="text-sm text-gray-500 mt-1">
          Validá las entradas en la puerta. Solo podés validar boletos de los eventos que tenés asignados.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Cámara */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="relative aspect-video rounded-xl overflow-hidden bg-ink-950 grid place-items-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${scanning ? "" : "hidden"}`}
              />
              {!scanning && (
                <div className="text-center text-gray-400 px-4">
                  <ScanLine className="w-10 h-10 mx-auto mb-2 opacity-60" />
                  <p className="text-sm">La cámara está apagada</p>
                </div>
              )}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 max-w-xs aspect-square border-2 border-brand-500/70 rounded-2xl" />
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <div className="mt-4 flex justify-center">
              {scanning ? (
                <Button variant="danger" onClick={stopCamera}>
                  <CameraOff className="w-4 h-4" /> Detener cámara
                </Button>
              ) : (
                <Button onClick={startCamera} disabled={starting}>
                  {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  Iniciar cámara
                </Button>
              )}
            </div>
          </div>

          {/* Ingreso manual */}
          <form onSubmit={submitManual} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Keyboard className="w-4 h-4 text-gray-400" /> Ingreso manual del código
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="Pegá o escribí el código del boleto"
                />
              </div>
              <Button type="submit" disabled={!manual.trim()}>
                Validar
              </Button>
            </div>
          </form>

          {/* Resultado */}
          {result && (
            <div
              className={`rounded-2xl border p-5 ${
                result.valid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.valid ? (
                  <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="w-7 h-7 text-red-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className={`text-lg font-bold ${result.valid ? "text-green-900" : "text-red-900"}`}>
                    {result.message}
                  </p>
                  {result.event && (
                    <p className="text-sm text-gray-700 mt-1">{result.event}</p>
                  )}
                  {result.ticket_type && (
                    <p className="text-xs text-gray-500 mt-0.5">{result.ticket_type}</p>
                  )}
                  {result.ticket_id != null && (
                    <p className="text-xs text-gray-400 mt-1">Boleto #{result.ticket_id}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Historial */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <ScanLine className="w-4 h-4 text-gray-400" /> Escaneos recientes
            </h2>
            {history.length > 0 && (
              <button
                onClick={() => setHistory([])}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="p-6 text-sm text-gray-400 text-center">Todavía no escaneaste ningún boleto.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {history.map((h, i) => (
                <li key={i} className="flex items-start gap-3 p-4">
                  {h.valid ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${h.valid ? "text-green-800" : "text-red-800"}`}>
                      {h.message}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{h.code}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatTime(h.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
