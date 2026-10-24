import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Camera,
  Scan,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Sprout,
  Image as ImageIcon,
  RotateCcw,
} from "lucide-react";
import { BottomNav } from "../../components/BottomNav";
import {
  scanPlantHealth,
  type ScanDiagnosisResult,
} from "../../services/ai.service";
import {
  listObservations,
  createObservation,
  type ObservationRecord,
} from "../../services/observation.service";
import {
  fileToBase64,
  getOfflineQueue,
  queueOfflineAction,
} from "../../services/sync.service";
import { useFarmContext } from "../../hooks/useFarmContext";
import { useFarmSelection } from "../../context/farmSelectionContext";
import { ApiError } from "../../lib/api";
import { FarmCycleSelector } from "../../components/FarmCycleSelector";

export const FarmerScannerPage: React.FC = () => {
  const navigate = useNavigate();
  // Separate refs: camera input opens the back camera directly; gallery input
  // opens the photo library without forcing the camera.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const farmCtx = useFarmContext();
  const { selectedCycle } = useFarmSelection();
  const [queueCount, setQueueCount] = useState(0);

  // Camera & Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFallbackSuggested, setCameraFallbackSuggested] = useState(false);

  // Bottom Sheet State: Controls smooth upward sliding
  const [sheetOpen, setSheetOpen] = useState(false);

  // Diagnosis State
  const [diagnosis, setDiagnosis] = useState<ScanDiagnosisResult | null>(null);
  const [logging, setLogging] = useState(false);

  // Real latest scan observation from the backend
  const [latestScan, setLatestScan] = useState<ObservationRecord | null>(null);

  useEffect(() => {
    let active = true;
    if (farmCtx.cropCycleId) {
      listObservations(farmCtx.cropCycleId)
        .then((records) => {
          if (active && records && records.length > 0) {
            const sorted = [...records].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
            setLatestScan(sorted[0] || null);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [farmCtx.cropCycleId]);

  // Load queue count on mount
  useEffect(() => {
    getOfflineQueue().then((q) => setQueueCount(q.length));
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  useEffect(() => stopCamera, []);

  const showCameraError = (error: unknown) => {
    const name = error instanceof DOMException ? error.name : "UnknownError";
    let description = "Hindi mabuksan ang kamera. Maaari pa ring pumili ng litrato mula sa Gallery.";

    switch (name) {
      case "NotAllowedError":
      case "SecurityError":
        description = "Hindi pinayagan ang kamera. Buksan ang camera permission sa browser site settings o sa App permissions ng telepono, pagkatapos subukan muli.";
        break;
      case "NotFoundError":
        description = "Walang nakitang kamera sa device na ito. Pumili ng litrato mula sa Gallery.";
        break;
      case "NotReadableError":
        description = "May ibang app na gumagamit ng kamera. Isara ito at subukan muli, o pumili mula sa Gallery.";
        break;
      case "OverconstrainedError":
        description = "Hindi tugma ang camera setting sa device na ito. Pumili ng litrato mula sa Gallery.";
        break;
      case "TypeError":
        description = "Hindi available ang live camera sa koneksyong ito. Gumamit ng HTTPS o localhost, o pumili mula sa Gallery.";
        break;
    }

    toast.error("Hindi Mabuksan ang Kamera", { description });
    setCameraFallbackSuggested(true);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraFallbackSuggested(false);

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      showCameraError(new DOMException("Camera needs HTTPS or localhost.", "TypeError"));
      return;
    }

    try {
      const permission = await navigator.permissions?.query({ name: "camera" as PermissionName });
      if (permission?.state === "denied") {
        showCameraError(new DOMException("Camera permission is denied.", "NotAllowedError"));
        return;
      }
    } catch {
      // Some browsers do not support querying camera permission. getUserMedia
      // still provides the authoritative result and its error is handled below.
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== "OverconstrainedError") {
          throw error;
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      setCameraActive(true);
    } catch (error) {
      stopCamera();
      showCameraError(error);
    }
  };

  const captureFromCamera = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      toast.info("Inihahanda pa ang kamera", {
        description: "Sandali lang, pagkatapos ay pindutin muli ang kuha.",
      });
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) {
      toast.error("Hindi nakuha ang litrato", { description: "Subukan muli o pumili mula sa Gallery." });
      return;
    }

    const file = new File([blob], `plant-scan-${Date.now()}.jpg`, { type: "image/jpeg" });
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    stopCamera();
    await runDiagnosis(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setImageFile(file);
      setImagePreview(url);
      stopCamera();
      await runDiagnosis(file);
    }
  };

  const runDiagnosis = async (file: File) => {
    setScanning(true);
    setDiagnosis(null);

    try {
      const res = await scanPlantHealth(file);
      setDiagnosis(res);
      // Smoothly slide the white info container upward
      setSheetOpen(true);
      toast.success("Natapos ang Pagsusuri ng AI!", {
        description: res.diseaseDetected
          ? `Natukoy: ${res.diseaseDetected}`
          : "Malusog ang pananim!",
      });
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError && selectedCycle) {
        const imageBase64 = await fileToBase64(file);
        await queueOfflineAction({
          actionType: "CREATE_OBSERVATION",
          displayTitle: "Litrato para sa AI Scan",
          payload: {
            cropCycleId: selectedCycle.id,
            title: "Litrato para sa AI Scan",
            description: "Nakuhang litrato habang offline. Ipapasuri sa AI kapag may koneksyon na.",
            severity: "LOW",
            imageBase64,
            imageFileName: file.name,
            imageMimeType: file.type,
          },
        });
        setQueueCount((count) => count + 1);
        setSheetOpen(true);
        toast.info("Nai-save ang litrato habang offline", {
          description: "Ika-queue ito at isi-sync kapag may koneksyon na. Maaaring ipasuri sa AI pagkatapos mag-sync.",
        });
        return;
      }
      // No fabricated fallback: show the real reason and let the farmer retry.
      const description =
        err instanceof ApiError
          ? err.message
          : "Hindi matapos ang pagsusuri. Pakisubukan muli o i-check ang koneksyon.";
      toast.error("Hindi Natapos ang Pag-scan", { description });
    } finally {
      setScanning(false);
    }
  };

  const handleResetScanner = () => {
    stopCamera();
    setCameraFallbackSuggested(false);
    setImageFile(null);
    setImagePreview(null);
    setDiagnosis(null);
    setSheetOpen(false);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  /**
   * Logs the current scan result as an Observation on the selected crop cycle,
   * attaching the original photo and the AI diagnosis JSON. Honest errors only:
   * a 4xx/5xx surfaces the backend message; nothing is fabricated.
   */
  const handleLogObservation = async () => {
    if (!diagnosis) return;
    const cropCycleId = selectedCycle?.id ?? "";
    if (!cropCycleId) {
      toast.error("Walang napiling pananim", {
        description: "Pumili ng sakahan at pananim sa ibaba bago i-log.",
      });
      return;
    }

    setLogging(true);
    try {
      const title = diagnosis.diseaseDetected || "Resulta ng AI Scan";
      const description = [
        diagnosis.description,
        diagnosis.recommendedAction
          ? `Inirerekomendang aksyon: ${diagnosis.recommendedAction}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const res = await createObservation({
        cropCycleId,
        title,
        description: description || "Resulta ng AI Plant Scan.",
        severity: diagnosis.severity || "LOW",
        image: imageFile,
        aiDiagnosis: diagnosis as unknown as Record<string, unknown>,
      });

      if (res.autoEscalatedCase) {
        toast.warning("Mataas ang Pinsala (Auto-Escalated)", {
          description:
            "Awtomatikong naipasa ang kaso sa LGU Agricultural Technician.",
        });
      } else {
        toast.success("Na-log bilang Obserbasyon!", {
          description: "Nai-save ang resulta ng scan sa record ng pananim.",
        });
      }
      navigate("/farmer/history");
    } catch (err) {
      const description =
        err instanceof ApiError
          ? err.message
          : "Hindi na-save ang obserbasyon. Pakisubukan muli.";
      toast.error("Hindi Na-log ang Obserbasyon", { description });
    } finally {
      setLogging(false);
    }
  };

  const handleQueueClick = () => {
    toast.info("Offline Sync Queue", {
      description: `May ${queueCount} nakatagong tala sa telepono na handang i-sync kapag nagka-signal.`,
    });
  };

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center justify-start p-0 md:p-6 lg:p-8 font-sans selection:bg-emerald-500/30">
      {/* Responsive Container: Mobile Viewport (412x917 edge-to-edge) vs Tablet/Desktop Card (md/lg) */}
      <div className="w-full md:max-w-md lg:max-w-lg bg-slate-950 text-slate-900 shadow-2xl flex flex-col justify-between overflow-hidden md:rounded-[36px] md:border-2 md:border-emerald-800/40 h-screen relative select-none">
        {/* ========================================================= */}
        {/* 1. TOP HEADER (Deep Emerald #03543f)                      */}
        {/* ========================================================= */}
        <header className="w-full bg-[#03543f] text-white px-4 sm:px-6 pt-4 pb-3 flex justify-between items-center shadow-md z-30 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/farmer")}
              className="w-10 h-10 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-500/30 flex items-center justify-center text-white active:scale-95 transition cursor-pointer"
              title="Bumalik sa Dashboard"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                AI Plant Scanner
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-200/90 font-medium">
                {farmCtx.municipality || "Cagayan"}, Cagayan • Corn Field
              </p>
            </div>
          </div>

          {/* Offline Queue Badge Button */}
          <button
            onClick={handleQueueClick}
            type="button"
            className="bg-[#f59e0b] hover:bg-[#d97706] active:scale-95 text-amber-950 font-black text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{queueCount} Queue</span>
          </button>
        </header>

        {/* Camera input — opens the back camera directly (no file picker). */}
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        {/* Gallery input — opens the photo library without forcing the camera. */}
        <input
          type="file"
          ref={galleryInputRef}
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* ========================================================= */}
        {/* 2. CAMERA SCANNER VIEWFINDER (FULL BACKGROUND AREA)       */}
        {/* ========================================================= */}
        <div className="relative flex-1 w-full bg-slate-950 flex flex-col justify-between p-4 overflow-hidden shadow-inner">
          {/* Background image preview if chosen */}
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Scanned plant leaf"
              className="absolute inset-0 w-full h-full object-cover opacity-85"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 h-full w-full object-cover ${cameraActive ? "block" : "hidden"}`}
                aria-label="Live na camera preview"
              />
              <div
                className={`absolute inset-0 bg-linear-to-b from-slate-900 via-slate-950 to-emerald-950/40 opacity-90 ${cameraActive ? "hidden" : "block"}`}
              />
            </>
          )}

          {/* Top Overlay Bar */}
          <div className="relative z-10 flex justify-between items-center w-full">
            <div className="flex items-center gap-1.5 text-white bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-bold">
              <Camera className="w-4 h-4 text-emerald-400 stroke-[2.2]" />
              <span>Plant Health AI Scanner</span>
            </div>

            <div className="bg-[#047857]/90 text-emerald-100 text-[11px] font-extrabold px-3 py-1 rounded-full border border-emerald-400/40 shadow-sm flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-300" />
              <span>Vision Mode</span>
            </div>
          </div>

          {/* Viewfinder Center Bounding Box & Target Brackets */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto">
            <div className="relative w-64 h-48 sm:w-72 sm:h-52 flex items-center justify-center">
              {/* Top-Left Bracket */}
              <div className="absolute -top-1 -left-1 w-9 h-9 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl shadow-sm" />

              {/* Top-Right Bracket */}
              <div className="absolute -top-1 -right-1 w-9 h-9 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl shadow-sm" />

              {/* Bottom-Left Bracket */}
              <div className="absolute -bottom-1 -left-1 w-9 h-9 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl shadow-sm" />

              {/* Bottom-Right Bracket */}
              <div className="absolute -bottom-1 -right-1 w-9 h-9 border-b-4 border-r-4 border-emerald-400 rounded-br-xl shadow-sm" />

              {/* Laser Scanning Animation when processing */}
              {scanning && (
                <div className="absolute inset-x-2 h-1 bg-emerald-400 rounded-full shadow-[0_0_12px_#34d399] animate-pulse -translate-y-4" />
              )}

              {/* Instruction Pill */}
              <div className="bg-slate-900/85 backdrop-blur-md text-emerald-200 border border-emerald-500/40 px-4 py-1.5 rounded-full text-xs font-bold shadow-lg text-center">
                {scanning
                  ? "Sinisiyasat ng Gemini AI ang dahon..."
                  : "Itapat ang dahon ng mais sa kahon"}
              </div>
            </div>
          </div>

          {cameraFallbackSuggested && (
            <div className="relative z-10 flex justify-center pb-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-12 rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-emerald-800 shadow-md active:scale-95"
              >
                Subukan ang camera app
              </button>
            </div>
          )}

          {/* Bottom Shutter & Gallery Controls (Sitting well above the white sheet) */}
          <div className="relative z-10 flex justify-between items-center px-8 pb-32 sm:pb-36">
            {/* Gallery Pick Button */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="w-12 h-12 rounded-2xl bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center active:scale-95 transition cursor-pointer shadow-md"
              title="Pumili mula sa Gallery"
            >
              <ImageIcon className="w-5 h-5 text-emerald-300" />
            </button>

            {/* Circular Camera Shutter Button */}
            <button
              type="button"
              disabled={scanning}
              onClick={() => (cameraActive ? captureFromCamera() : startCamera())}
              className="w-18 h-18 rounded-full border-4 border-white/90 bg-emerald-600 hover:bg-emerald-500 active:scale-90 transition-transform shadow-[0_0_24px_rgba(16,185,129,0.6)] flex items-center justify-center cursor-pointer disabled:opacity-50"
              title={cameraActive ? "Kuhanan ng litrato" : "Buksan ang camera"}
            >
              <div className="w-14 h-14 rounded-full border-2 border-white/60 bg-emerald-700/80 flex items-center justify-center">
                <Scan className="w-7 h-7 text-white stroke-[2.2]" />
              </div>
            </button>

            {/* Reset / Rescan Button */}
            <button
              type="button"
              onClick={handleResetScanner}
              className="w-12 h-12 rounded-2xl bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center active:scale-95 transition cursor-pointer shadow-md"
              title="I-reset ang Scanner"
            >
              <RotateCcw className="w-5 h-5 text-slate-300" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. WHITE CONTAINER (SLIDES SMOOTHLY UPWARD AFTER SCAN)    */}
        {/* ========================================================= */}
        <div
          className={`absolute inset-x-0 bottom-16 bg-slate-50 rounded-t-[36px] shadow-2xl border-t border-slate-200 transition-all duration-500 ease-out z-20 flex flex-col ${
            sheetOpen
              ? "max-h-[75vh] h-[72vh] translate-y-0"
              : "max-h-16 h-16 translate-y-0 hover:bg-slate-100/90 cursor-pointer"
          }`}
        >
          {/* Drag Handle / Peek Bar Header */}
          <div
            onClick={() => setSheetOpen(!sheetOpen)}
            className="w-full pt-3 pb-2 px-5 flex flex-col items-center justify-center cursor-pointer shrink-0 border-b border-slate-100"
          >
            {/* Pill Bar */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mb-1" />

            <div className="flex items-center justify-between w-full text-xs font-bold text-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="truncate max-w-57.5">
                  Mais – {farmCtx.farmName || "Inyong Sakahan"} (
                  {farmCtx.variety || "Hybrid Corn"})
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <span>
                  {sheetOpen ? "I-baba ang Sheet" : "Tingnan ang Datos"}
                </span>
                {sheetOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </div>
            </div>
          </div>

          {/* Scrollable Content inside White Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 pb-6">
            {/* DIAGNOSIS CARD (IF DIAGNOSED) */}
            {diagnosis && (
              <div className="w-full bg-white rounded-3xl p-5 shadow-md border-2 border-emerald-500/40 space-y-3.5 animate-in fade-in-50 duration-300">
                <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Gemini Vision AI Diagnosis</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                      {diagnosis.diseaseDetected ||
                        "Malusog na Mais (Healthy Corn)"}
                    </h3>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-black shrink-0 ${
                      diagnosis.severity === "HIGH" ||
                      diagnosis.severity === "CRITICAL"
                        ? "bg-rose-100 text-rose-800 border border-rose-300"
                        : diagnosis.severity === "MEDIUM"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    }`}
                  >
                    {diagnosis.severity || "LOW"} SEVERITY
                  </span>
                </div>

                {/* Explanation & Symptoms */}
                {diagnosis.description && (
                  <div className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    {diagnosis.description}
                  </div>
                )}

                {/* Recommended Action */}
                {diagnosis.recommendedAction && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 space-y-1">
                    <p className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Inirerekomendang Aksyon (DA Region II Guide):</span>
                    </p>
                    <p className="text-xs text-emerald-900 font-medium leading-relaxed pl-1">
                      {diagnosis.recommendedAction}
                    </p>
                  </div>
                )}

                {/* Farm + crop cycle selection for logging this result */}
                <div className="pt-1">
                  <FarmCycleSelector label="I-log sa aling pananim?" />
                </div>

                {/* Log as Observation (uses selected cycle + aiDiagnosis) */}
                <button
                  type="button"
                  onClick={handleLogObservation}
                  disabled={logging || !selectedCycle}
                  className="w-full rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-sm py-3.5 px-3 shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer text-center disabled:opacity-50"
                >
                  <span>
                    {logging ? "Ini-log..." : "I-log bilang Obserbasyon"}
                  </span>
                  {!logging && <ArrowRight className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/farmer/chat")}
                  className="w-full rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs py-3 px-3 shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer text-center"
                >
                  <span>Magtanong sa AI tungkol dito</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* CARD 1: ACTIVE CORN FIELD SUMMARY (MATCHES INSPIRATION) */}
            <div className="w-full bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <Sprout className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">
                    Mais – {farmCtx.farmName || "Inyong Sakahan"}
                  </p>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {farmCtx.variety || "Hybrid Corn"}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Yugto: Paglago ng Tanim (
                    {farmCtx.plantingDate
                      ? `DAP ${Math.max(0, Math.floor((Date.now() - new Date(farmCtx.plantingDate).getTime()) / 86400000))}`
                      : "—"}
                    )
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-[#047857] text-white font-black text-xs px-3 py-1 shadow-sm shrink-0">
                {farmCtx.areaHectares
                  ? `${farmCtx.areaHectares} ha`
                  : "Sakahan"}
              </div>
            </div>

            {/* CARD 2: KAMAKAILANG SCAN (real backend data only) */}
            <div className="w-full bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/80 space-y-3.5">
              {/* Kamakailang Scan */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Kamakailang Scan
                </p>
                {latestScan ? (
                  <div
                    onClick={() => navigate("/farmer/history")}
                    className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 flex items-center justify-between text-xs cursor-pointer hover:bg-amber-100/70 transition"
                  >
                    <div className="flex items-center gap-2 font-bold text-amber-950">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="truncate max-w-47.5">
                        {latestScan.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {new Date(latestScan.createdAt).toLocaleDateString(
                        "fil-PH",
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-center text-xs text-slate-500">
                    Wala pang kamakailang scan sa kasalukuyang pananim.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 4. FIXED BOTTOM NAVIGATION BAR                            */}
        {/* ========================================================= */}
        <BottomNav active="scanner" badgeCount={queueCount} />
      </div>
    </div>
  );
};

export default FarmerScannerPage;
